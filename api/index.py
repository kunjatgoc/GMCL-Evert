"""GMCL API: the public registration endpoints and the admin panel behind them.

Pydantic owns the shape (types, email format, phone validity for the chosen
country). `sp_register` owns the write and the duplicate rule. No SQL is
written here beyond the CALL.

The file is named index.py because Vercel routes a Python function by its
path; vercel.json rewrites every /api/* request onto it and FastAPI still
sees the original path.

    python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
    psql "$DATABASE_URL" -f db/schema.sql
    for f in db/procedures/*.sql; do psql "$DATABASE_URL" -f "$f"; done
    psql "$DATABASE_URL" -f db/grants.sql
    psql "$DATABASE_URL" -f db/admin_schema.sql
    .venv/bin/python scripts/seed_admin.py you@example.com

    .venv/bin/uvicorn --env-file .env api.index:app --reload --port 8000
    .venv/bin/python api/index.py    # validation self-check, no database needed
"""

import base64
import hashlib
import hmac
import os
import secrets
import time
from datetime import date
from typing import Optional

import phonenumbers
from fastapi import Cookie, Depends, FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from psycopg import errors
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from pydantic import BaseModel, EmailStr, Field, ValidationError, model_validator

# Read lazily so the module imports without a database  the self-check below
# and any unit test of the model need the schema, not a connection.
DATABASE_URL = os.environ.get("DATABASE_URL", "")

# Only needed when the built page is served from a different origin than this
# API. In dev, Vite proxies /api and this list is never consulted.
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]

# One serverless instance serves one request at a time and is frozen between
# them, so the pool exists only to reuse a connection across the requests a
# warm instance happens to get. min_size=0 keeps a cold start from opening a
# socket it may never use  the database is remote, so every connection costs
# a TCP and TLS handshake. timeout=5 so a database that is down fails the
# request in seconds rather than parking the instance for the 30s default.
pool = ConnectionPool(DATABASE_URL, min_size=0, max_size=2, timeout=5, open=False)

# Opened here rather than in a lifespan handler: Vercel's ASGI wrapper does not
# reliably run lifespan events, and with min_size=0 this connects to nothing.
if DATABASE_URL:
    pool.open()

app = FastAPI(title="GMCL registration")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class Registration(BaseModel):
    """Exactly the JSON the form posts. Field names match `src/lib/schema.ts`."""

    fullName: str = Field(min_length=2, max_length=80)
    email: EmailStr
    country: str = Field(min_length=2, max_length=2)
    phone: str

    @model_validator(mode="after")
    def normalise_phone(self):
        """The browser already checked this. Check it again  the endpoint is
        public, and the stored number has to be E.164 whoever posted it."""
        try:
            parsed = phonenumbers.parse(self.phone, self.country.upper())
        except phonenumbers.NumberParseException:
            raise ValueError("phone is not valid for the selected country")
        if not phonenumbers.is_valid_number(parsed):
            raise ValueError("phone is not valid for the selected country")
        self.phone = phonenumbers.format_number(
            parsed, phonenumbers.PhoneNumberFormat.E164
        )
        return self


# ponytail: no rate limit or bot check on a public POST  deliberate, deferred.
# Add a honeypot field and a per-IP window in sp_register when the spam starts.
@app.post("/api/register", status_code=201)
def register(entry: Registration) -> dict:
    if not DATABASE_URL:
        raise HTTPException(503, "Registration is temporarily unavailable.")

    try:
        with pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "CALL sp_register(%s, %s, %s, %s)",
                (
                    entry.fullName,
                    entry.email,
                    entry.phone,
                    entry.country.upper(),
                ),
            )
            (registration_id,) = cur.fetchone()
    except errors.UniqueViolation:
        raise HTTPException(409, "That email is already registered.")

    return {"id": registration_id}


class RealAccountRequest(BaseModel):
    """The card under the form posts only an address."""

    email: EmailStr


@app.post("/api/real-account", status_code=201)
def request_real_account(entry: RealAccountRequest) -> dict:
    if not DATABASE_URL:
        raise HTTPException(503, "This request cannot be taken right now.")

    try:
        with pool.connection() as conn, conn.cursor() as cur:
            cur.execute("CALL sp_request_real_account(%s)", (entry.email,))
            (request_id,) = cur.fetchone()
    except errors.UniqueViolation:
        raise HTTPException(409, "That email has already asked.")

    return {"id": request_id}


# --- admin panel ------------------------------------------------------------
#
# The public endpoints above write through security-definer procedures. These
# read directly with parameterised SQL instead: the filters are dynamic, and a
# procedure per filter combination would be a worse trade than one guarded
# query. Every value is bound, never interpolated.

SESSION_SECRET = os.environ.get("SESSION_SECRET", "")
SESSION_COOKIE = "gmcl_admin"
SESSION_TTL = 8 * 3600

# Local dev is plain http, so the Secure flag has to come off there or the
# browser drops the cookie and every request looks signed out.
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "1") != "0"

# pbkdf2 rather than scrypt: `hashlib.scrypt` needs an OpenSSL build that
# exposes it, and it is simply absent on the stock macOS Python this repo is
# developed on. pbkdf2_hmac is always there. 600k iterations is the OWASP
# figure for sha256 -- about a third of a second per attempt, which is nothing
# for one admin sign-in and a lot for anyone guessing offline.
PBKDF2_ROUNDS = 600_000
PBKDF2_DKLEN = 32

PAGE_MAX = 100


def hash_password(password: str) -> str:
    """`pbkdf2$<rounds>$<salt hex>$<key hex>`. hashlib covers this, so no passlib."""
    salt = secrets.token_bytes(16)
    key = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt, PBKDF2_ROUNDS, PBKDF2_DKLEN
    )
    return f"pbkdf2${PBKDF2_ROUNDS}${salt.hex()}${key.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """Reads the round count out of the stored hash, so raising PBKDF2_ROUNDS
    later does not lock out accounts hashed at the old cost."""
    try:
        scheme, rounds, salt_hex, key_hex = stored.split("$")
        if scheme != "pbkdf2":
            return False
        key = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode(),
            bytes.fromhex(salt_hex),
            int(rounds),
            len(key_hex) // 2,
        )
    except ValueError:
        return False
    return hmac.compare_digest(key.hex(), key_hex)


def sign_session(user_id: int) -> str:
    """`<base64 payload>.<hmac>`. Stateless, so signing out server-side is not
    possible -- the short TTL is what bounds a stolen cookie."""
    body = (
        base64.urlsafe_b64encode(f"{user_id}:{int(time.time()) + SESSION_TTL}".encode())
        .rstrip(b"=")
        .decode()
    )
    sig = hmac.new(SESSION_SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()
    return f"{body}.{sig}"


def read_session(token: Optional[str]) -> Optional[int]:
    """The user id, or None for anything that fails to verify or has expired."""
    if not token or not SESSION_SECRET:
        return None
    body, _, sig = token.partition(".")
    if not sig:
        return None
    expected = hmac.new(
        SESSION_SECRET.encode(), body.encode(), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(sig, expected):
        return None
    try:
        padded = body + "=" * (-len(body) % 4)
        user_id, expires_at = base64.urlsafe_b64decode(padded).decode().split(":")
        if int(expires_at) < time.time():
            return None
        return int(user_id)
    except (ValueError, UnicodeDecodeError):
        return None


def require_admin(gmcl_admin: Optional[str] = Cookie(default=None)) -> int:
    user_id = read_session(gmcl_admin)
    if user_id is None:
        raise HTTPException(401, "Not signed in.")
    return user_id


class AdminLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


# ponytail: no login throttle. A serverless instance is frozen between requests
# so an in-process counter buys nothing -- add a per-email attempt column on
# `users` (or a WAF rule) if this ever faces the open internet with a weak
# password.
@app.post("/api/admin/login")
def admin_login(entry: AdminLogin, response: Response) -> dict:
    if not DATABASE_URL or not SESSION_SECRET:
        raise HTTPException(503, "Sign-in is unavailable.")

    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select u.id, u.password_hash, r.name as role
            from users u
            join user_roles r on r.id = u.role_id
            where lower(u.email) = lower(%s) and u.is_active
            """,
            (entry.email,),
        )
        row = cur.fetchone()

        # Hash against a throwaway when the address is unknown, so a miss costs
        # the same time as a wrong password and cannot be used to enumerate.
        stored = row[1] if row else hash_password("no-such-user")
        ok = verify_password(entry.password, stored) and row is not None

        # One message for both halves: naming which was wrong tells a stranger
        # which addresses exist.
        if not ok or row[2] != "admin":
            raise HTTPException(401, "That email and password do not match.")

        cur.execute("update users set last_login_at = now() where id = %s", (row[0],))

    response.set_cookie(
        SESSION_COOKIE,
        sign_session(row[0]),
        max_age=SESSION_TTL,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )
    return {"email": entry.email, "role": row[2]}


@app.post("/api/admin/logout")
def admin_logout(response: Response) -> dict:
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


@app.get("/api/admin/me")
def admin_me(user_id: int = Depends(require_admin)) -> dict:
    with pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            select u.email, r.name as role
            from users u
            join user_roles r on r.id = u.role_id
            where u.id = %s and u.is_active
            """,
            (user_id,),
        )
        row = cur.fetchone()
    if row is None:
        raise HTTPException(401, "Not signed in.")
    return row


@app.get("/api/admin/stats")
def admin_stats(_: int = Depends(require_admin)) -> dict:
    with pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            select
              (select count(*) from registration)                    as demo_total,
              (select count(*) from registration
                 where created_at >= current_date)                    as demo_today,
              (select count(*) from registration
                 where created_at >= current_date - 6)                as demo_week,
              (select count(*) from real_account_request)             as real_total,
              (select count(*) from real_account_request
                 where created_at >= current_date)                    as real_today,
              (select count(*) from real_account_request
                 where created_at >= current_date - 6)                as real_week,
              (select count(distinct country) from registration)      as countries
            """
        )
        totals = cur.fetchone()

        cur.execute(
            """
            select country, count(*) as entries
            from registration
            group by country
            order by entries desc, country
            limit 5
            """
        )
        totals["top_countries"] = cur.fetchall()

        # generate_series rather than group-by-date: a day with no signups has
        # to appear as a zero, or the chart quietly closes the gap and draws a
        # line through a day that never happened.
        cur.execute(
            """
            select
              d::date as day,
              (select count(*) from registration r
                 where r.created_at >= d and r.created_at < d + interval '1 day')        as demo,
              (select count(*) from real_account_request a
                 where a.created_at >= d and a.created_at < d + interval '1 day')        as real_requests
            from generate_series(
              current_date - interval '13 days', current_date, interval '1 day'
            ) d
            order by day
            """
        )
        totals["daily"] = cur.fetchall()

    return totals


def _page(page: int, per_page: int) -> tuple[int, int]:
    """Clamped, so a hand-written `?per_page=100000` cannot ask for the table."""
    per_page = min(max(per_page, 1), PAGE_MAX)
    return max(page, 1), per_page


def _window(date_from: Optional[date], date_to: Optional[date]) -> tuple[list, list]:
    """`date_to` is inclusive of its whole day, which is what a date picker
    means by "to 5 September"."""
    where, params = [], []
    if date_from:
        where.append("created_at >= %s")
        params.append(date_from)
    if date_to:
        where.append("created_at < (%s::date + 1)")
        params.append(date_to)
    return where, params


@app.get("/api/admin/registrations")
def admin_registrations(
    _: int = Depends(require_admin),
    q: str = Query("", max_length=100),
    country: str = Query("", max_length=2),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    page: int = 1,
    per_page: int = 25,
) -> dict:
    page, per_page = _page(page, per_page)
    where, params = _window(date_from, date_to)

    if q.strip():
        where.append("(full_name ilike %s or email ilike %s or mobile ilike %s)")
        params += [f"%{q.strip()}%"] * 3
    if country.strip():
        where.append("country = %s")
        params.append(country.strip().upper())

    clause = f"where {' and '.join(where)}" if where else ""

    with pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(f"select count(*) as total from registration {clause}", params)
        total = cur.fetchone()["total"]
        cur.execute(
            f"""
            select id, full_name, email, mobile, country, created_at
            from registration {clause}
            order by created_at desc, id desc
            limit %s offset %s
            """,
            params + [per_page, (page - 1) * per_page],
        )
        rows = cur.fetchall()

    return {"rows": rows, "total": total, "page": page, "per_page": per_page}


@app.get("/api/admin/real-accounts")
def admin_real_accounts(
    _: int = Depends(require_admin),
    q: str = Query("", max_length=100),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    page: int = 1,
    per_page: int = 25,
) -> dict:
    page, per_page = _page(page, per_page)
    where, params = _window(date_from, date_to)

    if q.strip():
        where.append("email ilike %s")
        params.append(f"%{q.strip()}%")

    clause = f"where {' and '.join(where)}" if where else ""

    with pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"select count(*) as total from real_account_request {clause}", params
        )
        total = cur.fetchone()["total"]
        cur.execute(
            f"""
            select id, email, created_at
            from real_account_request {clause}
            order by created_at desc, id desc
            limit %s offset %s
            """,
            params + [per_page, (page - 1) * per_page],
        )
        rows = cur.fetchall()

    return {"rows": rows, "total": total, "page": page, "per_page": per_page}


if __name__ == "__main__":
    base = dict(
        fullName="Alex Mercer",
        email="alex@example.com",
        country="IN",
        phone="9876543210",
    )
    assert Registration(**base).phone == "+919876543210"

    for bad in ({"country": "GB"}, {"email": "alex@"}, {"fullName": "1"}):
        try:
            Registration(**{**base, **bad})
        except ValidationError:
            continue
        raise AssertionError(f"accepted {bad}")

    assert RealAccountRequest(email="alex@example.com").email == "alex@example.com"
    try:
        RealAccountRequest(email="alex@")
    except ValidationError:
        pass
    else:
        raise AssertionError("accepted a malformed address")

    stored = hash_password("Correct-Horse-9!")
    assert verify_password("Correct-Horse-9!", stored)
    assert not verify_password("correct-horse-9!", stored), "case-insensitive"
    assert not verify_password("Correct-Horse-9!", "not-a-hash")
    assert hash_password("x") != hash_password("x"), "salt is not random"

    SESSION_SECRET = "test-secret"
    token = sign_session(7)
    assert read_session(token) == 7
    assert read_session(token[:-1] + ("0" if token[-1] != "0" else "1")) is None
    assert read_session("garbage") is None
    assert read_session(None) is None

    expired = (
        base64.urlsafe_b64encode(f"7:{int(time.time()) - 1}".encode())
        .rstrip(b"=")
        .decode()
    )
    expired += "." + hmac.new(
        SESSION_SECRET.encode(), expired.encode(), hashlib.sha256
    ).hexdigest()
    assert read_session(expired) is None, "expired token accepted"

    assert _page(0, 10_000) == (1, PAGE_MAX)
    assert _page(3, 25) == (3, 25)

    print("ok")

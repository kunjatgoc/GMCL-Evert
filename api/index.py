"""GMCL API: the public registration endpoints, accounts, and the admin panel.

Pydantic owns the shape (types, email format, phone validity for the chosen
country). `sp_register` owns the write and the duplicate rule. No SQL is
written here beyond the CALL.

The file is named index.py because Vercel routes a Python function by its
path; vercel.json rewrites every /api/* request onto it and FastAPI still
sees the original path.

    python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
    psql "$DATABASE_URL" -f db/schema.sql
    psql "$DATABASE_URL" -f db/app_schema.sql
    for f in db/procedures/*.sql; do psql "$DATABASE_URL" -f "$f"; done
    psql "$DATABASE_URL" -f db/grants.sql
    .venv/bin/python scripts/seed_admin.py you@example.com

    .venv/bin/uvicorn --env-file .env api.index:app --reload --port 8000
    .venv/bin/python api/index.py    # validation self-check, no database needed
"""

import base64
import hashlib
import hmac
import os
import secrets
import smtplib
import time
from datetime import date
from email.message import EmailMessage
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


# --- accounts, and the admin panel behind them -------------------------------
#
# The public endpoints above write through security-definer procedures. These
# read directly with parameterised SQL instead: the filters are dynamic, and a
# procedure per filter combination would be a worse trade than one guarded
# query. Every value is bound, never interpolated.

SESSION_SECRET = os.environ.get("SESSION_SECRET", "")
SESSION_COOKIE = "gmcl_session"
SESSION_TTL = 8 * 3600

# The roles that can sign in today. The staff roles exist in the database and
# nothing is built for them yet, so they are refused at the door rather than
# handed a session that reaches nothing.
SIGN_IN_ROLES = ("admin", "end_user")

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

# An address that has never been confirmed cannot sign in on a password alone.
# The password buys a short-lived pending cookie and a six-digit code in the
# inbox; the code trades that for a session and settles the address for good.
# After that, the password is the whole of it.
#
# The pending cookie is signed the same way and carries the same payload as a
# session, so a stolen one still cannot reach require_admin -- that reads
# SESSION_COOKIE and nothing else.
PENDING_COOKIE = "gmcl_pending"
PENDING_TTL = 10 * 60

OTP_DIGITS = 6
OTP_TTL_MINUTES = 5

# Long enough that a held-down resend button costs one mail, short enough that
# a code lost to a slow inbox is not a five-minute wait. Enforced in
# sp_issue_auth_token, because a serverless instance is frozen between requests
# and an in-process counter would forget.
OTP_RESEND_SECONDS = 60

# Amazon SES, or anything else that speaks SMTP. Never hardcoded: an empty host
# means sign-in answers 503 rather than pretending a code went out.
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT") or 587)
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.environ.get("SMTP_FROM_EMAIL", "")
SMTP_TIMEOUT = 10


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


def new_otp() -> str:
    """A six-digit code from the CSPRNG, leading zeros kept."""
    return f"{secrets.randbelow(10 ** OTP_DIGITS):0{OTP_DIGITS}d}"


def otp_hash(purpose: str, user_id: int, code: str) -> str:
    """What the database stores in place of the code.

    Keyed with SESSION_SECRET, so a copy of `auth_token` is not a list of live
    codes: six digits is a million guesses, which is nothing to brute-force
    offline unless the attacker also has the key.

    Deterministic, unlike hash_password, because the procedure matches on the
    hash rather than fetching a salt first. Purpose and user id are in the
    material, so a code cannot be replayed against another account or another
    kind of token.
    """
    return hmac.new(
        SESSION_SECRET.encode(),
        f"{purpose}:{user_id}:{code}".encode(),
        hashlib.sha256,
    ).hexdigest()


def send_otp_email(to_email: str, code: str) -> None:
    """Mails one code. Raises HTTPException(502) if it cannot.

    Nothing here is logged -- not the code, not the body. The caller sends
    inside its database transaction, so a failure here rolls the token back and
    the person can try again immediately rather than waiting out a resend
    window for a mail that never left.
    """
    msg = EmailMessage()
    msg["Subject"] = "Confirm your Global Market League email"
    msg["From"] = SMTP_FROM_EMAIL
    msg["To"] = to_email
    msg.set_content(
        f"Your confirmation code is {code}\n\n"
        f"Enter it to confirm this address. It expires in "
        f"{OTP_TTL_MINUTES} minutes and can be used once.\n\n"
        "If you were not expecting this, ignore it -- the code is useless "
        "without the account password.\n"
    )

    try:
        if SMTP_PORT == 465:
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT) as s:
                if SMTP_USER:
                    s.login(SMTP_USER, SMTP_PASSWORD)
                s.send_message(msg)
            return

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT) as s:
            s.ehlo()
            if s.has_extn("starttls"):
                s.starttls()
                s.ehlo()
            elif SMTP_USER:
                # No encryption on offer and a password to send. SES always
                # offers STARTTLS, so this is a misconfiguration or a machine
                # in the middle -- either way the password does not go out.
                raise smtplib.SMTPException("server does not offer STARTTLS")
            if SMTP_USER:
                s.login(SMTP_USER, SMTP_PASSWORD)
            s.send_message(msg)
    except (smtplib.SMTPException, OSError) as exc:
        # Deliberately vague to the caller: which host refused, and why, is not
        # the browser's business.
        raise HTTPException(502, "We could not send the code. Try again.") from exc


def sign_session(user_id: int, role: str, ttl: int = SESSION_TTL) -> str:
    """`<base64 payload>.<hmac>`. Stateless, so signing out server-side is not
    possible -- the short TTL is what bounds a stolen cookie.

    The role rides in the payload so an end user's cookie cannot open the
    admin panel, and no request has to ask the database to say so. A role
    change waits out the TTL at most."""
    body = (
        base64.urlsafe_b64encode(
            f"{user_id}:{role}:{int(time.time()) + ttl}".encode()
        )
        .rstrip(b"=")
        .decode()
    )
    sig = hmac.new(SESSION_SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()
    return f"{body}.{sig}"


def read_session(token: Optional[str]) -> Optional[tuple[int, str]]:
    """`(user id, role)`, or None for anything that fails to verify or has
    expired."""
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
        user_id, role, expires_at = (
            base64.urlsafe_b64decode(padded).decode().split(":")
        )
        if int(expires_at) < time.time():
            return None
        return int(user_id), role
    except (ValueError, UnicodeDecodeError):
        return None


# The parameter is named for the cookie it reads; FastAPI matches on the name.
def require_user(gmcl_session: Optional[str] = Cookie(default=None)) -> int:
    """Any signed-in account."""
    session = read_session(gmcl_session)
    if session is None or session[1] not in SIGN_IN_ROLES:
        raise HTTPException(401, "Not signed in.")
    return session[0]


def require_admin(gmcl_session: Optional[str] = Cookie(default=None)) -> int:
    session = read_session(gmcl_session)
    if session is None or session[1] != "admin":
        raise HTTPException(401, "Not signed in.")
    return session[0]


def set_cookie(response: Response, name: str, value: str, ttl: int) -> None:
    response.set_cookie(
        name,
        value,
        max_age=ttl,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )


def issue_otp(cur, user_id: int, email: str) -> bool:
    """A fresh confirmation code, issued and mailed inside the caller's
    transaction. False when one went out inside the resend window: that code
    is still live, and nothing is sent.

    Inside the transaction on purpose. A send that fails takes the token with
    it, so nobody is left waiting out a resend window for a code that never
    left the building."""
    code = new_otp()
    cur.execute(
        "CALL sp_issue_auth_token(%s, 'signup_otp', %s, %s, %s)",
        (
            user_id,
            otp_hash("signup_otp", user_id, code),
            OTP_TTL_MINUTES,
            OTP_RESEND_SECONDS,
        ),
    )
    (token_id,) = cur.fetchone()
    if token_id is None:
        return False
    send_otp_email(email, code)
    return True


class Signup(Registration):
    """The signup form: the registration fields plus a password."""

    password: str = Field(min_length=8, max_length=200)


# ponytail: no rate limit or bot check, same as /api/register. Each account
# costs one mail and the resend guard caps the rest -- add a per-IP window when
# the spam starts.
@app.post("/api/signup", status_code=201)
def signup(entry: Signup, response: Response) -> dict:
    """Creates an end-user account and mails it a confirmation code.

    The account is not usable yet: the response carries a pending cookie, not
    a session, and /api/verify-otp trades one for the other. A code that
    cannot be mailed takes the account with it, so the person simply tries
    again rather than owning an address they can neither confirm nor
    re-register.
    """
    if not DATABASE_URL or not SESSION_SECRET or not SMTP_HOST:
        raise HTTPException(503, "Sign-up is unavailable.")

    try:
        with pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "CALL sp_signup(%s, %s, %s, %s)",
                (
                    entry.fullName,
                    entry.email,
                    entry.phone,
                    hash_password(entry.password),
                ),
            )
            (user_id,) = cur.fetchone()
            issue_otp(cur, user_id, entry.email)
    except errors.UniqueViolation as exc:
        # The index name says which, so a taken number is not reported as a
        # taken address. An address that exists but was never confirmed is
        # still taken: its owner finishes at sign-in, where the password
        # proves it is them.
        if exc.diag.constraint_name == "users_phone_key":
            raise HTTPException(409, "That phone number already has an account.")
        raise HTTPException(409, "That email already has an account.")

    set_cookie(
        response,
        PENDING_COOKIE,
        sign_session(user_id, "end_user", PENDING_TTL),
        PENDING_TTL,
    )
    return {"stage": "otp", "sent": True}


class Login(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


# ponytail: no throttle on wrong passwords. A serverless instance is frozen
# between requests so an in-process counter buys nothing -- add a per-email
# attempt column on `users` (or a WAF rule) if this ever faces a weak password.
@app.post("/api/login")
def login(entry: Login, response: Response) -> dict:
    """Password sign-in for any account in SIGN_IN_ROLES.

    Answers `{"stage": "done", "role": ...}` with a session for a confirmed
    address, and `{"stage": "otp"}` with a pending cookie for one that has
    never been confirmed -- which happens once per account, right after it is
    created.
    """
    if not DATABASE_URL or not SESSION_SECRET:
        raise HTTPException(503, "Sign-in is unavailable.")

    sent = False
    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select u.id, u.password_hash, r.name as role, u.email,
                   u.email_verified_at
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
        if not ok or row[2] not in SIGN_IN_ROLES:
            raise HTTPException(401, "That email and password do not match.")

        user_id, role, email, verified = row[0], row[2], row[3], row[4]

        if verified is None:
            # The code from account creation may well have expired by now, so
            # send a fresh one rather than leaving them stuck with a dead code
            # and no way to ask for another.
            if not SMTP_HOST:
                raise HTTPException(503, "Sign-in is unavailable.")
            sent = issue_otp(cur, user_id, email)
        else:
            cur.execute(
                "update users set last_login_at = now() where id = %s", (user_id,)
            )

    if verified is not None:
        set_cookie(response, SESSION_COOKIE, sign_session(user_id, role), SESSION_TTL)
        return {"stage": "done", "email": email, "role": role}

    # A refused re-issue is not a refused sign-in. The resend guard means a
    # code went out moments ago and is still live for another few minutes, so
    # the person needs the screen that takes it -- answering 429 here would
    # strand them on the password form holding a code with nowhere to type it.
    set_cookie(
        response,
        PENDING_COOKIE,
        sign_session(user_id, role, PENDING_TTL),
        PENDING_TTL,
    )
    # The code is never in the response, and neither is anything that narrows
    # it down. `sent` says only whether fresh mail left the building, so the
    # next screen can word itself honestly.
    return {"stage": "otp", "sent": sent}


class OtpCode(BaseModel):
    code: str = Field(pattern=r"^\d{6}$")


@app.post("/api/verify-otp")
def verify_otp(
    entry: OtpCode,
    response: Response,
    gmcl_pending: Optional[str] = Cookie(default=None),
) -> dict:
    """Spends the confirmation code, settles the address, and issues the
    session that the password alone did not buy."""
    pending = read_session(gmcl_pending)
    if pending is None:
        raise HTTPException(401, "That sign-in expired. Start again.")
    user_id = pending[0]

    row = None
    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute(
            "CALL sp_verify_otp(%s, 'signup_otp', %s)",
            (user_id, otp_hash("signup_otp", user_id, entry.code)),
        )
        (ok,) = cur.fetchone()

        # Nothing is raised inside this block: a wrong code has just cost an
        # attempt, and rolling that back would hand the guesser unlimited
        # tries.
        if ok:
            # The role comes from the table, not the pending cookie: the table
            # is the one that cannot be stale.
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
            if row is not None and row[1] in SIGN_IN_ROLES:
                cur.execute(
                    "update users set last_login_at = now() where id = %s",
                    (user_id,),
                )

    if not ok:
        raise HTTPException(401, "That code is wrong or has expired.")
    if row is None or row[1] not in SIGN_IN_ROLES:
        raise HTTPException(401, "That sign-in expired. Start again.")

    set_cookie(response, SESSION_COOKIE, sign_session(user_id, row[1]), SESSION_TTL)
    response.delete_cookie(PENDING_COOKIE, path="/")
    return {"email": row[0], "role": row[1]}


@app.post("/api/resend-otp")
def resend_otp(gmcl_pending: Optional[str] = Cookie(default=None)) -> dict:
    """A new confirmation code for the same pending sign-in. The password is
    not asked for again -- the pending cookie is the proof it was given."""
    pending = read_session(gmcl_pending)
    if pending is None:
        raise HTTPException(401, "That sign-in expired. Start again.")
    if not SMTP_HOST:
        raise HTTPException(503, "Sign-in is unavailable.")
    user_id = pending[0]

    sent = False
    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute(
            "select email from users where id = %s and is_active", (user_id,)
        )
        row = cur.fetchone()
        if row is not None:
            sent = issue_otp(cur, user_id, row[0])

    if row is None:
        raise HTTPException(401, "That sign-in expired. Start again.")
    if not sent:
        raise HTTPException(429, "A code was just sent. Wait a moment.")
    return {"ok": True}


@app.post("/api/logout")
def logout(response: Response) -> dict:
    response.delete_cookie(SESSION_COOKIE, path="/")
    # A half-finished sign-in is still a sign-in to abandon.
    response.delete_cookie(PENDING_COOKIE, path="/")
    return {"ok": True}


@app.get("/api/me")
def me(user_id: int = Depends(require_user)) -> dict:
    with pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            select u.email, u.full_name, r.name as role
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


# --- the user's dashboard ---------------------------------------------------


class MetaidRequest(BaseModel):
    """One ask from the dashboard: which kind, and the address to issue it to."""

    type: str = Field(pattern=r"^(demo|real)$")
    email: EmailStr


@app.get("/api/metaid")
def list_metaid(user_id: int = Depends(require_user)) -> dict:
    """Every request this person has made, newest first, so the dashboard can
    show the latest of each kind."""
    with pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            select id, metaid_type as type, email, status, decision_note,
                   created_at, decided_at
            from metaid_request
            where user_id = %s
            order by created_at desc, id desc
            """,
            (user_id,),
        )
        rows = cur.fetchall()
    return {"rows": rows}


@app.post("/api/metaid", status_code=201)
def request_metaid(
    entry: MetaidRequest, user_id: int = Depends(require_user)
) -> dict:
    try:
        with pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "CALL sp_request_metaid(%s, %s, %s)",
                (user_id, entry.type, entry.email),
            )
            (request_id,) = cur.fetchone()
    except errors.UniqueViolation:
        raise HTTPException(
            409, f"Your {entry.type} MetaID request is already waiting for an answer."
        )
    return {"id": request_id}


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

    assert len(new_otp()) == OTP_DIGITS
    assert new_otp().isdigit()
    assert {len(new_otp()) for _ in range(200)} == {OTP_DIGITS}, "leading zero lost"

    assert otp_hash("signup_otp", 7, "000123") == otp_hash("signup_otp", 7, "000123")
    assert otp_hash("signup_otp", 7, "000123") != otp_hash("signup_otp", 8, "000123")
    assert otp_hash("signup_otp", 7, "000123") != otp_hash("password_reset", 7, "000123")
    assert otp_hash("signup_otp", 7, "000123") != otp_hash("signup_otp", 7, "123")
    assert "000123" not in otp_hash("signup_otp", 7, "000123")

    assert OtpCode(code="012345").code == "012345"
    for bad in ("12345", "1234567", "12345a", "", "  1234"):
        try:
            OtpCode(code=bad)
        except ValidationError:
            continue
        raise AssertionError(f"accepted {bad!r} as a code")

    assert Signup(**base, password="12345678").password == "12345678"
    for bad in ("1234567", ""):
        try:
            Signup(**base, password=bad)
        except ValidationError:
            continue
        raise AssertionError(f"accepted {bad!r} as a password")

    assert MetaidRequest(type="demo", email="alex@example.com").type == "demo"
    for bad in ({"type": "live"}, {"type": ""}, {"email": "alex@"}):
        try:
            MetaidRequest(**{"type": "real", "email": "alex@example.com", **bad})
        except ValidationError:
            continue
        raise AssertionError(f"accepted {bad}")

    token = sign_session(7, "admin")
    assert read_session(token) == (7, "admin")
    assert read_session(token[:-1] + ("0" if token[-1] != "0" else "1")) is None
    assert read_session("garbage") is None
    assert read_session(None) is None

    expired = (
        base64.urlsafe_b64encode(f"7:admin:{int(time.time()) - 1}".encode())
        .rstrip(b"=")
        .decode()
    )
    expired += "." + hmac.new(
        SESSION_SECRET.encode(), expired.encode(), hashlib.sha256
    ).hexdigest()
    assert read_session(expired) is None, "expired token accepted"

    # The pending cookie is the same signature with a shorter life, so a
    # ten-minute token must still read back and a lapsed one must not.
    assert read_session(sign_session(7, "end_user", PENDING_TTL)) == (7, "end_user")
    assert read_session(sign_session(7, "end_user", -1)) is None

    # An old-format token (no role) must read as nothing, not as an admin.
    legacy = (
        base64.urlsafe_b64encode(f"7:{int(time.time()) + 60}".encode())
        .rstrip(b"=")
        .decode()
    )
    legacy += "." + hmac.new(
        SESSION_SECRET.encode(), legacy.encode(), hashlib.sha256
    ).hexdigest()
    assert read_session(legacy) is None, "role-less token accepted"

    assert _page(0, 10_000) == (1, PAGE_MAX)
    assert _page(3, 25) == (3, 25)

    print("ok")

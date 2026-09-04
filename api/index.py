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
import sys
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

# Absolute, because a reset link in an email has nowhere to be relative to.
# Falls back to the first allowed origin, which is the site in every deployment
# that needs CORS at all, and localhost in the one that does not.
APP_ORIGIN = (
    os.environ.get("APP_ORIGIN")
    or next(iter(ALLOWED_ORIGINS), "http://localhost:5173")
).rstrip("/")

# One serverless instance serves one request at a time and is frozen between
# them, so the pool exists only to reuse a connection across the requests a
# warm instance happens to get. min_size=0 keeps a cold start from opening a
# socket it may never use  the database is remote, so every connection costs
# a TCP and TLS handshake. timeout=5 so a database that is down fails the
# request in seconds rather than parking the instance for the 30s default.
#
# `check` is not optional here. Without it the pool hands out whatever it is
# holding, and a connection the far end has quietly dropped -- a NAT expiring
# an idle flow, an instance thawed after being frozen, a laptop that slept --
# only reveals itself as "server closed the connection unexpectedly" on the
# first query, which the caller sees as a 500. Postgres itself is not closing
# these: `idle_session_timeout` is 0 and keepalives do not start for two hours,
# so nothing on the server side will ever prevent it.
#
# check_connection sends an empty query at checkout, so a dead connection is
# discarded and replaced before the request touches it. It costs one round trip
# per request -- about 20ms against this database, next to 322ms to open a
# fresh connection -- which is the price of the request not failing.
pool = ConnectionPool(
    DATABASE_URL,
    min_size=0,
    max_size=2,
    timeout=5,
    check=ConnectionPool.check_connection,
    open=False,
)

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


def country_of(phone: str) -> Optional[str]:
    """The ISO country of a stored number, or None if it will not parse.

    Derived rather than stored: `users` keeps the number in E.164, which
    carries the dialling country inside it, so a column would be a second copy
    of something already there and free to drift from it.

    ponytail: this is the number's country, not a stated residence. They agree
    for almost everyone and the queue only needs the former; add a real column
    to `users` on the day someone has to be asked where they live.
    """
    try:
        return phonenumbers.region_code_for_number(phonenumbers.parse(phone))
    except phonenumbers.NumberParseException:
        return None


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

# Every role can sign in now that each has somewhere to land.
SIGN_IN_ROLES = ("admin", "newera_staff", "gml_staff", "end_user")

# Who may read the MetaID queue and decide on it. The same pair sp_decide_metaid
# enforces in the database, named here so the API refuses before the round trip
# rather than relying on the procedure to answer false.
STAFF_ROLES = ("admin", "newera_staff")

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

# A reset secret rides in a URL, so it cannot be six digits: a link is guessed
# offline at whatever rate the network allows, not typed five times into a
# form. 32 bytes is 256 bits, and token_urlsafe emits nothing a query string
# would have to escape.
#
# Half an hour rather than the OTP's five minutes -- the code is read off a
# screen the person is already looking at, the link is found later, in an inbox
# they had to go and open.
RESET_TOKEN_BYTES = 32
RESET_TTL_MINUTES = 30

# Long enough that a held-down resend button costs one mail, short enough that
# a code lost to a slow inbox is not a five-minute wait. Enforced in
# sp_issue_auth_token, because a serverless instance is frozen between requests
# and an in-process counter would forget.
OTP_RESEND_SECONDS = 60

# The whole mail configuration, read from the environment and written nowhere
# else. Not one of these values is spelled out in this file: a setting baked
# into the source cannot be changed without a deploy, follows a copy of this
# file into a deployment it was never meant to send from, and quietly disagrees
# with whatever `.env` says. `.env.example` lists every name with a note on
# what belongs in it.
#
# Empty is a supported state, not a broken one. An unset mail config means mail
# cannot go out, which the endpoints below answer honestly rather than
# pretending a code was sent.
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_FROM_EMAIL = os.environ.get("SMTP_FROM_EMAIL", "")
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")

# The provider groups a message under a configuration set when this header is
# present, which is where bounce and complaint tracking is switched on. Unset
# means the header is left off entirely.
EMAIL_CONFIGURATION_SET = os.environ.get("EMAIL_CONFIGURATION_SET", "")

# Transport numbers rather than identity, so these two keep a working fallback:
# 587 is the SMTP submission port every provider offers, and ten seconds is
# long enough for a handshake and short enough that a dead host cannot hold a
# request open. Both are still overridable by name.
SMTP_PORT = int(os.environ.get("SMTP_PORT") or 587)
SMTP_TIMEOUT = int(os.environ.get("SMTP_TIMEOUT") or 10)

# What decides whether a message can actually leave. A provider refuses an
# unauthenticated session and refuses an unverified sender, so a half-filled
# config can send nothing and is treated as no config at all -- better than
# building a message that is certain to bounce.
SMTP_READY = bool(SMTP_HOST and SMTP_USER and SMTP_PASSWORD and SMTP_FROM_EMAIL)

# Prints every confirmation code to the terminal. A development switch, and a
# real credential leak anywhere else: a code in a log is a code anyone with log
# access can sign in with, and Vercel's function logs are not a private place.
#
# Off unless it is explicitly turned on, so forgetting to unset it is not
# possible -- it has to be set to be dangerous. Never put OTP_ECHO in the
# Vercel project environment.
#
# It also stands in for the mail server, so the whole sign-up flow can be
# walked through before mail credentials exist or after they are withdrawn.
# That covers both shapes of "no mail": a configuration with nothing in it,
# and one whose credentials the provider no longer accepts. The substitution
# only ever happens when this is on.
OTP_ECHO = os.environ.get("OTP_ECHO", "") == "1"

# A secret can reach the person either by mail or, in development, by being
# printed. The endpoints ask this rather than asking about SMTP directly.
CAN_SEND_MAIL = SMTP_READY or OTP_ECHO

if OTP_ECHO:
    print(
        "[OTP_ECHO] ON -- every confirmation code will be printed below.\n"
        "[OTP_ECHO] Development only. Never set OTP_ECHO in the Vercel "
        "environment.",
        file=sys.stderr,
        flush=True,
    )


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


# The product's colours, inlined because an email cannot load a stylesheet and
# most clients strip <style> anyway.
MAIL_BG = "#0D1512"
MAIL_CARD = "#18211D"
MAIL_GREEN = "#3EE68A"
MAIL_TEXT = "#E4EAE7"
MAIL_MUTED = "#A6B3AC"


def render_email(heading: str, intro: str, outro: str, *, code: str = "", link: str = "", link_label: str = "") -> str:
    """The one template both letters use.

    Tables and inline styles, because that is what mail clients render: no
    stylesheet is loaded, <style> is stripped by several of them, and flexbox
    is not reliable anywhere. No images either -- the mark is type in a bordered
    cell, so a blocked-image client still shows the brand.

    Dark, like the product. The plain-text part the caller also sends is what
    a client that refuses HTML falls back to.
    """
    if code:
        feature = (
            f'<tr><td align="center" style="padding:8px 0 4px">'
            f'<div style="display:inline-block;padding:18px 28px;border-radius:14px;'
            f'border:1px solid rgba(62,230,138,0.35);background:rgba(62,230,138,0.10);'
            f'color:{MAIL_GREEN};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;'
            f'font-size:34px;font-weight:700;letter-spacing:10px">{code}</div>'
            f"</td></tr>"
        )
    elif link:
        feature = (
            f'<tr><td align="center" style="padding:10px 0 4px">'
            f'<a href="{link}" style="display:inline-block;padding:14px 30px;border-radius:12px;'
            f'background:{MAIL_GREEN};color:#06110B;font-weight:700;font-size:16px;'
            f'text-decoration:none">{link_label}</a></td></tr>'
            f'<tr><td align="center" style="padding:14px 0 0;color:{MAIL_MUTED};'
            f'font-size:12px;word-break:break-all">{link}</td></tr>'
        )
    else:
        feature = ""

    return f"""\
<!doctype html>
<html><body style="margin:0;padding:0;background:{MAIL_BG}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{MAIL_BG};padding:32px 16px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
      <tr><td align="center" style="padding-bottom:24px">
        <span style="display:inline-block;padding:10px 12px;border-radius:12px;border:1px solid rgba(62,230,138,0.45);background:rgba(62,230,138,0.10);color:{MAIL_GREEN};font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:1px">GML</span>
        <span style="padding-left:10px;color:#ffffff;font-family:Helvetica,Arial,sans-serif;font-size:17px;font-weight:700;vertical-align:middle">Global Market League</span>
      </td></tr>
      <tr><td style="background:{MAIL_CARD};border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:32px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="font-family:Helvetica,Arial,sans-serif;color:{MAIL_TEXT}">
          <tr><td style="font-size:21px;font-weight:700;color:#ffffff;padding-bottom:12px">{heading}</td></tr>
          <tr><td style="font-size:15px;line-height:24px;padding-bottom:20px">{intro}</td></tr>
          {feature}
          <tr><td style="font-size:13px;line-height:21px;color:{MAIL_MUTED};padding-top:22px">{outro}</td></tr>
        </table>
      </td></tr>
      <tr><td align="center" style="padding-top:20px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:19px;color:{MAIL_MUTED}">
        Global Market League &middot; demo accounts only, no deposit required.<br>
        This message was sent to {{to}}.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>"""


def send_mail(to_email: str, subject: str, body: str, html: str = "") -> None:
    """Mails one message. Raises HTTPException(502) if it cannot.

    Nothing is logged unless OTP_ECHO is on, which is a development switch and
    is off by default. Callers send inside their database transaction, so a
    failure here rolls the token back and the person can try again immediately
    rather than waiting out a resend window for a mail that never left.

    The two letters below build their own text and hand it here. Only the
    transport is shared, because only the transport is worth not writing twice.
    """
    if OTP_ECHO:
        # stderr, not stdout: uvicorn's own log goes there, so the secret lands
        # in the same stream as the request that caused it and stays out of
        # anything parsing stdout.
        print(f"[OTP_ECHO] {to_email} -- {subject}\n{body}", file=sys.stderr, flush=True)
        # Nothing to hand it to, and the secret is already on screen, so the
        # send is done. Only reachable with the switch on.
        if not SMTP_READY:
            return

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM_EMAIL
    msg["To"] = to_email
    if EMAIL_CONFIGURATION_SET:
        msg["X-SES-CONFIGURATION-SET"] = EMAIL_CONFIGURATION_SET
    msg.set_content(body)
    if html:
        # The plain part stays the real message; this is the alternative a
        # client shows when it can, and the one it falls back from when it
        # cannot.
        msg.add_alternative(html.replace("{to}", to_email), subtype="html")

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
        if OTP_ECHO:
            # The secret is already on the terminal, and with this switch on
            # that is a real delivery channel -- so the send being refused has
            # cost the person nothing. Raising here would roll back the
            # caller's transaction and destroy a code they can already read,
            # which is a worse outcome than a message that did not leave.
            #
            # Reached when the config is filled in but the provider will not
            # take it: withdrawn credentials, a suspended account, an
            # unreachable host. A config that is simply empty returned above.
            #
            # The class name only. An exception's text carries the server's
            # reply, and that is not something to widen the log with.
            print(
                f"[OTP_ECHO] mail server refused the send "
                f"({exc.__class__.__name__}); use the code printed above.",
                file=sys.stderr,
                flush=True,
            )
            return
        # Deliberately vague to the caller: which host refused, and why, is not
        # the browser's business.
        raise HTTPException(502, "We could not send that email. Try again.") from exc


def send_otp_email(to_email: str, code: str) -> None:
    send_mail(
        to_email,
        "Confirm your Global Market League email",
        f"Your confirmation code is {code}\n\n"
        f"Enter it to confirm this address. It expires in "
        f"{OTP_TTL_MINUTES} minutes and can be used once.\n\n"
        "If you were not expecting this, ignore it -- the code is useless "
        "without the account password.\n",
        render_email(
            "Confirm your email",
            "Enter this code to finish creating your account.",
            f"It expires in {OTP_TTL_MINUTES} minutes and can be used once. If "
            "you were not expecting this, ignore it &mdash; the code is useless "
            "without the account password.",
            code=code,
        ),
    )


def send_reset_email(to_email: str, link: str) -> None:
    send_mail(
        to_email,
        "Reset your Global Market League password",
        f"Open this link to choose a new password:\n\n{link}\n\n"
        f"It expires in {RESET_TTL_MINUTES} minutes and can be used once. "
        "Your current password keeps working until you finish.\n\n"
        "If you did not ask for this, ignore it -- the link is the only way "
        "in and nobody else has it.\n",
        render_email(
            "Choose a new password",
            "Open this link to set a new password on your account.",
            f"It expires in {RESET_TTL_MINUTES} minutes and can be used once, "
            "and your current password keeps working until you finish. If you "
            "did not ask for this, ignore it &mdash; the link is the only way "
            "in and nobody else has it.",
            link=link,
            link_label="Choose a new password",
        ),
    )


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


def require_staff(gmcl_session: Optional[str] = Cookie(default=None)) -> int:
    """An admin or newera staff. The MetaID queue, and nothing else so far."""
    session = read_session(gmcl_session)
    if session is None or session[1] not in STAFF_ROLES:
        raise HTTPException(401, "Not signed in.")
    return session[0]


def require_gml(gmcl_session: Optional[str] = Cookie(default=None)) -> int:
    """GML staff, and an admin who wants to see what they see.

    Deliberately not `require_staff`: newera reviews MetaID requests, GML runs
    the league, and neither has business on the other's screens. The admin is
    in both because the admin is in everything.
    """
    session = read_session(gmcl_session)
    if session is None or session[1] not in ("admin", "gml_staff"):
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
    if not DATABASE_URL or not SESSION_SECRET or not CAN_SEND_MAIL:
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
            raise HTTPException(409, "This phone number already has an account.")
        raise HTTPException(409, "This email already has an account.")

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

    A password and nothing else for a confirmed address. An address that never
    answered its signup code is sent a fresh one here and answers it at
    /api/verify-otp -- the password has just proved the account is theirs, and
    without this the ten-minute pending cookie lapsing would lock the account
    away for good: signup answers 409 and resend has nothing to read.
    """
    if not DATABASE_URL or not SESSION_SECRET:
        raise HTTPException(503, "Sign-in is unavailable.")

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
            raise HTTPException(401, "Wrong email or password.")

        user_id, role, email, verified = row[0], row[2], row[3], row[4]

        # Never confirmed. Said after the password check, so the answer still
        # tells a stranger nothing they did not already supply -- a wrong
        # password on an unconfirmed address is the same 401 as any other.
        #
        # A fresh code and the pending cookie signup's code would have bought,
        # not a session: the address still has to be answered for. `sent` is
        # false when one went out inside the resend window, so the screen can
        # say "use the one you have" rather than promising a mail that is not
        # coming.
        if verified is None:
            if not CAN_SEND_MAIL:
                raise HTTPException(503, "Sign-in is unavailable.")
            sent = issue_otp(cur, user_id, email)
            set_cookie(
                response,
                PENDING_COOKIE,
                sign_session(user_id, role, PENDING_TTL),
                PENDING_TTL,
            )
            return {"stage": "otp", "sent": sent}

        cur.execute(
            "update users set last_login_at = now() where id = %s", (user_id,)
        )

    set_cookie(response, SESSION_COOKIE, sign_session(user_id, role), SESSION_TTL)
    return {"stage": "session", "email": email, "role": role}


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
    if not CAN_SEND_MAIL:
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


class ForgotPassword(BaseModel):
    email: EmailStr


# ponytail: no rate limit, same as every other public POST. The resend guard in
# sp_issue_auth_token caps the mail one address can draw; a per-IP window is
# what caps the rest, when it is worth having.
@app.post("/api/forgot-password")
def forgot_password(entry: ForgotPassword) -> dict:
    """Mails a reset link, and answers the same either way.

    The answer never says whether the address has an account. That costs
    nothing here, so it is done properly -- though the loud oracle on this site
    is /api/signup, which says 409 for an address it already holds.

    Timing still separates the two: a known address waits on SMTP and an
    unknown one returns at once. Closing that needs the send off the request,
    which needs a queue.
    """
    if not DATABASE_URL or not SESSION_SECRET or not CAN_SEND_MAIL:
        raise HTTPException(503, "Password reset is unavailable.")

    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select u.id, u.email, r.name as role
            from users u
            join user_roles r on r.id = u.role_id
            where lower(u.email) = lower(%s) and u.is_active
            """,
            (entry.email,),
        )
        row = cur.fetchone()

        if row is not None and row[2] in SIGN_IN_ROLES:
            user_id, email = row[0], row[1]
            # The secret leaves in the link and is never stored: what reaches
            # auth_token is the same keyed hash the codes use, so a copy of the
            # table is not a set of live links either.
            token = secrets.token_urlsafe(RESET_TOKEN_BYTES)
            cur.execute(
                "CALL sp_issue_auth_token(%s, 'password_reset', %s, %s, %s)",
                (
                    user_id,
                    otp_hash("password_reset", user_id, token),
                    RESET_TTL_MINUTES,
                    OTP_RESEND_SECONDS,
                ),
            )
            (token_id,) = cur.fetchone()
            # Null means one went out inside the resend window and is still
            # live. Nothing is sent, and the answer does not change: the person
            # already has the link they are asking for.
            if token_id is not None:
                # token_urlsafe emits nothing a query string would escape.
                send_reset_email(
                    email,
                    f"{APP_ORIGIN}/reset-password?uid={user_id}&token={token}",
                )

    return {"ok": True}


class ResetPassword(BaseModel):
    """What the link carries, plus what the screen asks for."""

    uid: int
    token: str = Field(min_length=16, max_length=200)
    password: str = Field(min_length=8, max_length=200)


@app.post("/api/reset-password")
def reset_password(entry: ResetPassword) -> dict:
    """Spends the link and sets the new password.

    sp_reset_password settles email_verified_at too, so an account that never
    answered its signup code is recovered by this as well -- otherwise it would
    get its password back and still be shut out.
    """
    if not DATABASE_URL or not SESSION_SECRET:
        raise HTTPException(503, "Password reset is unavailable.")

    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute(
            "CALL sp_reset_password(%s, %s, %s)",
            (
                entry.uid,
                otp_hash("password_reset", entry.uid, entry.token),
                hash_password(entry.password),
            ),
        )
        (ok,) = cur.fetchone()

    # Raised after the block, not inside it: a miss has just cost an attempt,
    # and rolling that back would hand a guesser unlimited tries.
    if not ok:
        raise HTTPException(401, "That link is no longer valid. Ask for a new one.")

    # No session. Signing in with the new password is the proof it was set, and
    # this endpoint takes no cookie so it has nothing to trade.
    #
    # ponytail: sessions are stateless, so a reset cannot sign anyone else out
    # -- a cookie taken before this stays good for its eight hours. The fix is
    # the `session_epoch` column named in db/procedures/sp_reset_password.sql.
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
            select u.email, u.full_name, u.phone, r.name as role
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


class ProfileUpdate(BaseModel):
    """The only thing about an account its owner may change unaided.

    Email and phone are not here. Both are unique identifiers others are told
    about -- the address confirmed at sign-up, the number the account is found
    by -- so moving either is a support job with its own confirmation, not a
    text field.
    """

    full_name: str = Field(min_length=2, max_length=80)


@app.patch("/api/me")
def update_me(entry: ProfileUpdate, user_id: int = Depends(require_user)) -> dict:
    with pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            update users set full_name = btrim(%s)
             where id = %s and is_active
            returning full_name
            """,
            (entry.full_name, user_id),
        )
        row = cur.fetchone()
    if row is None:
        raise HTTPException(401, "Not signed in.")
    return row


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=8, max_length=200)


@app.post("/api/change-password")
def change_password(entry: PasswordChange, user_id: int = Depends(require_user)) -> dict:
    """The current password is asked for even though the session already
    proves who this is: a session left open on a shared machine should not be
    enough to take the account.

    ponytail: sessions are stateless, so this cannot sign other devices out --
    the same `session_epoch` gap sp_reset_password.sql already names.
    """
    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute(
            "select password_hash from users where id = %s and is_active", (user_id,)
        )
        row = cur.fetchone()
        if row is None:
            raise HTTPException(401, "Not signed in.")
        if not verify_password(entry.current_password, row[0]):
            raise HTTPException(403, "Your current password is wrong.")
        cur.execute(
            "update users set password_hash = %s where id = %s",
            (hash_password(entry.new_password), user_id),
        )
    return {"ok": True}


# --- the user's dashboard ---------------------------------------------------


class MetaidRequest(BaseModel):
    """One ask from the dashboard: which kind, and the address to issue it to."""

    type: str = Field(pattern=r"^(demo|real)$")
    email: EmailStr


@app.get("/api/metaid")
def list_metaid(user_id: int = Depends(require_user)) -> dict:
    """Every request this person has made, newest first, so the dashboard can
    show the latest of each kind.

    `phone` is joined from `users` rather than stored on the row, so a
    corrected number reads corrected on every request the person ever made.
    Same shape the admin queue will want, minus the `where`.
    """
    with pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            select m.id, m.user_id, u.phone, m.metaid_type as type, m.email,
                   m.status, m.decision_note, m.created_at, m.decided_at
            from metaid_request m
            join users u on u.id = m.user_id
            where m.user_id = %s
            order by m.created_at desc, m.id desc
            """,
            (user_id,),
        )
        rows = cur.fetchall()
    return {"rows": rows}


def real_email_available(email: str) -> bool:
    """Whether Gspice already holds an account against this address.

    True means the address is free to issue a Real MetaID against. False sends
    the screen back to ask for a different one.

    ponytail: the call is not written -- Gspice's endpoint, auth and response
    shape have not been supplied, and inventing them would mean deleting a
    guess later rather than filling a hole. Everything above this line is
    finished and reaches here; this body is the whole of what is left, and
    until it does something real every address is treated as free.
    """
    return True


class MetaidCheck(BaseModel):
    email: EmailStr


@app.post("/api/metaid/check")
def check_metaid_email(entry: MetaidCheck, _: int = Depends(require_user)) -> dict:
    """Asks before the request is made, because the answer changes what the
    screen asks for next rather than whether the request failed.

    Demo never comes here: it is issued against the account's own address and
    has nothing to check.
    """
    return {"available": real_email_available(entry.email)}


@app.post("/api/metaid", status_code=201)
def request_metaid(
    entry: MetaidRequest, user_id: int = Depends(require_user)
) -> dict:
    # Checked again here, not only on the screen: /api/metaid/check is
    # advisory and a caller can simply not ask it.
    if entry.type == "real" and not real_email_available(entry.email):
        raise HTTPException(409, "This email already has a newera account.")

    try:
        with pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "CALL sp_request_metaid(%s, %s, %s)",
                (user_id, entry.type, entry.email),
            )
            (request_id,) = cur.fetchone()
    except errors.UniqueViolation:
        raise HTTPException(
            409, f"You already have a {entry.type} MetaID request waiting."
        )
    return {"id": request_id}


@app.get("/api/gml/stats")
def gml_stats(_: int = Depends(require_gml)) -> dict:
    """The league in four numbers, all of it already in the database.

    Entries and the accounts behind them -- GML's side of the arrangement.
    Nothing about MetaID requests: those are newera's to answer, and counting
    them here would be the first line of a workflow nobody has specified.
    """
    with pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            select
              (select count(*) from registration)                     as entrants,
              (select count(*) from registration
                 where created_at >= current_date)                    as entrants_today,
              (select count(distinct country) from registration)      as countries,
              (select count(*) from users u
                 join user_roles r on r.id = u.role_id
                where r.name = 'end_user')                            as accounts
            """
        )
        return cur.fetchone()


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


class Decision(BaseModel):
    """What the queue sends back. The note is only worth having on a refusal,
    where the person is owed a reason."""

    status: str = Field(pattern=r"^(approved|rejected)$")
    note: Optional[str] = Field(default=None, max_length=500)


@app.get("/api/admin/metaid")
def admin_metaid(
    _: int = Depends(require_staff),
    q: str = Query("", max_length=100),
    status: str = Query("", max_length=10),
    type: str = Query("", max_length=10),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    page: int = 1,
    per_page: int = 25,
) -> dict:
    """Every MetaID request, newest first, with the account it belongs to.

    Phone and the account address are joined rather than stored on the row --
    a corrected number has to read corrected here, which is the whole reason
    app_schema.sql keeps them on `users`.
    """
    page, per_page = _page(page, per_page)
    where, params = _window(date_from, date_to)
    where = [w.replace("created_at", "m.created_at") for w in where]

    if q.strip():
        where.append(
            "(m.email ilike %s or u.email ilike %s or u.phone ilike %s"
            " or u.full_name ilike %s)"
        )
        params += [f"%{q.strip()}%"] * 4
    # Both bound, not interpolated, and a value the check constraints would
    # reject simply matches nothing.
    if status.strip():
        where.append("m.status = %s")
        params.append(status.strip().lower())
    if type.strip():
        where.append("m.metaid_type = %s")
        params.append(type.strip().lower())

    clause = f"where {' and '.join(where)}" if where else ""

    with pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            select count(*) as total
            from metaid_request m join users u on u.id = m.user_id {clause}
            """,
            params,
        )
        total = cur.fetchone()["total"]
        cur.execute(
            f"""
            select m.id, m.user_id, u.full_name, u.phone,
                   u.email as account_email, m.email, m.metaid_type as type,
                   m.status, m.decision_note, m.created_at, m.decided_at
            from metaid_request m
            join users u on u.id = m.user_id
            {clause}
            order by m.created_at desc, m.id desc
            limit %s offset %s
            """,
            params + [per_page, (page - 1) * per_page],
        )
        rows = cur.fetchall()

    # Read off the number rather than selected: see country_of.
    for row in rows:
        row["country"] = country_of(row["phone"])

    return {"rows": rows, "total": total, "page": page, "per_page": per_page}


@app.get("/api/admin/metaid/stats")
def admin_metaid_stats(_: int = Depends(require_staff)) -> dict:
    """The queue in five numbers.

    Staff-wide rather than admin-only, and deliberately about MetaID requests
    and nothing else: /api/admin/stats counts registrations and real-account
    interest, which is GML's business, not newera's. A newera reviewer is here
    to answer requests, so this is what their dashboard is.
    """
    with pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            select
              count(*) filter (where status = 'pending')  as pending,
              count(*) filter (where status = 'approved') as approved,
              count(*) filter (where status = 'rejected') as rejected,
              count(*) filter (where created_at >= current_date) as today,
              count(*) as total
            from metaid_request
            """
        )
        return cur.fetchone()


# Declared after the stats route above so `stats` is never read as an id. They
# differ by method as well, but relying on that is a trap for whoever adds a
# GET here later.
@app.post("/api/admin/metaid/{request_id}")
def decide_metaid(
    request_id: int, entry: Decision, staff_id: int = Depends(require_staff)
) -> dict:
    """Approve or refuse one request.

    sp_decide_metaid owns every rule: only a pending row moves, only an admin
    or newera staff may move it, and two people clicking at once means the
    second UPDATE matches nothing. It answers false rather than raising for all
    of them, because from here they are the same answer -- this is not yours to
    decide any more.
    """
    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute(
            "CALL sp_decide_metaid(%s, %s, %s, %s)",
            (request_id, staff_id, entry.status, entry.note),
        )
        (ok,) = cur.fetchone()

    if not ok:
        raise HTTPException(409, "This request was already decided.")
    return {"id": request_id, "status": entry.status}


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

    assert ForgotPassword(email="alex@example.com").email == "alex@example.com"

    good = dict(uid=7, token=secrets.token_urlsafe(RESET_TOKEN_BYTES), password="12345678")
    assert ResetPassword(**good).uid == 7
    for bad in ({"token": "short"}, {"password": "1234567"}, {"uid": "seven"}):
        try:
            ResetPassword(**{**good, **bad})
        except ValidationError:
            continue
        raise AssertionError(f"accepted {bad}")

    # The token goes into a query string as it is, so it must not contain a
    # character that would have to be escaped to survive the trip.
    import string

    safe = set(string.ascii_letters + string.digits + "-_")
    assert all(
        set(secrets.token_urlsafe(RESET_TOKEN_BYTES)) <= safe for _ in range(50)
    ), "reset token needs escaping in a URL"

    # A doubled slash in the middle of a link is the classic way this breaks.
    assert not APP_ORIGIN.endswith("/")
    assert f"{APP_ORIGIN}/reset-password".count("//") == 1

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

    # A stored number carries its own country, which is why none is kept
    # beside it on `users`.
    assert country_of(Registration(**base).phone) == base["country"]
    assert country_of("+14155552671") == "US"
    assert country_of("not a number") is None

    assert ProfileUpdate(full_name="Ada Lovelace").full_name == "Ada Lovelace"
    for bad in ("A", "x" * 81):
        try:
            ProfileUpdate(full_name=bad)
        except ValidationError:
            continue
        raise AssertionError(f"accepted {bad!r} as a name")

    assert PasswordChange(current_password="a", new_password="12345678")
    try:
        PasswordChange(current_password="a", new_password="1234567")
    except ValidationError:
        pass
    else:
        raise AssertionError("accepted a short new password")

    assert Decision(status="approved").note is None
    assert Decision(status="rejected", note="no").status == "rejected"
    for bad in ("pending", "Approved", "", "approved; drop table"):
        try:
            Decision(status=bad)
        except ValidationError:
            continue
        raise AssertionError(f"accepted {bad!r} as a decision")

    # The queue is staff-wide; everything else behind require_admin is not.
    assert set(STAFF_ROLES) < set(SIGN_IN_ROLES)
    assert "end_user" not in STAFF_ROLES, "an entrant could reach the queue"
    # Each role reaches only its own panel. The queue is staff-wide, the
    # league is GML's, and neither admits the other.
    assert "gml_staff" not in STAFF_ROLES, "GML staff could reach the MetaID queue"
    assert set(SIGN_IN_ROLES) == {"admin", "newera_staff", "gml_staff", "end_user"}

    # A pool with no checkout check hands out connections the far end has
    # already dropped, and the request they land in answers 500. Asserted
    # rather than commented, because the failure only shows up after an idle
    # gap and is easy to reintroduce by editing the line above.
    assert pool._check is ConnectionPool.check_connection, "pool lost its liveness check"

    # The one property that matters about the echo switch: with it off, a code
    # never reaches the log. Checked by running the real sender and reading
    # what it wrote, not by trusting the branch above it.
    if not OTP_ECHO:
        import contextlib
        import io

        captured = io.StringIO()
        with contextlib.redirect_stderr(captured), contextlib.redirect_stdout(
            captured
        ):
            try:
                send_otp_email("nobody@example.com", "424242")
            except HTTPException:
                # No SMTP host in a self-check, which is the point: it got as
                # far as trying to send without ever printing.
                pass
        assert "424242" not in captured.getvalue(), "a code reached the log"
        assert not CAN_SEND_MAIL or SMTP_READY, "codes can be issued with no way to send"

    # The other half of the switch: with it on, a mail server that refuses the
    # send must not turn a printed code into a failed request. Checked against
    # a closed port, which is the cheapest stand-in for credentials a provider
    # has stopped accepting. Run whatever this machine's own settings are, so
    # the globals are restored afterwards.
    _saved = (OTP_ECHO, SMTP_READY, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD)
    OTP_ECHO, SMTP_READY = True, True
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD = "127.0.0.1", 9, "u", "p"
    try:
        import contextlib
        import io

        sink = io.StringIO()
        with contextlib.redirect_stderr(sink):
            send_otp_email("nobody@example.com", "424242")
        printed = sink.getvalue()
        assert "424242" in printed, "the echo did not print the code"
        assert "refused" in printed, "a refused send went unreported"
    finally:
        OTP_ECHO, SMTP_READY, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD = _saved

    # Two mail triggers, and only two: the confirmation code and the password
    # reset link. Everything else this app does writes a row and tells the
    # person on screen -- approving a MetaID sends nothing, and neither does a
    # real-account request. A screen that promises mail nobody sends is a
    # promise the product has to keep later.
    #
    # Asked of the compiled functions rather than described in a comment,
    # because a comment does not fail. Anything in this module that names
    # send_mail is by definition a thing that can put a message on the wire,
    # so the list below is the complete set and it is checked by name. A third
    # sender trips this and has to be a decision rather than an edit.
    _senders = sorted(
        name
        for name, obj in list(globals().items())
        if getattr(obj, "__module__", None) == __name__
        and hasattr(obj, "__code__")
        and "send_mail" in obj.__code__.co_names
    )
    assert _senders == ["send_otp_email", "send_reset_email"], (
        f"the things that send mail are now {_senders} -- there should be two, "
        "a confirmation code and a password reset link"
    )

    # The HTML part is an alternative to the plain text, never a replacement:
    # a client that refuses HTML must still get the code and the link.
    otp_html = render_email("h", "i", "o", code="123456")
    assert "123456" in otp_html and "<!doctype html>" in otp_html
    reset_html = render_email("h", "i", "o", link="https://x/y", link_label="Go")
    assert 'href="https://x/y"' in reset_html
    # No feature block when neither is given, rather than an empty box.
    assert "letter-spacing:10px" not in render_email("h", "i", "o")

    print("ok")

"""GMCL API: the public registration endpoints, accounts, and the admin panel.

Pydantic owns the shape (types, email format, phone validity for the chosen
country). `sp_register` owns the write and the duplicate rule. No SQL is
written here beyond the CALL.

One long-lived uvicorn process on the VPS, behind nginx. nginx proxies /api/
here with the path intact, so the routes below carry their own /api prefix and
nothing strips it -- see deploy/nginx.conf.

    python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
    psql "$DATABASE_URL" -f db/schema.sql
    psql "$DATABASE_URL" -f db/app_schema.sql
    for f in db/procedures/*.sql; do psql "$DATABASE_URL" -f "$f"; done
    psql "$DATABASE_URL" -f db/grants.sql
    .venv/bin/python scripts/seed_admin.py you@example.com

    .venv/bin/uvicorn --env-file .env api.index:app --reload --port 8000
    .venv/bin/python api/index.py    # validation self-check, no database needed

In production, bound to loopback and with workers, which is the whole of the
difference:

    .venv/bin/uvicorn --env-file .env api.index:app \
        --host 127.0.0.1 --port 8000 --workers 4
"""

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import smtplib
import ssl
import sys
import time
import urllib.error
import urllib.request
from datetime import date
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
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

# Sized for a long-lived process, which is what the VPS runs. The old numbers
# -- min_size=0, max_size=2 -- were for a serverless instance that served one
# request at a time and was frozen between them; here they would cap the whole
# worker at two concurrent queries and reopen a remote connection after every
# idle gap, at about 322ms of TCP and TLS each time.
#
# These are per worker, not per host: uvicorn --workers forks, and each child
# builds its own pool. The ceiling on Postgres is therefore workers x max, so
# both are named rather than typed in -- 4 workers x 10 is 40 against a default
# max_connections of 100, and the day either side of that changes it is an
# environment variable and not a deploy.
DB_POOL_MIN = int(os.environ.get("DB_POOL_MIN") or 2)
DB_POOL_MAX = int(os.environ.get("DB_POOL_MAX") or 10)

# timeout=5 so a database that is down fails the request in seconds rather than
# parking the worker for the 30s default.
#
# `check` is not optional here. Without it the pool hands out whatever it is
# holding, and a connection the far end has quietly dropped -- a NAT expiring
# an idle flow, a firewall culling an idle flow overnight, a Postgres restart
# -- only reveals itself as "server closed the connection unexpectedly" on the
# first query, which the caller sees as a 500. Postgres itself is not closing
# these: `idle_session_timeout` is 0 and keepalives do not start for two hours,
# so nothing on the server side will ever prevent it. A pool that now holds
# connections open for days rather than minutes meets this more often, not
# less.
#
# check_connection sends an empty query at checkout, so a dead connection is
# discarded and replaced before the request touches it. It costs one round trip
# per request -- about 20ms against this database, next to 322ms to open a
# fresh connection -- which is the price of the request not failing.
pool = ConnectionPool(
    DATABASE_URL,
    min_size=DB_POOL_MIN,
    max_size=DB_POOL_MAX,
    timeout=5,
    check=ConnectionPool.check_connection,
    open=False,
)

# Opened at import rather than in a lifespan handler, so the self-check at the
# bottom of this file and any unit test of the models can import the module
# without a database. Guarded, because min_size is no longer 0: opening with an
# empty DATABASE_URL would now try to connect.
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
# sp_issue_auth_token, because uvicorn forks a process per worker and an
# in-process counter would only guard the worker that happened to take the
# request -- four workers would be four resends. The database is the one thing
# all of them share.
OTP_RESEND_SECONDS = 60

# Confirmation codes are bypassed, not removed. Every piece of the machinery is
# still here and still works -- sp_issue_auth_token, sp_verify_otp,
# /api/verify-otp, /api/resend-otp, issue_otp and the screens that drive them.
# While this is False nothing on the signed-in path calls them: an account is
# settled the moment it is created and sign-in stops asking. Setting it True is
# the whole of turning codes back on, with no other edit anywhere.
#
# What it gives up is address ownership -- nobody proves the inbox they typed
# is theirs, so a typo'd or borrowed address makes a real account. It does not
# give up account access: the password is still what proves an account is
# yours at sign-in, and the password reset still goes to the address on file.
OTP_REQUIRED = False

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
# access can sign in with, and the service journal is readable by anyone with
# a shell on the box.
#
# Off unless it is explicitly turned on, so forgetting to unset it is not
# possible -- it has to be set to be dangerous. Never put OTP_ECHO in the
# server's .env.
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
        "[OTP_ECHO] Development only. Never set OTP_ECHO in the server's "
        ".env.",
        file=sys.stderr,
        flush=True,
    )


# GOC's check-user API, which answers whether an address is already connected
# to GOC Global Algo. Read from the environment for the same reasons the mail
# config is: a URL in the source outlives the deployment it was written for,
# and a key in the source is a key in the repository.
GML_CHECK_URL = os.environ.get("GML_CHECK_URL", "")
GML_CHECK_KEY = os.environ.get("GML_CHECK_KEY", "")

# Spelled the way GOC spells it, typo included. This is their header name, not
# ours, and a corrected copy is simply a header they do not read -- which
# comes back 401, not as a spelling complaint.
GML_CHECK_HEADER = "goc-gml-varification"

# Long enough for a round trip to another company's API, short enough that
# their bad day is not also a hung request on this side.
GML_CHECK_TIMEOUT = int(os.environ.get("GML_CHECK_TIMEOUT") or 8)

# Both halves or nothing. A URL without a key is answered 401 every time, and
# treating that as "the address is taken" would lock out every applicant. An
# unset config is a supported state: see real_email_available.
GML_CHECK_READY = bool(GML_CHECK_URL and GML_CHECK_KEY)

if not GML_CHECK_READY:
    print(
        "[GML] check-user is not configured (GML_CHECK_URL, GML_CHECK_KEY); "
        "no Real account request will be checked for duplicates.",
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


# Plain text, and only plain text. An HTML part buys nothing here -- both
# letters are a heading, a sentence and one secret -- and costs the things that
# matter: a dark themed table renders differently in every client, images and
# <style> get stripped, and a multipart/alternative message with a thin text
# part is a shape spam filters already distrust from a domain with no history.
#
# The width is 68 columns. Every client wraps somewhere, so the wrapping is
# done here, where it can be seen, rather than left to the reader's window.
MAIL_WIDTH = 68


def render_text(heading: str, intro: str, feature: str, outro: str) -> str:
    """The one shape both letters take.

    Underline is computed from the heading rather than typed under it, so the
    rule cannot drift out of alignment when the wording changes -- which is the
    only kind of misalignment plain text can actually have.
    """
    return "\n".join(
        [
            heading,
            "=" * len(heading),
            "",
            intro,
            "",
            feature,
            "",
            outro,
        ]
    )


# Both letters close the same way. The recipient line is not decoration: it is
# what tells someone forwarded a code that the code was not addressed to them.
MAIL_SIGNATURE = """\
--
Global Market League
Demo accounts only. No deposit required.

This message was sent to {to}."""


def send_mail(to_email: str, subject: str, body: str) -> None:
    """Mails one message. Raises HTTPException(502) if it cannot.

    Nothing is logged unless OTP_ECHO is on, which is a development switch and
    is off by default. Callers send inside their database transaction, so a
    failure here rolls the token back and the person can try again immediately
    rather than waiting out a resend window for a mail that never left.

    The two letters below build their own text and hand it here. Only the
    transport and the signature are shared, because only those are worth not
    writing twice.
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
    # EmailMessage adds neither of these and send_message does not either, so
    # without them the message goes out with no Date and no Message-ID. A
    # missing Date is one of the oldest spam heuristics there is, and a missing
    # Message-ID leaves the receiver nothing to thread or de-duplicate on.
    # The id is stamped with the sender's own domain so it aligns with From.
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain=SMTP_FROM_EMAIL.rsplit("@", 1)[-1].rstrip(">"))
    # Somewhere for a reply to land. A transactional address that bounces
    # replies is itself a negative reputation signal.
    msg["Reply-To"] = SMTP_FROM_EMAIL
    if EMAIL_CONFIGURATION_SET:
        msg["X-SES-CONFIGURATION-SET"] = EMAIL_CONFIGURATION_SET
    msg.set_content(f"{body}\n\n{MAIL_SIGNATURE.format(to=to_email)}\n")

    # Verified TLS, explicitly. Both smtplib entry points fall back to
    # ssl._create_stdlib_context() when handed no context, and that context is
    # check_hostname=False, verify_mode=CERT_NONE -- it encrypts, but it will
    # hand the password to whatever answers. create_default_context() is the
    # verifying one, and the password is the whole mail account.
    tls = ssl.create_default_context()

    try:
        if SMTP_PORT == 465:
            with smtplib.SMTP_SSL(
                SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT, context=tls
            ) as s:
                if SMTP_USER:
                    s.login(SMTP_USER, SMTP_PASSWORD)
                s.send_message(msg)
            return

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT) as s:
            s.ehlo()
            if s.has_extn("starttls"):
                s.starttls(context=tls)
                s.ehlo()
            elif SMTP_USER:
                # No encryption on offer and a password to send. Every
                # provider offers STARTTLS, so this is a misconfiguration or a
                # machine in the middle -- either way the password does not go
                # out. The certificate check above is the other half: without
                # it, offering STARTTLS is all an impostor has to do.
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
    """The confirmation code, indented so it reads as a value rather than as
    part of the sentence above it."""
    send_mail(
        to_email,
        "Confirm your Global Market League email",
        render_text(
            "Confirm your email address",
            "Enter this code to finish creating your account:",
            f"    {code}",
            f"The code expires in {OTP_TTL_MINUTES} minutes and can be used once.\n"
            "\n"
            "If you were not expecting this email you can ignore it. The code\n"
            "is useless without your account password.",
        ),
    )


def send_reset_email(to_email: str, link: str) -> None:
    """The reset link, flush to the left margin on a line of its own.

    Not indented, unlike the code above: leading whitespace is what stops
    several clients turning a URL into a link, and a reset link that has to be
    copied by hand is a reset nobody finishes.
    """
    send_mail(
        to_email,
        "Reset your Global Market League password",
        render_text(
            "Reset your password",
            "Open the link below to choose a new password:",
            link,
            f"The link expires in {RESET_TTL_MINUTES} minutes and can be used once.\n"
            "Your current password keeps working until you finish.\n"
            "\n"
            "If you did not ask for this you can ignore this email. The link\n"
            "is the only way in, and nobody else has it.",
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
    """Creates an end-user account and signs it in.

    With OTP_REQUIRED off the address is taken as settled at creation and the
    response carries a real session, so the account is usable immediately.
    Turn OTP_REQUIRED on and the old shape comes back: a pending cookie rather
    than a session, a mailed code, and /api/verify-otp trading one for the
    other -- a code that cannot be mailed takes the account with it, so nobody
    ends up owning an address they can neither confirm nor re-register.
    """
    if not DATABASE_URL or not SESSION_SECRET:
        raise HTTPException(503, "Sign-up is unavailable.")
    # Only asked when a code actually has to reach someone. Bypassed, sign-up
    # needs no mail at all and works with the mail config empty.
    if OTP_REQUIRED and not CAN_SEND_MAIL:
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
            if OTP_REQUIRED:
                issue_otp(cur, user_id, entry.email)
            else:
                # Nothing was sent and nothing will be answered, so the address
                # is settled here instead. coalesce so this is the same write
                # sp_verify_otp and sp_reset_password already make -- the
                # first confirmation wins and later ones leave it alone.
                cur.execute(
                    "update users set email_verified_at = coalesce("
                    "email_verified_at, now()) where id = %s",
                    (user_id,),
                )
    except errors.UniqueViolation as exc:
        # The index name says which, so a taken number is not reported as a
        # taken address. An address that exists but was never confirmed is
        # still taken: its owner finishes at sign-in, where the password
        # proves it is them.
        if exc.diag.constraint_name == "users_phone_key":
            raise HTTPException(409, "This phone number already has an account.")
        raise HTTPException(409, "This email already has an account.")

    if OTP_REQUIRED:
        set_cookie(
            response,
            PENDING_COOKIE,
            sign_session(user_id, "end_user", PENDING_TTL),
            PENDING_TTL,
        )
        return {"stage": "otp", "sent": True}

    # The same answer sign-in gives, because it is the same thing: a session
    # cookie and somewhere to go.
    set_cookie(
        response, SESSION_COOKIE, sign_session(user_id, "end_user"), SESSION_TTL
    )
    return {"stage": "session", "email": entry.email, "role": "end_user"}


class Login(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


# ponytail: no throttle on wrong passwords. An in-process counter is per worker
# and uvicorn runs several, so it would only ever guard a quarter of the
# attempts -- the cheap answer now that nginx is in front is a limit_req zone
# on this location, and the durable one is a per-email attempt column on
# `users`. Worth having the day this faces a weak password.
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
        # Bypassed, an unconfirmed address is not a reason to stop anyone: the
        # password has already proved the account is theirs, and no code is
        # coming that could settle it. This is also what lets the accounts
        # created before the bypass -- the ones still sitting at null -- sign
        # in at all, rather than waiting forever on a screen nobody shows.
        if verified is None and OTP_REQUIRED:
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
    new_password: str = Field(min_length=8, max_length=200)


@app.post("/api/change-password")
def change_password(entry: PasswordChange, user_id: int = Depends(require_user)) -> dict:
    """The session is the whole of the proof.

    This used to ask for the current password as well, on the grounds that a
    session left open on a shared machine should not be enough to take the
    account. That guard is gone by request: the profile screen now reveals the
    new-password fields behind a Reset button and asks nothing else. Whoever
    holds a live session can set a new password, and the person who did know
    the old one is not told about it.

    Two things still stand between a stolen cookie and this endpoint. The
    session cookie is httponly, so script on the page cannot read it, and it is
    samesite=lax, so a cross-site POST does not carry it. Neither helps against
    somebody sitting at an unlocked machine, which is the case this used to
    cover.

    Worth restoring, cheapest first: ask for the current password again, or
    send a code to the address on the account -- issue_otp and
    sp_issue_auth_token are already here for the signup and forgot-password
    flows and would need no new tables.

    ponytail: sessions are stateless, so this cannot sign other devices out --
    the same `session_epoch` gap sp_reset_password.sql already names. That gap
    matters more now than it did: a password change no longer proves the person
    making it is the account's owner, and it still cannot evict anyone.
    """
    with pool.connection() as conn, conn.cursor() as cur:
        # Still read first: `is_active` is the account being usable at all, and
        # a disabled one must not be able to set a password and walk back in.
        cur.execute("select 1 from users where id = %s and is_active", (user_id,))
        if cur.fetchone() is None:
            raise HTTPException(401, "Not signed in.")
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


# --- accounts newera issued before this app existed ---------------------------
#
# `registration` and `real_account_request` are the two landing-page forms,
# filled in before there was anything to sign into. `is_id_given` says whether
# newera has since created the trading account for that address; it is
# backfilled from their account-created exports by db/backfill_is_id_given.sql.
#
# Somebody who filled in one of those forms and later signs up here has already
# been answered. Sending them through /request-metaid would be asking newera to
# issue a second account for an address that already has one, so the answer
# they already hold is read straight off those two tables instead.
#
# Read, never written. No metaid_request row is created for these: nobody in
# this system decided anything, and metaid_request_decision_complete rightly
# refuses an approved row with no decider named against it. The cost is that
# these approvals never reach the admin queue, which is correct -- there was no
# request to queue.
#
# Matched on the address the account signed up with. Signup does not finish
# until the OTP sent to that address is answered, so the match is against an
# address the person has already proved is theirs.
IMPORTED_APPROVALS = """
    select u.id as user_id, u.phone, 'demo' as type, r.email, r.created_at
      from registration r
      join users u on lower(u.email) = lower(r.email)
     where u.id = %(user_id)s and r.is_id_given = 'YES'
     union all
    select u.id, u.phone, 'real', a.email, a.created_at
      from real_account_request a
      join users u on lower(u.email) = lower(a.email)
     where u.id = %(user_id)s and a.is_id_given = 'YES'
"""


@app.get("/api/metaid")
def list_metaid(user_id: int = Depends(require_user)) -> dict:
    """Every request this person has made, newest first, so the dashboard can
    show the latest of each kind.

    `phone` is joined from `users` rather than stored on the row, so a
    corrected number reads corrected on every request the person ever made.
    Same shape the admin queue will want, minus the `where`.

    An account newera already issued is folded in here as a row of the same
    shape, so the screens stay a function of this one list and need to know
    nothing about where a given answer came from. Its `id` is null -- there is
    no row to decide against, which is the whole point of it.

    `precedence` puts those first. The screens read the first row of a kind as
    the current one, and an account that demonstrably exists outranks whatever
    this system last recorded about it: a pending request for an account newera
    has already created is answered, and a rejection they later overrode by
    creating it is out of date.
    """
    with pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            select id, user_id, phone, type, email, status,
                   decision_note, created_at, decided_at
            from (
                select m.id, m.user_id, u.phone, m.metaid_type as type,
                       m.email, m.status, m.decision_note, m.created_at,
                       m.decided_at, 1 as precedence
                from metaid_request m
                join users u on u.id = m.user_id
                where m.user_id = %(user_id)s
                union all
                select null::bigint, i.user_id, i.phone, i.type, i.email,
                       'approved'::text, null::text, i.created_at,
                       null::timestamptz, 0
                from ({IMPORTED_APPROVALS}) i
            ) t
            order by precedence, created_at desc, id desc
            """,
            {"user_id": user_id},
        )
        rows = cur.fetchall()
    return {"rows": rows}


def said_yes(value: object) -> bool:
    """One GOC flag, read as a match.

    Their fields are the strings "Yes" and "no". Anything else -- a missing
    field, a body that is not theirs -- is not a match: an unfamiliar answer is
    no evidence that an account exists, and inventing a third state for it only
    pushes the question up to a caller with even less to go on.
    """
    return str(value).strip().lower() == "yes"


def national_digits(phone: str) -> str:
    """`+919876543210` -> `9876543210`.

    GOC's spec shows a bare ten-digit number, so that is what goes out. This
    side stores E.164, which is the same number with a country code welded on
    the front, and sending it verbatim would be a string their records cannot
    match -- the failure being silent, since a non-match reads exactly like an
    honest "no such user".

    Falls back to the digits as given. A number that will not parse is already
    past the validator that put it in the database, so this is for the shape
    of a stored value changing, not for user input.
    """
    try:
        return phonenumbers.national_significant_number(phonenumbers.parse(phone, None))
    except phonenumbers.NumberParseException:
        return re.sub(r"\D", "", phone)


def goc_check_user(email: str, phone: str) -> dict:
    """One POST to GOC's check-user. Raises rather than guessing.

    Every failure is an error here, never a quiet "no match": a refused key, a
    rejected body, a timeout, a reply that is not JSON. The caller is deciding
    whether to file an account request, and a check that could not be made is
    not a check that passed -- answering False would file the duplicate this
    call exists to stop.

    502 rather than the code GOC gave us. Their 401 is about our key and their
    400 is about our body; neither is a sentence to put in front of somebody
    asking for a trading account, and our own 401 already means "sign in".

    stdlib rather than a client library: one POST, one header.
    """
    body = json.dumps({"mobileNumber": national_digits(phone), "email": email})
    req = urllib.request.Request(
        GML_CHECK_URL,
        data=body.encode(),
        method="POST",
        headers={
            GML_CHECK_HEADER: GML_CHECK_KEY,
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=GML_CHECK_TIMEOUT) as res:
            payload = json.loads(res.read())
    except urllib.error.HTTPError as exc:
        # 401 is our key and 400 is our body -- both are configuration, both
        # will happen on every call until someone fixes them, and the symptom
        # on the screen is only "try again". Worth saying plainly here.
        note = {
            401: "check GML_CHECK_KEY",
            400: "neither mobileNumber nor email reached them",
        }.get(exc.code, "unexpected reply")
        print(
            f"[GML] check-user returned {exc.code} ({note}).",
            file=sys.stderr,
            flush=True,
        )
        raise HTTPException(502, "We could not check your details. Try again.") from exc
    except (urllib.error.URLError, OSError, ValueError) as exc:
        # Class name only: the text of a transport error carries the host it
        # could not reach, and the log is not the place to widen that.
        print(
            f"[GML] check-user did not answer ({exc.__class__.__name__}).",
            file=sys.stderr,
            flush=True,
        )
        raise HTTPException(502, "We could not check your details. Try again.") from exc

    if not isinstance(payload, dict):
        raise HTTPException(502, "We could not check your details. Try again.")
    return payload


def goc_duplicates(email: str, phone: str) -> dict:
    """Which of the two identifiers GOC already holds an account against.

    Both flags are read from the body rather than from `status`, which is
    "Connected" when *either* input matched and so cannot say which. GOC's own
    sample (b) is exactly that case: a phone on record, an address that is not.

    No configuration means no duplicates, which is the state every environment
    without GOC's key is in -- the same answer this gave before the endpoint
    existed. The API says so on stderr at startup so it is not mistaken for a
    check that passed.
    """
    if not GML_CHECK_READY:
        return {"phone_taken": False, "email_taken": False}
    payload = goc_check_user(email, phone)
    return {
        "phone_taken": said_yes(payload.get("mobileNumber")),
        "email_taken": said_yes(payload.get("email")),
    }


def phone_of(user_id: int) -> str:
    """The account's own number, read here rather than accepted from the page.

    A duplicate check the caller can choose the inputs for is not a check. The
    address is the browser's to choose -- that is the whole of what the dialog
    asks for -- but the number is the account's.
    """
    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute("select phone from users where id = %s", (user_id,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(401, "Not signed in.")
    return row[0]


def email_of(user_id: int) -> str:
    """The address this account signs in with, for the same reason as phone_of:
    what a Real request is checked against must not be the caller's to pick."""
    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute("select email from users where id = %s", (user_id,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(401, "Not signed in.")
    return row[0]


class MetaidCheck(BaseModel):
    email: EmailStr


@app.post("/api/metaid/check")
def check_metaid_email(entry: MetaidCheck, user_id: int = Depends(require_user)) -> dict:
    """Asked when Confirm is pressed, because the answer changes what the
    dialog says next rather than whether a request failed.

    Two flags rather than one verdict: the dialog names the identifier that
    matched, and only the two of them together can say "both".

    Demo never comes here: it is issued against the account's own address and
    has nothing to check.
    """
    return goc_duplicates(entry.email, phone_of(user_id))


@app.post("/api/metaid", status_code=201)
def request_metaid(
    entry: MetaidRequest, user_id: int = Depends(require_user)
) -> dict:
    # Asked again here, not only on the screen. /api/metaid/check is advisory:
    # a caller can skip it, answer it themselves, or race it. This is the one
    # that decides whether a row is written, and it runs before the insert, so
    # a refusal leaves nothing behind.
    if entry.type == "real":
        # A Real account is opened against a second address, never the one this
        # account signs in with. The dialog says so and refuses it on Confirm;
        # this is the copy of that rule which decides, since a POST need not
        # come from the dialog. Compared lower-cased because sp_signup folds
        # the stored address and the request body is whatever was typed.
        if entry.email.strip().lower() == email_of(user_id).strip().lower():
            raise HTTPException(409, "This email is already in use.")

        dup = goc_duplicates(entry.email, phone_of(user_id))
        if dup["phone_taken"] or dup["email_taken"]:
            raise HTTPException(409, "These details already have a newera account.")

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


# --- the league ---------------------------------------------------------------
#
# Getting a MetaID and entering the league are two steps on purpose. The first
# is Newera answering for an address; the second is this product recording who
# is playing. Only the second is ours, which is why `league_entry` holds the
# MetaID and `metaid_request` never does.


# A MetaID is four to six digits, e.g. 43563. Newera's format, not ours, so
# the rule is written down once here and mirrored by a check constraint on
# league_entry -- the API is not the only thing that will ever hold that
# connection.
METAID_RE = re.compile(r"^[0-9]{4,6}$")


class LeagueJoin(BaseModel):
    """The whole of what the League screen posts."""

    # Generous next to the real rule below: this only stops a megabyte of
    # string reaching the regex. Surrounding spaces are trimmed after it, so
    # the allowance has to leave room for them.
    metaid: str = Field(min_length=1, max_length=32)

    @model_validator(mode="after")
    def check(self):
        """Trimmed first, then matched. A pattern on the field itself would run
        before the trim and reject " 43563 ", which a person pasting an ID out
        of an email will produce every time."""
        self.metaid = self.metaid.strip()
        if not METAID_RE.match(self.metaid):
            raise ValueError("a MetaID is 4 to 6 digits")
        return self


@app.get("/api/league")
def my_league_entries(user_id: int = Depends(require_user)) -> dict:
    """Every entry the caller holds, and whether they may make another.

    A list because one person may enter more than one account -- newera issues
    a number per account, and a demo and a real one are two of them.

    `can_join` used to answer whether newera had approved an account for this
    person. Nobody is refused now -- getting an account and entering the league
    run alongside each other rather than in order -- so it is true for everyone
    who is signed in.

    Kept rather than removed because the dashboard reads it to decide whether
    to offer the League link, and a constant here is a smaller change than
    teaching that screen the rule is gone. It is dead weight the day that
    screen stops asking.
    """
    with pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "select id, metaid, email, created_at from league_entry "
            "where user_id = %s order by created_at, id",
            (user_id,),
        )
        entries = cur.fetchall()
    return {"entries": entries, "can_join": True}


@app.post("/api/league", status_code=201)
def join_league(entry: LeagueJoin, user_id: int = Depends(require_user)) -> dict:
    """Enters the caller into the league under the MetaID they typed.

    The address is not read from the request body: sp_join_league takes the
    one the MetaID was approved against, so the browser cannot decide what is
    recorded against a person.

    This used to refuse anybody without an approved metaid_request, on the
    reading that getting an account was step one and entering the league was
    step two. That is not how the product runs -- the two happen alongside each
    other, and people arrive holding numbers newera issued through channels
    this system never saw, which is where the entries that already existed
    without a matching request came from. Refusing them was the bug, not the
    entries.

    What still holds: the number must match METAID_RE, and the unique index on
    (user_id, metaid) still refuses the same account twice.
    """
    try:
        with pool.connection() as conn, conn.cursor() as cur:
            cur.execute("CALL sp_join_league(%s, %s)", (user_id, entry.metaid))
            (row_id,) = cur.fetchone()
    except errors.UniqueViolation:
        # The index is on (user_id, metaid) now, so this is the same number
        # twice rather than a second entry of any kind.
        raise HTTPException(409, "That account is already entered in the league.")
    return {"id": row_id}


@app.patch("/api/league/{entry_id}")
def edit_league_entry(
    entry_id: int, entry: LeagueJoin, user_id: int = Depends(require_user)
) -> dict:
    """Corrects the account number on one entry.

    The same body as joining, because the same single thing is being said. The
    entry is found by id and owner together inside the procedure -- an id
    reaching this endpoint came out of a browser, and on its own it is a
    number anyone can type.

    Editing rather than replacing: the row keeps its address and its joined
    date, which is what makes this a correction and not a new entry.
    """
    try:
        with pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "CALL sp_edit_league_metaid(%s, %s, %s)",
                (user_id, entry_id, entry.metaid),
            )
            (row_id,) = cur.fetchone()
    except errors.UniqueViolation:
        raise HTTPException(409, "That account is already entered in the league.")
    if row_id is None:
        raise HTTPException(404, "No such entry.")
    return {"id": row_id}


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

    # Four to six digits, and the trim happens before the match so a pasted
    # ID with spaces around it is accepted rather than bounced.
    assert LeagueJoin(metaid="4356").metaid == "4356"
    assert LeagueJoin(metaid="  43563  ").metaid == "43563"
    assert LeagueJoin(metaid="435631").metaid == "435631"
    for bad in ("435", "4356312", "", "   ", "43a63", "NW-4356", "4356.1", "-4356"):
        try:
            LeagueJoin(metaid=bad)
        except ValidationError:
            continue
        raise AssertionError(f"accepted {bad!r} as a MetaID")

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

    # Plain text only, and the secret has to survive it. Nothing here renders
    # markup, so the code and the link are the message rather than a fallback
    # from one.
    body = render_text("Confirm your email address", "intro", "    123456", "outro")
    assert "123456" in body and "<" not in body, "the code did not survive the body"
    # The rule under the heading is generated, so it cannot drift out of line.
    lines = body.splitlines()
    assert lines[1] == "=" * len(lines[0]), "the heading rule is out of alignment"
    # No line the reader has to scroll sideways to finish, the link excepted --
    # a URL is one token and wrapping it breaks it.
    reset = render_text("Reset your password", "intro", "https://x/y", "outro")
    assert all(len(ln) <= MAIL_WIDTH for ln in reset.splitlines() if " " in ln), (
        "a prose line runs past the wrap width"
    )

    # GOC's three documented bodies, verbatim from their spec, read as the two
    # flags the dialog needs.
    reads = lambda b: (said_yes(b.get("mobileNumber")), said_yes(b.get("email")))

    assert reads({"status": "Connected", "mobileNumber": "Yes", "email": "Yes"}) == (
        True,
        True,
    )
    # Their sample (b): the phone matched and the address did not. "Connected"
    # overall, free as an address -- the case reading `status` would get wrong.
    assert reads({"status": "Connected", "mobileNumber": "Yes", "email": "no"}) == (
        True,
        False,
    )
    assert reads({"status": "notconnected", "mobileNumber": "no", "email": "no"}) == (
        False,
        False,
    )
    # Nothing to read is not a match.
    assert reads({}) == (False, False)
    assert reads({"message": "Invalid verification key."}) == (False, False)

    # What goes out as mobileNumber is the bare number GOC's spec shows, not
    # the E.164 this side stores.
    assert national_digits("+919876543210") == "9876543210"
    assert national_digits("+14155552671") == "4155552671"
    assert national_digits("not a number") == ""

    print("ok")

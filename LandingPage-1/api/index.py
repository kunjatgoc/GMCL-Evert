"""GMCL registration API. One endpoint, one procedure call.

Pydantic owns the shape (types, email format, phone validity for the chosen
country). `sp_register` owns the write and the duplicate rule. No SQL is
written here beyond the CALL.

The file is named index.py because Vercel routes a Python function by its
path; vercel.json rewrites every /api/* request onto it and FastAPI still
sees the original path.

    python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
    psql "$DATABASE_URL" -f api/schema.sql
    for f in api/procedures/*.sql; do psql "$DATABASE_URL" -f "$f"; done
    psql "$DATABASE_URL" -f api/grants.sql

    .venv/bin/uvicorn --env-file .env api.index:app --reload --port 8000
    .venv/bin/python api/index.py    # validation self-check, no database needed
"""

import os
from typing import Literal

import phonenumbers
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from psycopg import errors
from psycopg_pool import ConnectionPool
from pydantic import BaseModel, EmailStr, Field, ValidationError, model_validator

# Read lazily so the module imports without a database — the self-check below
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
# socket it may never use — the database is remote, so every connection costs
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
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)


class Registration(BaseModel):
    """Exactly the JSON the form posts. Field names match `src/lib/schema.ts`."""

    fullName: str = Field(min_length=2, max_length=80)
    email: EmailStr
    country: str = Field(min_length=2, max_length=2)
    phone: str
    accountType: Literal["demo", "real", "both"]

    @model_validator(mode="after")
    def normalise_phone(self):
        """The browser already checked this. Check it again — the endpoint is
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


# ponytail: no rate limit or bot check on a public POST — deliberate, deferred.
# Add a honeypot field and a per-IP window in sp_register when the spam starts.
@app.post("/api/register", status_code=201)
def register(entry: Registration) -> dict:
    if not DATABASE_URL:
        raise HTTPException(503, "Registration is temporarily unavailable.")

    try:
        with pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "CALL sp_register(%s, %s, %s, %s, %s)",
                (
                    entry.fullName,
                    entry.email,
                    entry.phone,
                    entry.country.upper(),
                    entry.accountType,
                ),
            )
            (registration_id,) = cur.fetchone()
    except errors.UniqueViolation:
        raise HTTPException(409, "That email is already registered.")

    return {"id": registration_id}


if __name__ == "__main__":
    base = dict(
        fullName="Alex Mercer",
        email="alex@example.com",
        country="IN",
        phone="9876543210",
        accountType="demo",
    )
    assert Registration(**base).phone == "+919876543210"

    for bad in ({"country": "GB"}, {"accountType": "vip"}, {"email": "alex@"}):
        try:
            Registration(**{**base, **bad})
        except ValidationError:
            continue
        raise AssertionError(f"accepted {bad}")

    print("ok")

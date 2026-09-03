"""Create or reset the admin account. Run once, then again only to change the
password.

The password is never an argument: it is prompted for, so it stays out of the
shell history, out of `ps`, and out of this repository.

    .venv/bin/python scripts/seed_admin.py kunj.goc@gmail.com

A new account is not confirmed yet, so this also mails it a six-digit code.
The code is entered at the first sign-in, once, and the address is settled from
then on. Without SMTP configured the account is still created -- the script
says so, and the first sign-in sends the code instead.

Requires DATABASE_URL in the environment (or `set -a; . ./.env; set +a`) and
db/app_schema.sql already applied.
"""

import getpass
import os
import pathlib
import sys

import psycopg

# Everything to do with the code and the hash lives with the endpoint that
# checks them, so the two can never drift apart into a format the other cannot
# read.
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "api"))
from index import (  # noqa: E402
    OTP_TTL_MINUTES,
    SESSION_SECRET,
    SMTP_HOST,
    hash_password,
    issue_otp,
)


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2

    email = sys.argv[1].strip().lower()
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        print("DATABASE_URL is not set.")
        return 2

    password = getpass.getpass(f"Password for {email}: ")
    if password != getpass.getpass("Repeat: "):
        print("Passwords do not match.")
        return 1
    if len(password) < 8:
        print("Use at least 8 characters.")
        return 1

    with psycopg.connect(url, connect_timeout=10) as conn, conn.cursor() as cur:
        cur.execute(
            """
            insert into users (email, password_hash, role_id)
            values (%s, %s, (select id from user_roles where name = 'admin'))
            on conflict (lower(email)) do update
                set password_hash = excluded.password_hash,
                    role_id       = excluded.role_id,
                    is_active     = true
            returning id, (xmax = 0) as created, email_verified_at is null
            """,
            (email, hash_password(password)),
        )
        user_id, created, unconfirmed = cur.fetchone()

        # Committed before anything else is attempted: the account is the point
        # of this script, and a mail server having a bad day must not undo it.
        conn.commit()
        print(f"{'created' if created else 'updated'} admin #{user_id} {email}")

        if not unconfirmed:
            print("address already confirmed, no code sent")
            return 0

        if not SMTP_HOST or not SESSION_SECRET:
            print(
                "SMTP_HOST or SESSION_SECRET is not set, so no code went out.\n"
                "The first sign-in will send one."
            )
            return 0

        # The token is rolled back with a failed send, so the next attempt is
        # not blocked for a minute by a code that never left the building.
        try:
            sent = issue_otp(cur, user_id, email)
        except Exception as exc:  # noqa: BLE001 -- whatever SMTP threw
            conn.rollback()
            print(f"the account is ready, but the code could not be sent: {exc}")
            print("The first sign-in will send another.")
            return 0

        if not sent:
            print("a code was sent moments ago, so this run sent none")
            return 0

    print(
        f"a confirmation code is on its way to {email}; "
        f"it expires in {OTP_TTL_MINUTES} minutes"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

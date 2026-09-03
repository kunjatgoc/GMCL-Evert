"""Create or reset a staff account. Run once, then again only to change the
password or the role.

The password is never an argument: it is prompted for, so it stays out of the
shell history, out of `ps`, and out of this repository.

    .venv/bin/python scripts/seed_admin.py kunj.goc@gmail.com
    .venv/bin/python scripts/seed_admin.py reviewer@newera.example newera_staff

The role defaults to `admin`. Only the roles that can actually sign in are
accepted -- seeding an account into a role with no screen behind it produces
someone who can authenticate and reach nothing.

The account is confirmed on the spot, and no code is mailed. Running this
means holding the database credential, which is a stronger claim on the
address than a six-digit code in an inbox; the code exists for people signing
themselves up at /signup, who hold neither.

Requires DATABASE_URL in the environment (or `set -a; . ./.env; set +a`) and
db/app_schema.sql already applied.
"""

import getpass
import os
import pathlib
import sys

import psycopg

# The hash format lives with the endpoint that checks it, so the two can never
# drift apart into something the other cannot read.
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "api"))
from index import hash_password  # noqa: E402


def main() -> int:
    if len(sys.argv) not in (2, 3):
        print(__doc__)
        return 2

    email = sys.argv[1].strip().lower()
    role = (sys.argv[2].strip().lower() if len(sys.argv) == 3 else "admin")
    if role not in ("admin", "newera_staff", "gml_staff"):
        print(f"Unknown role {role!r}. Use admin, newera_staff or gml_staff.")
        return 2
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
            insert into users (email, password_hash, role_id, email_verified_at)
            values (%s, %s, (select id from user_roles where name = %s), now())
            on conflict (lower(email)) do update
                set password_hash     = excluded.password_hash,
                    role_id           = excluded.role_id,
                    is_active         = true,
                    -- coalesce, not excluded: a re-run to change the password
                    -- must not move the date the address was first confirmed.
                    email_verified_at = coalesce(users.email_verified_at, now())
            returning id, (xmax = 0) as created
            """,
            (email, hash_password(password), role),
        )
        user_id, created = cur.fetchone()
        conn.commit()

    print(f"{'created' if created else 'updated'} {role} #{user_id} {email}")
    print("address confirmed; sign in with the password alone")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

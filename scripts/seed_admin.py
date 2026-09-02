"""Create or reset the admin account. Run once, then again only to change the
password.

The password is never an argument: it is prompted for, so it stays out of the
shell history, out of `ps`, and out of this repository.

    .venv/bin/python scripts/seed_admin.py kunj.goc@gmail.com

Requires DATABASE_URL in the environment (or `set -a; . ./.env; set +a`) and
db/admin_schema.sql already applied.
"""

import getpass
import os
import pathlib
import sys

import psycopg

# hash_password lives with the code that verifies it, so the two can never
# drift apart into a format the login endpoint cannot read.
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "api"))
from index import hash_password  # noqa: E402


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
            returning id, (xmax = 0) as created
            """,
            (email, hash_password(password)),
        )
        user_id, created = cur.fetchone()

    print(f"{'created' if created else 'updated'} admin #{user_id} {email}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

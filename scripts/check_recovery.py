"""Walks the two ways back into an account, against a running API.

    OTP_ECHO=1 .venv/bin/uvicorn --env-file .env api.index:app --port 8000
    .venv/bin/python scripts/check_recovery.py

One: signing up and then losing the pending cookie -- a closed tab, ten minutes
-- left the account unreachable, because /api/signup answered 409 for the
address, /api/resend-otp had no cookie to read, and /api/login refused an
unconfirmed address outright. Sign-in now re-issues the code.

Two: forgetting the password was the same dead end by another door, with no
endpoint at all behind /api/forgot-password.

Stdlib only, and it needs the server and its database. The reset half also
needs OTP_ECHO=1, because reading the link back is the only way to prove the
whole round trip. The unit checks that need none of this are in `api/index.py`
and `test/submit.test.ts`.
"""

import json
import os
import pathlib
import re
import sys
import time
import urllib.error
import urllib.request

BASE = os.environ.get("API_BASE", "http://localhost:8000")


def refuse_to_send_real_mail() -> None:
    """Stop when the server would put these test addresses through real SMTP.

    Every account this script makes is @example.com, which is reserved and
    bounces every time. A hard bounce is charged against the sending domain's
    reputation, so running this against a configured SES host quietly damages
    the thing it is checking. Comment SMTP_HOST out for local work -- OTP_ECHO
    stands in for the mail server, which is what it is for.
    """
    if os.environ.get("ALLOW_REAL_MAIL") == "1":
        return
    try:
        env = pathlib.Path(".env").read_text()
    except OSError:
        return
    creds = {
        line.split("=", 1)[0].strip()
        for line in env.splitlines()
        if "=" in line
        and not line.strip().startswith("#")
        and line.split("=", 1)[1].strip()
    }
    if {"SMTP_USER", "SMTP_PASSWORD"} <= creds:
        sys.exit(
            "SMTP credentials are set, so this would send real mail to "
            "@example.com addresses and bounce every one.\n"
            "Comment SMTP_USER and SMTP_PASSWORD out in .env (OTP_ECHO covers "
            "local runs), or set ALLOW_REAL_MAIL=1 if you mean it."
        )


refuse_to_send_real_mail()


def post(path: str, body: dict, cookie: str = "") -> tuple[int, dict, str]:
    """`(status, body, the cookies it set)`. Cookies are carried by hand
    because the point of the check is which ones come back."""
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", **({"Cookie": cookie} if cookie else {})},
        method="POST",
    )
    try:
        res = urllib.request.urlopen(req, timeout=15)
    except urllib.error.HTTPError as exc:
        res = exc
    except OSError as exc:
        sys.exit(f"cannot reach {BASE}: {exc}. Is the API running?")

    set_cookie = "; ".join(
        c.split(";", 1)[0] for c in (res.headers.get_all("Set-Cookie") or [])
    )
    try:
        parsed = json.loads(res.read() or b"{}")
    except ValueError:
        parsed = {}
    return res.status, parsed, set_cookie


stamp = int(time.time())
email = f"resend-check-{stamp}@example.com"
account = {
    "fullName": "Resend Check",
    "email": email,
    "phone": f"+9198{stamp % 100_000_000:08d}",
    "country": "IN",
    "password": "check-password-123",
}

status, body, _ = post("/api/signup", account)
assert status == 201 and body.get("stage") == "otp", (status, body)

# The pending cookie signup handed back is thrown away here, which is the whole
# scenario: the person closed the tab, or took longer than ten minutes.

status, body, cookies = post(
    "/api/login", {"email": email, "password": account["password"]}
)
assert status == 200, f"sign-in refused an unconfirmed address: {status} {body}"
assert body.get("stage") == "otp", body
assert body.get("sent") is False, "a second code went out inside the resend window"
assert "gmcl_pending=" in cookies, f"sign-in issued no pending cookie: {cookies!r}"
assert "gmcl_session=" not in cookies, "an unconfirmed address was given a session"

# And the cookie it issued is a real one: the confirmation step can act on it.
status, body, _ = post("/api/resend-otp", {}, cookies)
assert status == 429, f"expected the resend guard, got {status} {body}"

status, body, _ = post("/api/verify-otp", {"code": "000000"}, cookies)
assert status == 401 and "wrong or has expired" in body.get("detail", ""), (status, body)

print(f"ok -- {email} can still be confirmed from the sign-in screen")


# --- and the same account, having forgotten the password ---------------------
#
# Reading the link back needs the server's own output, so this half is skipped
# rather than half-run when the echo switch is off.
log = os.environ.get("API_LOG", "")
if not log or not os.path.exists(log):
    print("skipped the reset half -- set API_LOG to the server's log to run it")
    raise SystemExit(0)

with open(log) as fh:
    fh.seek(0, 2)
    mark = fh.tell()

status, body, _ = post("/api/forgot-password", {"email": email})
assert status == 200 and body == {"ok": True}, (status, body)

status, unknown, _ = post("/api/forgot-password", {"email": f"no-such-{stamp}@example.com"})
assert (status, unknown) == (200, body), "an unknown address answered differently"

time.sleep(0.5)
with open(log) as fh:
    fh.seek(mark)
    fresh = fh.read()

link = re.search(r"/reset-password\?uid=(\d+)&token=([A-Za-z0-9_-]+)", fresh)
assert link, "no reset link reached the log -- is OTP_ECHO=1 set?"
uid, token = link.group(1), link.group(2)
assert f"no-such-{stamp}" not in fresh, "a link went to an address with no account"

new_password = "a-brand-new-password-1"
status, body, _ = post(
    "/api/reset-password", {"uid": uid, "token": token, "password": new_password}
)
assert status == 200, f"the link was refused: {status} {body}"

# Once, and only once.
status, body, _ = post(
    "/api/reset-password", {"uid": uid, "token": token, "password": "another-one-2"}
)
assert status == 401, f"a spent link was accepted again: {status} {body}"

status, body, cookies = post("/api/login", {"email": email, "password": new_password})
assert status == 200 and body.get("stage") == "session", (status, body)
assert "gmcl_session=" in cookies, cookies

status, body, _ = post("/api/login", {"email": email, "password": account["password"]})
assert status == 401, "the old password still works"

print(f"ok -- {email} recovered its password and the spent link is dead")

"""Walks the one path that used to strand an account, against a running API.

    .venv/bin/uvicorn --env-file .env api.index:app --reload --port 8000
    .venv/bin/python scripts/check_signin_resends.py

Signing up and then losing the pending cookie -- a closed tab, ten minutes --
left the account unreachable: /api/signup answered 409 for the address,
/api/resend-otp had no cookie to read, and /api/login refused an unconfirmed
address outright. Sign-in now re-issues the code, so the account is finishable.

Stdlib only, and it needs the server and its database. The unit checks that
need neither are in `api/index.py` and `test/submit.test.ts`.
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request

BASE = os.environ.get("API_BASE", "http://localhost:8000")


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

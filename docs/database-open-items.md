# Database: open items

Written 2 September 2026, after `db/app_schema.sql` and its procedures went in.
Nothing here blocks the schema that exists -- these are the things standing
between it and a database anyone would call finished. Roughly in the order
worth doing.

---

## 1. The API connects as the table owner

`DATABASE_URL` holds `uranustechlabs`, which owns every table. The
least-privilege role `grants.sql` was written for -- `gmcl_api` -- exists in the
database and is not used by anything.

**Why it matters.** The credential in `DATABASE_URL` is the whole perimeter:
Vercel has no fixed egress IP, so Postgres accepts connections from anywhere and
`pg_hba.conf` cannot narrow it. Leaked today, that string reads and writes every
table, password hashes and live MetaID queue included. The header of
`db/grants.sql` claims the API cannot read a row. That has not been true since
the admin panel shipped.

**Why it is still open.** The panel runs `select ... from registration` and the
other lists directly -- the filters are dynamic and a procedure per filter
combination would be a worse trade. `gmcl_api` has no `SELECT`, so switching the
connection string today breaks the panel.

**The fix.** Grant `gmcl_api` `SELECT` on `registration`,
`real_account_request`, `metaid_request`, `user_roles` and `users`, then change
`DATABASE_URL` in `.env` and in the Vercel project. Read access to `users` still
exposes password hashes, so consider column-level grants, or move the login
lookup behind a procedure that returns only what the check needs.

**Needs a decision** -- it changes the identity the live site connects as, so it
wants a deliberate cutover rather than a quiet edit.

---

## 2. `sslmode` is not pinned

The live connection is TLS 1.3 today (checked against `pg_stat_ssl`), but
`DATABASE_URL` sets no `sslmode`, so libpq uses `prefer`: it will encrypt if the
server offers it and fall back to plaintext without a word if it does not.

**The fix.** Append `?sslmode=require` to `DATABASE_URL` in `.env` and in the
Vercel environment. `verify-full` is better still, but needs the server's CA
certificate distributed with the function.

---

## 3. Connection pool ceiling

`api/index.py` opens a pool with `max_size=2` and there is no PgBouncer in
front of Postgres. One Vercel instance is fine; a signup spike multiplies
instances, and each one takes up to two connections until Postgres refuses the
next.

**The fix.** A pooled connection string -- a PgBouncer in front of the current
host, or the pooled endpoint if the database ever moves to a managed provider.
No code change; it is the same URL with a different port.

Carried over from the stack review on 2 September 2026.

---

## 4. Forgot password and MetaID approval are not built

Done: signing up at `/signup` mails a six-digit code over SMTP and no session
is issued until it is answered. Sign-in never mails anything -- it is a
password, and an unconfirmed address is refused. An admin made by
`scripts/seed_admin.py` is confirmed on the spot. The dashboard opens MetaID
requests through `sp_request_metaid`.

Still missing, and deliberately so: forgot password, and the admin endpoint
that settles a request. `sp_reset_password` and `sp_decide_metaid` are written
and tested; nothing calls them.

**One gap this leaves.** Someone who closes the tab during signup, before
answering the code, owns an account they cannot sign in to and cannot
re-register (the address is taken). There is no self-serve way back. Today the
fix is one UPDATE by hand:

```sql
update users set email_verified_at = now() where email = 'them@example.com';
```

Worth a real recovery path -- re-entering the confirm step from `/signup` on a
matching password -- if it happens to anyone in practice.

---

## 5. No rate limit on resend or on login

Done for mail: `sp_issue_auth_token` refuses a second token inside the caller's
window, and both the API and the seed script pass 60 seconds, so a held-down
"resend" costs one message.

Still open: wrong passwords are not throttled at all. `admin_login` carries a
`ponytail:` comment naming the fix -- a per-email attempt column on `users`, or
a WAF rule. The code that follows the password is capped at five wrong answers,
so the guessable half is the password itself.

The OTP itself is already capped -- five wrong answers kill the token -- so this
is about mail volume and password guessing, not code guessing.

---

## 6. Spent tokens are never deleted

`auth_token` grows by a few rows per signup and nothing removes the expired
ones. That is years of nothing at this size. When it starts showing up in the
table-size list:

```sql
delete from auth_token where expires_at < now() - interval '30 days';
```

on a cron.

---

## 7. Backups are unverified

The database is Postgres 16.15 on `156.67.111.80`. Whether it has backups, and
whether anyone has ever restored one, is not visible from here. Worth confirming
with whoever runs the host, and worth testing a restore rather than trusting a
setting.

---

## 8. Open product question: can two people claim the same MetaID address?

`metaid_request` allows one open request per person per type. It does not stop
two different accounts from requesting a Real MetaID for the same email address.

Whether that is wrong depends on what a MetaID is issued against. If an address
maps to exactly one MetaID, this should be a partial unique index on
`(email, metaid_type)` where status is not `rejected`; if the address is only a
delivery hint, it is correct as it stands.

Unanswered, and the answer changes the schema by one index.

---

## 9. A reset cannot sign the old session out

Sessions are stateless signed cookies with an eight-hour life, so there is
nothing to revoke: after a password reset a stolen cookie stays good until it
expires. Closing it means a `session_epoch` column on `users`, bumped by
`sp_reset_password` and carried in the cookie payload.

Eight hours is the current answer to this. It is only worth changing if that
window ever matters.

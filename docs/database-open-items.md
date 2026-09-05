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

**Why it matters.** Leaked today, that string reads and writes every table,
password hashes and live MetaID queue included. The header of `db/grants.sql`
claims the API cannot read a row. That has not been true since the admin panel
shipped.

The move off Vercel narrows this without fixing it. There is now one egress
address instead of none, so `pg_hba.conf` can name the VPS and stop accepting
connections from the rest of the internet -- worth doing on its own, and
separate from the role question below.

**Why it is still open.** The panel runs `select ... from registration` and the
other lists directly -- the filters are dynamic and a procedure per filter
combination would be a worse trade. `gmcl_api` has no `SELECT`, so switching the
connection string today breaks the panel.

**The fix.** Grant `gmcl_api` `SELECT` on `registration`,
`real_account_request`, `metaid_request`, `user_roles` and `users`, then change
`DATABASE_URL` in `.env` on the VPS. Read access to `users` still
exposes password hashes, so consider column-level grants, or move the login
lookup behind a procedure that returns only what the check needs.

**Needs a decision** -- it changes the identity the live site connects as, so it
wants a deliberate cutover rather than a quiet edit.

---

## 2. `sslmode` is not pinned

The live connection is TLS 1.3 today (checked against `pg_stat_ssl`), but
`DATABASE_URL` sets no `sslmode`, so libpq uses `prefer`: it will encrypt if the
server offers it and fall back to plaintext without a word if it does not.

**The fix.** Append `?sslmode=require` to `DATABASE_URL` in `.env` on the VPS.
`verify-full` is better still, and is now cheap: there is one host to put the
server's CA certificate on rather than an unknown number of function
instances.

---

## 3. Connection pool ceiling (closed by the move to the VPS)

Closed by the move to the VPS, and worth keeping written down because the
arithmetic changed rather than went away.

On Vercel the pool was `min_size=0, max_size=2`: a signup spike multiplied
instances and each new one took up to two connections until Postgres refused
the next -- an unbounded number of pools, two connections each.

The VPS runs a fixed number of workers, so the ceiling is now arithmetic:
`--workers` x `DB_POOL_MAX`, defaulting to 4 x 10 = 40 against a
`max_connections` of 100. Both are environment variables (`DB_POOL_MIN`,
`DB_POOL_MAX`), so tuning is not a deploy.

**What is left.** Nothing urgent. Raising the worker count is the thing that
moves this number, and 100 is the figure to check it against. PgBouncer only
becomes worth its own moving part if the worker count has to grow past what
Postgres will hold.

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

Still open: wrong passwords are not throttled at all. `login` in `api/index.py`
carries a `ponytail:` comment naming the fix. Now that nginx sits in front, the
cheap half is a `limit_req` zone on `/api/login`; the durable half is a
per-email attempt column on `users`, since a limit keyed on IP does not follow
one account across addresses. The code that follows the password is capped at
five wrong answers, so the guessable half is the password itself.

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

---

## 10. `sp_join_league` stamps the wrong address on a second entry

`league_entry.email` is documented as the address the MetaID was approved
against, and `db/app_schema.sql` gives the reason: it records what was true at
the moment of joining, so a later change to the account cannot rewrite an entry
that has already been counted.

`sp_join_league` does not read it per account. It takes whichever approved
request was decided last:

```sql
order by m.decided_at desc nulls last
limit 1
```

That was correct when a person could hold one entry. Multiple entries landed on
4 September 2026 without touching this procedure, so from the second entry
onward the column says something that is not true.

**How it goes wrong.** Demo approved against `alex@gmail.com` on Monday, Real
approved against `alex@work.com` on Tuesday. On Wednesday they join with the
demo account number, and the row records `alex@work.com` -- an address that
account was never approved under.

**The shape of the fix.** The join has to say which approved request it is
entering under, which means the API passing the request id or the type down to
the procedure, and the screen knowing which of the two a number belongs to. The
screen does not know that today: it asks for a number and nothing else, because
newera issues the number outside this system and nothing here maps a number back
to the request that produced it.

So it is not a one-line change to the `order by`. It needs the same decision
item 8 is waiting on -- what a MetaID is issued against -- before there is a
correct answer to pick.

**Deferred deliberately**, 5 September 2026. Rows written before this is fixed
carry the wrong address on every entry after the first, so a backfill is part of
the fix rather than an afterthought.

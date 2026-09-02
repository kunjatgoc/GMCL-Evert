# Global Market League

Registration site for a newera Broker trading competition: a five-section page,
a Postgres-backed registration API, and the SQL that owns the write.

```bash
npm install
npm run dev      # http://localhost:5173, /api proxied to :8000
npm run build    # -> dist/
npm run preview  # serve the built output
npm test         # zod schema + submit adapter
```

The API is a separate process in dev:

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env            # then fill in DATABASE_URL
.venv/bin/uvicorn --env-file .env api.index:app --reload --port 8000
```

`vite.config.ts` proxies `/api` to port 8000, so the browser sees one origin and
CORS never enters local development.

## Layout

| Path | What lives here |
|---|---|
| `src/` | React app. `components/` are sections, `components/ui/` are primitives, `lib/` is validation, motion and the API seam, `admin/` is the panel |
| `api/` | FastAPI serverless function. Vercel routes every `/api/*` here by path, so the file must stay `api/index.py` |
| `db/` | Schema, stored procedures, grants, and a roll-back-only test. Applied by hand, in the order below |
| `public/` | Served verbatim. `img/` is generated -- do not hand-edit |
| `design/` | Image prompts and the raw generated PNGs they produce |
| `docs/` | `requirements.md`, the spec the page is built against, and `database-open-items.md` |
| `scripts/` | `optimize-images.py` (assets) and `seed_admin.py` (the one admin account) |
| `test/` | Vitest suites |

## Database

Two schema files and one procedure per file, applied in this order:

```bash
psql "$DATABASE_URL" -f db/schema.sql
psql "$DATABASE_URL" -f db/app_schema.sql
for f in db/procedures/*.sql; do psql "$DATABASE_URL" -f "$f"; done
psql "$ADMIN_DATABASE_URL" -f db/grants.sql
psql "$DATABASE_URL" -f db/tests.sql        # asserts the rules, rolls back
```

`grants.sql` runs last because it alters procedures that have to exist first.
Every file is idempotent, so re-running the lot is safe.

| Table | Holds |
|---|---|
| `registration` | Demo ID entrants, written by the public form. Untouched by anything below |
| `real_account_request` | Real ID interest, written by the card under the form. Likewise untouched |
| `user_roles` | `admin`, `end_user`, `gml_staff`, `newera_staff` |
| `users` | Everyone who signs in, one row per account, one role per row |
| `auth_token` | Email-confirmation codes and password-reset links -- one shape, told apart by `purpose` |
| `metaid_request` | A Demo or Real MetaID asked for, and the answer |

`users` is the accounts table rather than an admins table, so an end user is a
row with a different role and not a second login path. Email is unique
case-insensitively and phone is unique outright; both index names reach the API
through `diag.constraint_name`, so a taken email and a taken number can be
worded differently without a prior SELECT. `full_name`, `phone` and
`email_verified_at` are nullable because the admin row predates them.

`auth_token` stores a keyed hash the API computes, never the code or the link
itself, and counts wrong answers: five misses kill a token. Issuing a new one
retires the old one in the same transaction, so "resend" cannot widen the
target, and a second issue inside 60 seconds is refused outright rather than
mailing again.

A MetaID request opens as `pending` and only `admin` or `newera_staff` can
settle it -- that rule is in `sp_decide_metaid`, not only in the API. A partial
unique index allows one open request per person per type; a settled one leaves
the way clear to ask again. The user never supplies a MetaID, only the address
one should be issued against. External validation of a Real address is a future
step in front of `sp_request_metaid`; the API for it does not exist yet.

Pydantic owns the request shape -- types, email format, phone validity for the
chosen country. The procedures own the write, the duplicate rules and the
races. `api/index.py` writes no SQL beyond the `CALL`, except for the admin
panel's dynamic list filters.

Validate the models without a database:

```bash
.venv/bin/python api/index.py
```

What is still missing -- the API connecting as the table owner, `sslmode`, the
pool ceiling, mail delivery -- is written down in
[`docs/database-open-items.md`](docs/database-open-items.md).

## Entry, and where the form went

The landing page no longer collects name, email and phone. It ends in two
calls to action -- **Create Now** to `/signup` and **Join The League Now** to
`/login` -- because entry now runs through an account: sign up, sign in, and
ask for a Demo or a Real MetaID from the dashboard. The section keeps the id
`#register`, so the hero button and the nav still land on it.

`/signup` has no screen yet. Until it does, that link 404s.

`src/lib/submit.ts` and `src/lib/schema.ts` are still here and still tested.
Nothing on the landing page calls them, so Vite leaves them out of the bundle,
but the signup form wants exactly the same name, email and country-aware phone
rules and the same 409-is-a-duplicate wording. `/api/register` and
`/api/real-account` are untouched and still answer.

## Admin panel

`/login` signs in, `/admin` is the dashboard, `/admin/demo-users` and
`/admin/real-users` are the two lists. Everything behind `/admin` needs a
session, so the panel is a separate lazy chunk the marketing page never loads.

```bash
psql "$DATABASE_URL" -f db/app_schema.sql
.venv/bin/python scripts/seed_admin.py you@example.com   # prompts for the password
```

Signing in is a password. The one exception is an address that has never been
confirmed: creating an account mails it a six-digit code, and the first
sign-in asks for that code before it issues a session. After that, the
password is the whole of it.

Until the address is confirmed, the password buys only a ten-minute
`gmcl_pending` cookie, which is not a session and cannot reach anything behind
`require_admin`. Answering the code trades it for the real `gmcl_admin`
session and settles `email_verified_at` for good. If the code from account
creation has expired by the time anyone signs in, that sign-in sends a fresh
one rather than leaving them stuck.

The code lives five minutes, is good once, dies after five wrong answers, and
can be resent once a minute. It is never in a response, a log or the console:
what reaches the database is `hmac_sha256(SESSION_SECRET, purpose:user_id:code)`,
so a copy of `auth_token` is not a list of live codes.

`SESSION_SECRET` must be set for sign-in to work at all -- without it the
endpoint answers 503 rather than issuing a cookie nobody can verify. `SMTP_HOST`
must be set to confirm an address, for the same reason: better a 503 than
pretending a code went out. A confirmed account signs in without either mail
setting. The session is a signed cookie, HttpOnly, eight hours, nothing kept in
JS. Passwords are pbkdf2-sha256 at 600k rounds, hashed by `api/index.py` so the
seed script and the login endpoint can never disagree on the format.

Mail goes out over SMTP with `smtplib` -- Amazon SES in production, no library
beyond the standard one. The five `SMTP_*` variables live in `.env` and in the
Vercel project, never in the source; `.env.example` carries placeholders. Port
465 is implicit TLS, anything else does STARTTLS, and a server that offers no
encryption never receives the password.

To watch the confirmation step again on an account that has already passed it:

```sql
update users set email_verified_at = null where email = 'you@example.com';
```

Set `COOKIE_SECURE=0` locally, since dev is plain http and a Secure cookie
would be dropped.

The database carries four roles, but the sign-in endpoint still admits only
`admin`. Staff and end-user login are not built yet; the tables they need are.

## Images

Every image is optional -- each has a CSS or lucide-icon fallback, and the page
is complete without any of them.

1. Generate from the prompts in `design/prompts.md`.
2. Save into `design/assets-src/` using the filename each prompt names.
3. Run `python3 scripts/optimize-images.py`.

The script trims transparent margin, resizes to roughly 2x what the page
displays, and writes WebP into `public/img/`. It cut the first batch from 11 MB
to under 1 MB. `og` is special-cased to a 1200x630 JPEG.

| Asset | Used in | Fallback if deleted |
|---|---|---|
| `hero-plate` / `-mobile` | Hero backdrop | CSS grid + candle silhouette |
| `hero-card` | About, parallax float (desktop only) | lucide `TrendingUp` |
| `about-backdrop` | About, masked backdrop | radial green bloom |
| `icon-dates` / `-capital` / `-win` | About fact cards | lucide icons |
| `trophy-1` .. `trophy-4` | Prize podium | lucide `Trophy` / `Medal` / `Award` |
| `card-texture` | Prize card surface | plain glass gradient |
| `streak` | Light-leak above the Prizes heading | nothing, decorative |
| `podium` / `podium-4tier` | Prize section base (desktop only) | per-card hairline rim |
| `admin-plate` | Admin panel backdrop | `particles.webp` + radial bloom |
| `data-texture` | Dashboard card surface | `card-texture.webp` |
| `admin-rail` | Sidebar plate | `.glass` gradient |
| `empty-state` | "Nothing matches those filters" | the sentence alone |
| `login-plate` | Login backdrop | `hero-plate.webp` |
| `particles` | Registration section ambience | plain radial glow |
| `newera-mark` | Trust bar | lucide `BadgeCheck` |
| `og` | `og:image` meta | -- |
| `favicon` + `apple-touch-icon` | `<head>` | -- |

`hero-card` is desktop-only by design: its container is `hidden lg:block`, so
phones never download it. Grain is an inline SVG `feTurbulence` in `index.css`,
not a file.

## Motion

Lenis drives scrolling; GSAP's ticker runs it, and ScrollTrigger reads Lenis's
position rather than the browser's so pinned scenes do not drift. Section
reveals use Motion, scroll-linked scenes use GSAP.

`prefers-reduced-motion` is honoured end to end: no smooth scroll, counters
render their final value immediately, transitions collapse to zero.

## Deploy

Vercel, from the repo root. `vercel.json` sets the Vite build, rewrites
`/api/*` onto the Python function, and caps it at 15s. `DATABASE_URL` and
`ALLOWED_ORIGINS` are project environment variables -- `ALLOWED_ORIGINS` must
list the deployed page's origin.

## Stack

Vite - React 18 - TypeScript - Tailwind v4 - GSAP ScrollTrigger - Motion -
Lenis - react-hook-form + zod - libphonenumber-js - FastAPI - psycopg -
Postgres

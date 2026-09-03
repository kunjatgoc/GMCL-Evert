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
step in front of `sp_request_metaid`. The dashboard asks through
`POST /api/metaid`; the approval endpoint does not exist yet.

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

`/signup` is the old registration form plus a password: the same name, email
and country-aware phone rules from `src/lib/schema.ts`, and the server checks
them again because the endpoint is public. `POST /api/signup` creates the
account through `sp_signup`, mails a six-digit code and answers with a pending
cookie, never a session. The screen then asks for the code, and a right answer
lands on `/dashboard`. A code that cannot be mailed rolls the account back, so
the person simply tries again. `/api/register` and `/api/real-account` are
untouched and still answer.

The confirmation code's answer is told as one turn, in
`src/components/auth/orbit.ts`. The six boxes curl off their row onto a dotted
ring, the ring winds up and turns a turn and a quarter while the server is
asked, and it then either goes green and screws down into a single verified
tile or unwinds back into the row carrying a red edge. The turn is two
keyframes and no trigonometry: the row's `transform-origin` moves to the hub
and a plain `rotate()` draws the circle, with the tiles left to tumble rather
than counter-rotated. It is Web Animations rather than CSS keyframes because
the turn has to be interrupted whenever the server answers and picked up from
whatever angle it had reached. A slow answer keeps the ring turning instead of
freezing it. Under `prefers-reduced-motion` none of it runs and the button's
plain busy state answers instead.

`/dashboard` is the entrant's one screen: a Demo card and a Real card, each
showing the latest request of its kind or the form to ask. Requests open as
`pending`; newera decides in the admin panel and emails the MetaID itself, so
nothing here ever displays one. It is a separate lazy chunk, like the admin
panel.

Sign-in, sign-up and the dashboard header share `src/components/auth/` -- the
backdrop and lockup, the confirmation-code form with its resend countdown, and
the password field with its show/hide toggle -- so the three screens cannot
drift apart.

## Signing in, and the admin panel

`/login` signs everyone in and sends each role home: `admin` to `/admin`,
`end_user` to `/dashboard`. The role rides inside the signed session cookie,
so `require_admin` refuses an entrant's cookie without asking the database,
and the two staff roles are refused at the door until something is built for
them. `/admin` is the dashboard, `/admin/demo-users` and `/admin/real-users`
are the two lists. Everything behind `/admin` needs an admin session, so the
panel is a separate lazy chunk the marketing page never loads.

```bash
psql "$DATABASE_URL" -f db/app_schema.sql
.venv/bin/python scripts/seed_admin.py you@example.com   # prompts for the password
```

An admin made by that script is confirmed on the spot and is mailed nothing:
running it means holding the database credential, which is a stronger claim on
the address than a code in an inbox. The code is for people signing themselves
up at `/signup`, who hold neither.

Signing in is a password and nothing else, for an address that has answered
its code. The six-digit code belongs to account creation: `/signup` mails one
and asks for it there. An address that never answered it is the one exception
-- the password is checked first, and on a match a fresh code goes out and
the confirmation step runs on the sign-in screen. Without that, a missed code
is an account nobody can reach: signup answers 409 for the address, and the
resend endpoint has no pending cookie left to read.

During signup, before the code is answered, the account holds only a
ten-minute `gmcl_pending` cookie, which is not a session and cannot reach anything behind
a session guard. Answering the code trades it for the real `gmcl_session`
cookie and settles `email_verified_at` for good. Sign-in issues the same
pending cookie when it re-sends a code, so the confirmation step is the same
step wherever it is reached.

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

`OTP_ECHO=1` prints every confirmation code to the terminal the API is running
in, and with `SMTP_HOST` empty it stands in for the mail server entirely, so
the whole sign-up flow can be walked through before SES credentials exist:

```
[OTP_ECHO] you@example.com -> 850315  (expires in 5 minutes)
```

It is a development switch. A code in a log is a credential anyone with log
access can sign in with, so it must never be set in the Vercel project
environment. It is off unless it is exactly `1`, the server prints a warning at
boot whenever it is on, and the self-check in `api/index.py` asserts that with
it off a code never reaches the log. With both it and `SMTP_HOST` unset,
sign-up answers 503 rather than issuing a code nobody can receive.

The database carries four roles; sign-in admits `admin` and `end_user`.
Staff login is not built yet; the tables it needs are.

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

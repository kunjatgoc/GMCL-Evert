# Global Market Champion League  landing page

Single-page, five-section landing page for a NewEra Broker trading competition.
Dark black + spring green, WebGL hero, scroll-driven motion.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # -> dist/  (static, host anywhere)
npm run preview  # serve the built output
npm test         # schema + submit adapter
```

## Sections

In order, matching `requirements.md`. There is nothing else on the page.

| # | Component | Notes |
|---|---|---|
| 1 | `Hero` | ThreeUI Laser background, decoding headline, ThreeUI Lumen CTA |
| 2 | `TrustBar` | "Powered by NewEra Broker" + account-type instruction |
| 3 | `AboutLeague` | Three fact cards, GSAP scroll rail, count-up, ThreeUI growth dial + telemetry panel |
| 4 | `Prizes` | Podium: 1st centre and elevated, count-ups, pointer tilt |
| 5 | `RegistrationForm` | Name / Mobile+country / Email / Account type, zod validation |

## Where the form data goes

`src/lib/submit.ts` POSTs to `/api/register`. Set `VITE_REGISTER_URL` when the
API is not on the same origin as the page; in dev, Vite proxies `/api` to
`localhost:8000`, so neither the URL nor CORS is needed.

## Backend

FastAPI + psycopg, one file. Every write goes through the `sp_register`
procedure  Pydantic validates the shape (types, email, phone validity for the
chosen country, normalised to E.164), the procedure owns trimming, case-folding
and the one-entry-per-email rule.

`api/schema.sql` holds tables and indexes. Every procedure is its own file
under `api/procedures/`  they are independent and `create or replace`, so they
apply in any order and re-apply safely. `api/grants.sql` runs last and locks
the API's role down to one privilege: execute `sp_register`.

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

psql "$ADMIN_DATABASE_URL" -f api/schema.sql
for f in api/procedures/*.sql; do psql "$ADMIN_DATABASE_URL" -f "$f"; done
psql "$ADMIN_DATABASE_URL" -f api/grants.sql
psql "$ADMIN_DATABASE_URL" -c "alter role gmcl_api password '…'"

DATABASE_URL=postgresql://... .venv/bin/uvicorn api.index:app --port 8000

.venv/bin/python api/index.py                 # validation self-check, no DB
```

| Env | Where | Default |
|---|---|---|
| `DATABASE_URL` | API | required at startup |
| `ALLOWED_ORIGINS` | API, comma-separated | `http://localhost:5173` |
| `VITE_REGISTER_URL` | build time | `/api/register` |

## Deploying to Vercel

Both halves ship as one Vercel project. Vite builds the page; `api/index.py`
becomes a Python serverless function. It is called `index.py` because Vercel
routes a function by its file path, and `vercel.json` rewrites `/api/*` onto
it -- FastAPI still receives the original path, so `/api/register` matches.
Page and API share an origin, so CORS never comes into play and
`VITE_REGISTER_URL` stays unset.

Project settings: **Root Directory** `LandingPage-1`. Framework preset Vite,
build and output detected. One environment variable, `DATABASE_URL`, pointing
at the Postgres on the Linux server.

### The database is on the open internet

Vercel functions have no fixed egress IP, so `pg_hba.conf` cannot be narrowed
to a source address -- the port has to accept connections from anywhere. That
makes four things mandatory rather than advisable.

1. **TLS, enforced by the server.** In `postgresql.conf` set
   `listen_addresses = '*'` and `ssl = on`; in `pg_hba.conf` use `hostssl` for
   the entry and `hostnossl all all 0.0.0.0/0 reject` above it, so a plaintext
   connection is refused rather than downgraded.
2. **TLS, verified by the client.** `DATABASE_URL` ends in
   `?sslmode=verify-full`. Without `verify-full`, a man in the middle presents
   any certificate and psycopg accepts it. Use a real certificate (Let's
   Encrypt on the Postgres host works) so no root has to be shipped.
3. **The `gmcl_api` role from `api/grants.sql`**, never the owner or a
   superuser. It can call one procedure and cannot read a single row back.
4. **fail2ban on the Postgres log**, since the port answers to the world.
   Postgres itself has no login throttle.

Two consequences to expect. Cold starts pay a fresh TCP and TLS handshake to
the server, so the first request after an idle spell is slow; and a traffic
spike opens connections in proportion to the instances Vercel starts --
`max_size=2` per instance is the only cap, so keep `max_connections` on the
server comfortably above what a burst can produce.

Running the API on the Linux server instead, next to the database, removes all
of this: Postgres binds to `localhost`, and the page only needs
`VITE_REGISTER_URL` and `ALLOWED_ORIGINS`.

Responses: `201 {id}`, `409` duplicate email, `422` failed validation. The form
branches on all three.

There is no rate limit or bot check on the endpoint yet  deliberate, deferred.

## The hero has two paths

`src/lib/usePerfTier.ts` decides between them, pessimistically  anything it
cannot confirm as capable gets the static plate.

- **`full`**  ThreeUI's Laser renderer, `atmospheric-blade` variant: one
  raw-WebGL fragment shader over a full-screen quad, with damped pointer
  parallax. It carries its own ResizeObserver, IntersectionObserver, visibility
  and reduced-motion handling, so it stops when it is not being looked at.
  Lazy-loaded  the shader source never reaches the static-plate path.
- **`lite`**  the generated hero plate, or a pure-CSS grid-and-candles
  stand-in if no plate is present. Used on phones, low-memory or low-core
  devices, software renderers, `prefers-reduced-motion`, and after a WebGL
  context loss.

Force either path to review it: `?scene=on` / `?scene=off`.

## Images

Every image is optional  each has a CSS or lucide-icon fallback, and the page
is complete without any of them.

1. Generate from the prompts in `IMAGE-PROMPTS.md`.
2. Save into `assets-src/` using the filename each prompt names.
3. Run `python3 scripts/optimize-images.py`.

The script trims transparent margin, resizes to what the page actually
displays, and writes WebP into `public/img/`. It cut the first batch from
11 MB to under 1 MB. `og` is special-cased to a 1200×630 JPEG.

### What is wired where

| Asset | Used in | Fallback if deleted |
|---|---|---|
| `hero-plate` / `-mobile` | Hero, `lite` tier + Suspense | CSS grid + candle silhouette |
| `hero-card` | unused since the ThreeUI dial replaced it |  |
| `about-backdrop` | About, masked backdrop | radial green bloom |
| `icon-dates` / `-capital` / `-win` | About fact cards | lucide icons |
| `trophy-1` / `-2` / `-3` | Prize podium | lucide `Trophy` / `Medal` / `Award` |
| `card-texture` | Prize card surface | plain glass gradient |
| `streak` | Light-leak above the Prizes heading | nothing (decorative) |
| `podium` | Prize section base, cards stand on it (desktop only) | per-card hairline rim |
| `particles` | Registration section ambience | plain radial glow |
| `newera-mark` | Trust bar | lucide `BadgeCheck` |
| `og` | `og:image` meta |  |
| `favicon` + `apple-touch-icon` | `<head>` |  |

Not generated, and not needed: `particles`, `podium` (Tier 4 extras) and
`grain`  grain is already an inline SVG `feTurbulence` in `index.css`.

`hero-card` is desktop-only by design: its container is `hidden lg:block`, so
phones never download it.

## Motion

Lenis drives scrolling; GSAP's ticker runs it, and ScrollTrigger reads Lenis's
position rather than the browser's so pinned scenes do not drift. Section
reveals use Motion, scroll-linked scenes use GSAP.

`prefers-reduced-motion` is honoured end to end: no smooth scroll, no canvas,
counters render their final value immediately, transitions collapse to zero.
The vendored ThreeUI pieces honour it too  the headline sets without
scrambling, the dial jumps to its reading without the self-test sweep, and the
telemetry canvases paint one still frame instead of animating.

## ThreeUI

`src/threeui/` holds pieces vendored from [MengTo/threeui](https://github.com/MengTo/threeui)
(MIT)  the hero's Laser shader, the headline decode, the Lumen CTA, the
balance-growth dial and the telemetry panel  plus the two OFL faces the page
is set in. Nothing is an npm dependency. `src/threeui/NOTICE.md` records what
came across verbatim, what was retoned, what was ported out of an iframe and
why, and how to diff against upstream.

## Fonts

Lexend (variable, 100900) and Fragment Mono, self-hosted from
`public/fonts/`. Both ship with ThreeUI under the SIL Open Font License 1.1.
They replaced a Google Fonts stylesheet, so the page now makes no third-party
requests at all.

## Stack

Vite · React 18 · TypeScript · Tailwind v4 · GSAP ScrollTrigger · Motion ·
Lenis · react-hook-form + zod · libphonenumber-js · vendored ThreeUI

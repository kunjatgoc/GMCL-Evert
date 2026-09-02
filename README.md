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
| `src/` | React app. `components/` are sections, `components/ui/` are primitives, `lib/` is validation, motion and the API seam |
| `api/` | FastAPI serverless function. Vercel routes every `/api/*` here by path, so the file must stay `api/index.py` |
| `db/` | Schema, stored procedures, grants. Applied by hand, in the order below |
| `public/` | Served verbatim. `img/` is generated -- do not hand-edit |
| `design/` | Image prompts and the raw generated PNGs they produce |
| `docs/` | `requirements.md`, the section-by-section spec the page is built against |
| `scripts/` | `optimize-images.py`, which turns `design/assets-src/` into `public/img/` |
| `test/` | Vitest suites |

## Database

Procedures live one per file and are applied after the schema:

```bash
psql "$DATABASE_URL" -f db/schema.sql
for f in db/procedures/*.sql; do psql "$DATABASE_URL" -f "$f"; done
psql "$ADMIN_DATABASE_URL" -f db/grants.sql
```

Pydantic owns the request shape -- types, email format, phone validity for the
chosen country. The procedures own the write and the duplicate rule. `api/index.py`
writes no SQL beyond the `CALL`.

Validate the models without a database:

```bash
.venv/bin/python api/index.py
```

## Where the form data goes

`src/lib/submit.ts` is the only seam between the form and the API -- two
functions, `submitRegistration()` and `submitRealAccount()`. Both POST
same-origin by default; `VITE_REGISTER_URL` and `VITE_REAL_ACCOUNT_URL`
override that when the API is deployed elsewhere.

A 409 is a duplicate, not a failure, and is worded as reassurance. A thrown
fetch is offline / DNS / CORS / server-down and is worded as retryable.

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

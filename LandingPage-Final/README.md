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
| 1 | `Hero` | WebGL grid + candlestick field, masked headline reveal, magnetic CTA |
| 2 | `TrustBar` | "Powered by NewEra Broker" + Demo ID instruction |
| 3 | `AboutLeague` | Three fact cards, GSAP scroll rail, count-up |
| 4 | `Prizes` | Podium: 1st centre and elevated, count-ups, pointer tilt |
| 5 | `RegistrationForm` | Name / Email / Phone+country / Demo ID, zod validation |

## Where the form data goes

`src/lib/submit.ts`  one function, `submitRegistration()`. It currently logs
and writes to `localStorage` so the full success and error UI is exercisable.
Replace the body with your POST and keep the signature; nothing else changes.

## The hero has two paths

`src/lib/usePerfTier.ts` decides between them, pessimistically  anything it
cannot confirm as capable gets the static plate.

- **`full`**  three.js scene: shader floor grid, instanced candle field,
  damped mouse parallax, scroll-driven camera push. Lazy-loaded, so `three`
  never enters the initial bundle.
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
| `hero-card` | About, floating with scroll parallax (desktop only) | lucide `TrendingUp` |
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

## Stack

Vite · React 18 · TypeScript · Tailwind v4 · three / react-three-fiber ·
GSAP ScrollTrigger · Motion · Lenis · react-hook-form + zod ·
libphonenumber-js

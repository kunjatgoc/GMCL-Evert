# ThreeUI, vendored

Source: [MengTo/threeui](https://github.com/MengTo/threeui)  MIT.
Fonts: SIL Open Font License 1.1 (see `FONT-LICENSES` below).

Nothing here is an npm dependency. The pieces this page uses were copied in so
the page keeps one `three`-free bundle, one set of build tooling, and no
sandboxed iframes pulling scripts off three CDNs at runtime.

| File | Upstream | Changed |
|---|---|---|
| `laserShaders.ts` | `src/shaders/laser/laserShaders.ts` | verbatim |
| `LaserVariants.tsx` | `src/shaders/laser/LaserVariants.tsx` | one import  `community.css` → `threeui.css` |
| `threeui.css` | `src/shaders/community.css` | the two `.threeui-background` rules only |
| `articleHeadingDecode.ts` | `src/shaders/article-headings/articleHeadingDecode.ts` | verbatim |
| `LumenCta.tsx` | `src/shaders/lumen-cta/LumenCta.tsx` | light mode dropped, label takes a node, ring dot dropped |
| `lumen-cta.css` | `src/shaders/lumen-cta/lumen-cta.css` | violet ramp → spring green, demo stage → inline box, hero sizing, `.lumen-cta__ring` removed |
| `Gauge.tsx` + `gauge.css` | `sources/performance-gauges.html` | ported out of the iframe; dial reads balance growth |
| `Telemetry.tsx` | `sources/diagnostics-panel.html` | ported out of the iframe; three renderers kept, page rebuilt |

## Why two of them are ports and not copies

`performance-gauges.html` and `diagnostics-panel.html` are standalone documents
that threeui renders inside a sandboxed iframe, and both load Tailwind's play
CDN, Iconify, Google Fonts, and (the second) GSAP. Embedding either as-is would
have put four blocking third-party requests in front of a conversion page. The
drawing code is the part worth having, so it came across and the surrounding
document did not.

Three bugs were fixed on the way across, all of which a short-lived iframe demo
gets away with and a long-lived page does not: `ctx.scale(dpr, dpr)` compounding
on every resize, `requestAnimationFrame` loops that are never cancelled, and
canvases that keep running off-screen, in a hidden tab, and under
`prefers-reduced-motion`.

## Fonts

All three faces are self-hosted under the SIL Open Font License 1.1.

`lexend.woff2` and `fragment-mono.woff2` are the files threeui bundles:

- Lexend  Copyright 2018 The Lexend Project Authors, Reserved Font Name
  "RevReading Lexend"
- Fragment Mono  Copyright 2022 The Fragment-Mono Project Authors

`TheNeue-Black.woff2` did not come from threeui. It is the display face, taken
from the 1.007 release of The League of Moveable Type's repository:

- The Neue Black  Copyright Tré Seals / Vocal Type.
  <https://github.com/theleagueof/the-neue-black> ·
  <https://www.theleagueofmoveabletype.com/the-neue-black>

## Updating

Diff against a fresh clone of the upstream file before pulling changes in  the
"Changed" column above is the whole delta.

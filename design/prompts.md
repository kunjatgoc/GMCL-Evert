# Image Generation Prompts  Global Market Champion League

Prompts for generating the visual assets for this landing page. Works with Midjourney, Nano Banana / Gemini Image, Flux, DALL·E, Ideogram, or Stable Diffusion.

**Every image on this list is optional.** The page ships complete and premium without a single one of them  each prompt names the CSS/WebGL fallback that renders in its place. Generate the ones you want, drop them into the listed path, and the page picks them up automatically.

---

## How to use this file

1. Pick a prompt below.
2. Paste **`[PROMPT]` + `[STYLE LOCK]`** into your image generator (the style lock is what keeps all twelve assets looking like one system).
3. Paste **`[NEGATIVE]`** into the negative-prompt field. If your tool has no negative field (DALL·E, Nano Banana), append it as `Avoid: ...` to the end of the prompt.
4. Export at the stated size and save to the stated path.
5. Share the result back with me and I'll wire it in and adjust the surrounding treatment to match.

---

## STYLE LOCK  append to every prompt

```
Visual system: deep near-black background (#0A0A0A to #121212), single accent
of vibrant spring green (#00FF87) with a deeper emerald (#00C853) for falloff.
No other hues  no blue, no purple, no orange, no gold. Premium fintech /
institutional trading aesthetic. Glossy dark glass, subtle volumetric green
glow, thin luminous green rim-light on edges. Cinematic studio lighting, high
dynamic range, shallow depth of field, fine film grain. Octane / Redshift
quality 3D render. Clean, spacious, expensive. 8k, ultra sharp.
```

## NEGATIVE  append to every prompt

```
text, letters, words, numbers, watermark, logo, signature, UI mockup, buttons,
people, faces, hands, stock photo, cluttered, busy, cheap, plastic, low
contrast, blurry, jpeg artifacts, oversaturated, rainbow colors, blue tint,
purple tint, gold, orange, red, cartoon, flat vector clipart, lens flare
starbursts, bokeh circles
```

---

# TIER 1  Highest impact

## 1. Hero background plate

**Path:** `public/img/hero-plate.webp` **Size:** 2560 × 1440 (16:9) **Fallback if skipped:** live three.js grid + candlestick field (already built)

> Use this only if you want a rendered plate *behind* the WebGL layer for extra richness, or as the static image low-power devices see.

```
[PROMPT]
An abstract financial landscape rendered in 3D: a vast dark reflective plane
receding to a low horizon, overlaid with a precise luminous wireframe grid in
spring green that fades into black distance. Rising from the plane, a field of
tall slender vertical bars of varying heights  abstracted candlestick chart
columns  some glowing green from within, others dark matte obsidian. A soft
volumetric green haze pools low across the ground. Above, empty black space
with a faint green atmospheric gradient. Wide cinematic composition, camera low
and close to the plane looking toward the horizon, strong sense of depth and
scale, negative space in the upper two thirds for headline text.
```

---

## 2. Mobile hero plate

**Path:** `public/img/hero-plate-mobile.webp` **Size:** 1080 × 1920 (9:16) **Fallback if skipped:** hero-plate.webp centre-cropped

```
[PROMPT]
Vertical composition of an abstract financial landscape: a dark reflective
plane with a luminous spring green wireframe grid receding upward to a high
horizon in the lower third of the frame. A cluster of slender glowing green
vertical candlestick columns rises from the plane at the bottom. The upper two
thirds is deep black with a soft green atmospheric glow bleeding up from the
horizon. Vertical cinematic framing, heavy negative space at the top for
overlaid text.
```

---

## 3. Floating glass chart card (hero foreground)

**Path:** `public/img/hero-card.png` **Size:** 1600 × 1200, **transparent PNG** **Fallback if skipped:** CSS glassmorphism card (already built)

```
[PROMPT]
A single floating rectangular panel of dark smoked glass with rounded corners,
tilted in three-quarter perspective, isolated on a fully transparent
background. The panel has a razor-thin luminous spring green rim-light tracing
its edges and a soft green glow spilling from beneath it. Inside the glass,
suspended in depth, a minimal upward-trending line graph made of pure green
light with a soft green gradient fill fading below it, plus two or three tiny
floating green data nodes at different depths. The glass has realistic
thickness, refraction, and a specular highlight sweeping across its top edge.
Product-render lighting, isolated object, no background.
```

---

## 4. Trophy  1st place

**Path:** `public/img/trophy-1.png` **Size:** 1000 × 1000, **transparent PNG** **Fallback if skipped:** lucide `Trophy` icon in accent green

```
[PROMPT]
A single modern abstract trophy sculpture isolated on a fully transparent
background. Carved from dark polished obsidian glass with an internal core of
glowing spring green light visible through the material. Sharp faceted
geometric form  a tapering vertical monolith flaring into a chalice at the
top  sitting on a low dark plinth. A luminous green rim-light traces every
edge and a soft green glow pools at its base. Front-on hero product shot,
dramatic single-source studio lighting from above, floating with no shadow
ground plane, isolated object, no background.
```

## 5. Trophy  2nd place

**Path:** `public/img/trophy-2.png` **Size:** 1000 × 1000, **transparent PNG**

```
[PROMPT]
Same abstract trophy sculpture as before but visibly shorter and simpler:
dark polished obsidian glass, a dimmer emerald-green internal glow (#00C853)
rather than bright spring green, one less facet tier, on a low dark plinth.
Isolated on a fully transparent background, front-on product shot, studio
lighting, subdued and secondary in presence, no background.
```

## 6. Trophy  3rd place

**Path:** `public/img/trophy-3.png` **Size:** 1000 × 1000, **transparent PNG**

```
[PROMPT]
Same abstract trophy sculpture family, now the smallest and plainest variant:
dark polished obsidian glass with only a faint deep-emerald internal glow,
a simple tapering form with minimal faceting, on a low dark plinth. Isolated
on a fully transparent background, front-on product shot, restrained studio
lighting, no background.
```

---

# TIER 2  Section detail

## 7. About-section icon objects (generate as 3, or one sheet)

**Paths:** `public/img/icon-dates.png`, `public/img/icon-capital.png`, `public/img/icon-win.png`
**Size:** 700 × 700 each, **transparent PNG** **Fallback if skipped:** lucide icons `CalendarRange`, `Wallet`, `TrendingUp`

```
[PROMPT  dates]
A small floating 3D object isolated on a transparent background: a dark glass
calendar block with rounded corners, its front face a smoked translucent
panel, a bar of glowing spring green light running along its top edge, and two
green luminous dots marking a date range across it. Compact icon-scale product
render, three-quarter view, green rim-light, soft green glow underneath,
isolated object, no background.
```

```
[PROMPT  capital]
A small floating 3D object isolated on a transparent background: a dark glass
vault coin or thick disc standing on edge in three-quarter view, obsidian
material, a luminous spring green ring inset into its face, green light
bleeding from the seam around its rim. Compact icon-scale product render,
green rim-light, soft green glow underneath, isolated object, no background.
```

```
[PROMPT  win]
A small floating 3D object isolated on a transparent background: a bold
upward-angled arrow rendered as a solid bar of glowing spring green light with
a dark glass core, rising steeply, with two smaller dark glass step-blocks
beneath it forming an ascending staircase. Compact icon-scale product render,
green rim-light, soft green glow underneath, isolated object, no background.
```

---

## 8. Prize card surface texture

**Path:** `public/img/card-texture.webp` **Size:** 1200 × 1600 **Fallback if skipped:** CSS gradient + backdrop-blur glass (already built)

```
[PROMPT]
An abstract dark surface texture for a vertical UI card: near-black brushed
carbon-fibre weave catching a faint sheen, overlaid with a very subtle
large-scale hexagonal mesh pattern in barely-visible dark green. A soft
diagonal spring green light sweep crosses the upper portion and fades out. Flat
head-on view, no perspective, no objects, edge-to-edge texture, low contrast,
subtle enough to sit behind text.
```

---

## 9. Candlestick sculpture (About section backdrop)

**Path:** `public/img/about-backdrop.webp` **Size:** 1920 × 1080 **Fallback if skipped:** radial green gradient blob (already built)

```
[PROMPT]
An abstract sculptural cluster of tall vertical bars of varying heights
arranged like a candlestick chart, rendered as dark obsidian glass columns with
glowing spring green edges and internal light. The cluster sits off to one side
of the frame against deep black emptiness, viewed from a low three-quarter
angle. Soft green volumetric haze drifts between the columns. The right half of
the frame is almost entirely empty black for text overlay. Cinematic, moody,
enormous sense of scale and depth.
```

---

## 10. Light-leak divider streak

**Path:** `public/img/streak.png` **Size:** 2560 × 400, **transparent PNG** **Fallback if skipped:** CSS linear-gradient hairline (already built)

```
[PROMPT]
A single horizontal streak of spring green light on a fully transparent
background  brightest and thinnest at the centre, spreading and dimming into
a soft wide haze toward both ends, fading completely to nothing at the left and
right edges. Pure light, no object, no lens flare starburst, no rings. Wide
letterbox format, symmetrical, clean falloff.
```

---

# TIER 3  Brand + share

## 11. NewEra Broker mark

**Path:** `public/img/newera-mark.png` **Size:** 512 × 512, **transparent PNG** **Fallback if skipped:** wordmark in Space Grotesk + accent dot (already built)

```
[PROMPT]
A minimal abstract logo mark isolated on a fully transparent background: a
geometric monogram formed from two clean angular strokes suggesting an upward
chart movement enclosed in an implied hexagon, rendered as glowing spring green
light with a dark glass core. Flat-on view, perfectly centred, symmetrical,
crisp geometry, no text, no letters, vector-precise edges, isolated mark.
```

## 12. Favicon mark

**Path:** `public/favicon.png` **Size:** 512 × 512 **Fallback if skipped:** inline SVG favicon (already built)

```
[PROMPT]
An extremely simple bold icon on a solid near-black (#0A0A0A) square
background: a single thick upward-rising chevron or arrow of solid spring green
(#00FF87), perfectly centred, filling roughly sixty percent of the frame, with
a faint green glow around it. Flat design, maximum simplicity, must remain
legible when scaled down to 16 pixels, no detail, no text, no gradient noise.
```

## 13. Open Graph / social share card

**Path:** `public/img/og.png` **Size:** 1200 × 630 **Fallback if skipped:** hero-plate.webp cropped

> Generate this **without text**  the headline is composited over it in the page, and generators render text badly.

```
[PROMPT]
A wide cinematic composition on a deep black field: a dark reflective plane in
the lower third with a luminous spring green wireframe grid receding to a
horizon, a cluster of glowing green candlestick columns rising on the right
side, and soft green volumetric haze. The entire left two-thirds of the frame
is clean empty black with only a faint green atmospheric gradient, reserved for
a headline. Premium fintech key art, strong depth, dramatic and expensive.
```

---

# TIER 4  Optional extras

Only worth generating if you want the page to feel even richer. Nothing depends on these.

## 14. Ambient particle plate

**Path:** `public/img/particles.png` **Size:** 2048 × 2048, **transparent PNG**

```
[PROMPT]
Scattered tiny points of spring green light of varying sizes and brightness,
suspended at different depths on a fully transparent background  some sharp
and bright, others soft and heavily out of focus. Irregular organic
distribution, denser toward the centre and sparse at the edges. Pure light
points only, no objects, no connecting lines, no background.
```

## 15. Podium base plate (under prize cards)

**Path:** `public/img/podium.png` **Size:** 2000 × 700, **transparent PNG**

```
[PROMPT]
Three low geometric platforms of dark polished obsidian arranged side by side
on a transparent background  the centre platform noticeably taller than the
two flanking it, forming a podium. Each platform has a thin luminous spring
green line inset around its top edge and a soft green glow pooling beneath.
Straight-on frontal view, slight downward angle, isolated object, no
background, no figures.
```

## 16. Grain overlay tile

**Path:** `public/img/grain.png` **Size:** 512 × 512, **seamlessly tileable** **Fallback if skipped:** SVG feTurbulence grain (already built)

```
[PROMPT]
A seamless tileable fine film grain noise texture, monochrome grey on a
transparent background, very subtle and even, high frequency, no visible
pattern or repetition, no clumping. Photographic 35mm grain character.
```

---

## Format notes

- **Transparent PNG matters** for items 3–7, 10, 11, 14, 15  they composite over live WebGL and CSS glow. A baked black background will show as an ugly rectangle. If your generator can't do alpha, generate on pure black `#000000` and tell me  I'll key it out.
- Convert the large opaque plates (1, 2, 8, 9) to **WebP at quality 82** before dropping them in, or hand me the PNGs and I'll convert. Full-size PNGs will cost several seconds of load.
- If a generator drifts to blue or teal, add `strictly no cyan, no teal, no turquoise` to the negative prompt  spring green sits close enough to teal that models slide toward it.
- Send back whatever you generate, including the ones you're unsure about. Easier for me to judge them in place than in isolation.

import type { CSSProperties } from 'react'

/**
 * The panel's colour tokens, set as custom properties on the admin root so
 * Tailwind can reference them literally (`bg-[var(--admin-card)]`) -- a class
 * built from a JS value would never be seen by the scanner.
 *
 * Rules this encodes, from the design system:
 *
 *   1. Green is the only brand colour. Amber, gold, blue and crimson are
 *      status colours, never decoration.
 *   2. One green accent per view.
 *   3. The canvas is green-tinted charcoal, never pure black -- that is what
 *      stops the neon green vibrating against it.
 *   4. Body text stays near-white. Green is for numbers, actions and active
 *      state only.
 *   5. Charts use the primary green and Ledger Gold. Never two greens.
 *
 * The panel runs the system's Signal Green, not the marketing page's #00FF87.
 * That neon is built to survive a hero image behind it; on a 46px number over
 * a Slate Panel it vibrates. The two surfaces are allowed to differ -- this
 * palette is titled "Global Market League - Admin" for that reason.
 */
export const PALETTE = {
  '--admin-bg': '#0D1512', // Carbon Green -- canvas
  '--admin-card': '#18211D', // Slate Panel -- cards, rows, filter bar
  '--admin-primary': '#3EE68A', // Signal Green -- numbers, actions, active
  '--admin-primary-deep': '#1F5C41', // Deep Forest -- fills, hovers
  '--admin-primary-glow': '#7DF7B8', // Mint Glow -- focus rings, highlights
  '--admin-gold': '#D9B45F', // Ledger Gold -- secondary chart series
  '--admin-destructive': '#E4553C', // Alert Crimson -- the only alarm colour
  '--admin-muted': '#A6B3AC', // Muted Sage -- labels, timestamps, meta
} as CSSProperties

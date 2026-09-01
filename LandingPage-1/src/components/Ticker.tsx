// Illustrative only. These are the instrument classes the league trades, not
// a quote feed  the strip is labelled as such so nobody reads it as live
// pricing. Static values keep it honest and keep the marquee cheap.
const INSTRUMENTS = [
  { sym: 'EUR/USD', tag: 'FX' },
  { sym: 'GBP/JPY', tag: 'FX' },
  { sym: 'XAU/USD', tag: 'Metals' },
  { sym: 'US30', tag: 'Indices' },
  { sym: 'NAS100', tag: 'Indices' },
  { sym: 'USOIL', tag: 'Energy' },
  { sym: 'BTC/USD', tag: 'Crypto' },
  { sym: 'USD/INR', tag: 'FX' },
  { sym: 'SPX500', tag: 'Indices' },
  { sym: 'ETH/USD', tag: 'Crypto' },
] as const

function Lane({ ariaHidden }: { ariaHidden?: boolean }) {
  return (
    <ul
      aria-hidden={ariaHidden}
      className="flex shrink-0 items-center gap-10 pr-10"
    >
      {INSTRUMENTS.map((it) => (
        <li key={it.sym} className="flex items-baseline gap-2.5 whitespace-nowrap">
          <span className="font-mono text-small font-medium text-white">
            {it.sym}
          </span>
          <span className="text-nano uppercase text-muted/70">
            {it.tag}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Full-bleed instrument strip. Two identical lanes translated by -50% give a
 * seamless loop with no JS; the animation is dropped under reduced motion by
 * the global rule in index.css, which leaves a readable static row.
 */
export function Ticker() {
  return (
    <div className="relative overflow-hidden border-b border-white/5 bg-[#0b0d0c] py-3">
      <span className="absolute left-0 top-0 z-20 flex h-full items-center gap-2 bg-[#0b0d0c] pl-6 pr-5 text-nano font-semibold uppercase text-[#00FF87]">
        <span className="size-1.5 rounded-full bg-[#00FF87] [animation:rail-pulse_1.8s_ease-in-out_infinite]" />
        Tradable
      </span>

      <div className="flex w-max [animation:marquee_38s_linear_infinite] hover:[animation-play-state:paused]">
        <Lane />
        <Lane ariaHidden />
      </div>

      {/* Feather both ends so instruments arrive and leave rather than pop. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#0b0d0c] to-transparent"
      />
    </div>
  )
}

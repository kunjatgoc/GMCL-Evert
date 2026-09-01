import { scrollToId } from '../lib/scroll'

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

// Negative offsets into a single shared keyframe: every bar starts partway
// through the cycle, so they read as a wave instead of one blinking block.
const BAR_DELAYS = [0, -170, -340, -510] as const

function Lane({ ariaHidden }: { ariaHidden?: boolean }) {
  return (
    <ul
      aria-hidden={ariaHidden}
      className="flex shrink-0 items-center gap-8 pr-8"
    >
      {INSTRUMENTS.map((it) => (
        <li key={it.sym} className="flex items-baseline gap-2 whitespace-nowrap">
          <span className="text-[14px] font-medium text-white">{it.sym}</span>
          <span className="text-[11px] uppercase tracking-[0.16em] text-[#E4EAE7]/70">
            {it.tag}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Fixed top bar: brand, the tradable instrument strip, and the entry CTA.
 *
 * The strip is two identical lanes translated by -50%, which loops with no JS.
 * Reduced motion drops the animation via the global rule in index.css, leaving
 * a readable static row rather than an empty bar.
 */
export function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 h-[var(--nav-h)] border-b border-white/8 bg-[#0b0d0c]/85 backdrop-blur-md">
      <div className="shell flex h-full items-center gap-4 pl-6 pr-4 xl:pl-20 2xl:pl-28">
        <a
          href="#top"
          className="shrink-0 text-[14px] font-bold tracking-tight text-white"
        >
          GMCL
        </a>

        {/* The strip is the only element allowed to grow: the brand and the
            CTA keep their intrinsic width at every breakpoint, so the marquee
            absorbs the difference instead of the CTA wrapping. */}
        <div className="hidden min-w-0 flex-1 items-center sm:flex">
          {/* Replaces the "Tradable" label and its status dot. Bars rising and
              falling echo the candlestick towers in the hero plate and read as
              market movement rather than a generic status light. The words
              survive as screen-reader text, so dropping them visually costs
              the instrument list none of its context. */}
          <span className="sr-only">Tradable instruments</span>
          <span
            aria-hidden
            className="flex h-3.5 shrink-0 items-end gap-[3px] pr-5"
          >
            {BAR_DELAYS.map((delay) => (
              <span
                key={delay}
                className="h-full w-[2px] origin-bottom rounded-full bg-[#00FF87] [animation:tick-bar_900ms_ease-in-out_infinite_alternate]"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </span>

          {/* The lanes get their own clipping box. Sharing one with the label
              would let the -50% transform slide instruments underneath it. */}
          <div className="relative min-w-0 flex-1 overflow-hidden">
            <div className="flex w-max [animation:marquee_38s_linear_infinite] hover:[animation-play-state:paused]">
              <Lane />
              <Lane ariaHidden />
            </div>

            {/* Feather both ends so instruments arrive and leave rather than
                getting chopped mid-symbol at the clip edge. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[#0b0d0c] to-transparent"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-[#0b0d0c] to-transparent"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => scrollToId('register')}
          className="ml-auto shrink-0 rounded-full border border-[rgba(0,255,135,0.32)] bg-[rgba(0,255,135,0.07)] px-4 py-1.5 text-[13.5px] font-semibold text-[#00FF87] transition-colors duration-300 hover:bg-[rgba(0,255,135,0.14)] sm:ml-0"
        >
          Join
        </button>
      </div>
    </header>
  )
}

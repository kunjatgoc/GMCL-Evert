import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { CalendarRange, TrendingUp, Wallet } from 'lucide-react'
import { GlassCard } from './ui/GlassCard'
import { Eyebrow } from './ui/Eyebrow'
import { Counter } from './ui/Counter'
import { IconArt } from './ui/IconArt'
import { CircuitRail } from './ui/CircuitRail'
import { Gauge } from '../threeui/Gauge'
import { Telemetry } from '../threeui/Telemetry'
import { parallax, scrollScene } from '../lib/scrollScene'

const FACTS = [
  {
    icon: CalendarRange,
    label: 'League window',
    value: '7 – 18 Sept',
    body: 'Twelve trading days. The board opens at 00:00 on the 7th and locks at 23:59 on the 18th.',
    img: '/img/icon-dates.webp',
  },
  {
    icon: Wallet,
    label: 'Starting capital',
    value: '$10,000',
    counter: 10000,
    body: 'Every participant is funded with the same $10,000 USD demo account. No deposits, no advantage bought.',
    img: '/img/icon-capital.webp',
  },
  {
    icon: TrendingUp,
    label: 'Win condition',
    value: 'Biggest gain',
    body: 'The trader who grows their balance the most by the close of the 18th takes first place.',
    img: '/img/icon-win.webp',
  },
] as const

export function AboutLeague() {
  const root = useRef<HTMLElement>(null)
  const rail = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  useLayoutEffect(
    () =>
      scrollScene(root.current, () => {
        // The dial drifts against the scroll, which is what sells it as
        // floating in front of the backdrop rather than pasted onto it.
        gsap.fromTo(
          card.current,
          { y: 60, rotate: -3 },
          {
            y: -60,
            rotate: 3,
            ease: 'none',
            scrollTrigger: {
              trigger: root.current,
              start: 'top bottom',
              end: 'bottom top',
              scrub: 1,
            },
          }
        )

        // The instrument panel trails the cards above it.
        parallax(panel.current, { yPercent: -6 }, root.current!)

        // Cards arrive along z, staggered, each tied to its own scroll
        // position so they land as the trace reaches them.
        gsap.utils.toArray<HTMLElement>('[data-fact]').forEach((el, i) => {
          gsap.fromTo(
            el,
            { y: 70, z: -180, rotateX: 10, autoAlpha: 0 },
            {
              y: 0,
              z: 0,
              rotateX: 0,
              autoAlpha: 1,
              duration: 1,
              ease: 'expo.out',
              delay: i * 0.06,
              scrollTrigger: { trigger: el, start: 'top 88%', once: true },
            }
          )
        })
      }),
    []
  )

  return (
    <section
      ref={root}
      id="about"
      className="relative overflow-hidden px-6 py-24 sm:py-32 xl:px-20 2xl:px-28"
      aria-labelledby="about-heading"
    >
      {/* Backdrop: generated art if present, otherwise a green bloom. */}
      <img
        src="/img/about-backdrop.webp"
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25 [mask-image:radial-gradient(70%_70%_at_20%_50%,#000,transparent)]"
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-1/3 -z-10 size-[36rem] rounded-full bg-[#00FF87] opacity-[0.07] blur-[140px]"
      />

      <div className="shell">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
          <header>
            <div data-reveal>
              <Eyebrow>How it works</Eyebrow>
            </div>
            <h2 id="about-heading" data-reveal="0.06" className="mt-6 text-h2">
              About the <span className="text-[#00FF87]">League</span>
            </h2>
            <p data-reveal="0.12" className="mt-5 max-w-xl text-lead text-muted">
              One rule set, one starting balance, one winner. Twelve days of
              live market conditions on a demo account, so the only thing you
              can lose is the lead.
            </p>

            <p data-reveal="0.18" className="mt-8 border-l border-[rgba(0,255,135,0.35)] pl-5 text-lead font-medium text-white">
              No deposit. No experience required. The board does not care who
              you were on the 6th.
            </p>
          </header>

          {/* Drifts against the scroll direction — the parallax is what sells
              it as floating in front of the backdrop rather than pasted on.
              The dial runs a power-on self-test when it scrolls into view,
              then settles on where the front of the board tends to finish. */}
          <div
            ref={card}
            className="relative mx-auto hidden w-full max-w-xl lg:block"
          >
            <div
              aria-hidden
              className="absolute inset-10 rounded-full bg-[#00FF87] opacity-20 blur-[90px]"
            />
            <Gauge className="relative drop-shadow-[0_40px_80px_rgba(0,0,0,0.8)]" />
          </div>
        </div>

        {/* One measured trace runs card to card and on into the instrument
            panel, so the three facts read as one run rather than three
            floating boxes. The offsets are the reason it exists: staggered
            cards with nothing between them just look misaligned. */}
        <div ref={rail} className="relative mt-16">
          <CircuitRail containerRef={rail} />

          <div className="relative grid gap-y-6 md:grid-cols-3 md:gap-x-10 md:pb-16 md:[&>*:nth-child(2)]:translate-y-8 md:[&>*:nth-child(3)]:translate-y-16">
            {FACTS.map((f) => {
              const Icon = f.icon
              return (
                <div key={f.label} data-node className="h-full">
                  <GlassCard className="group h-full p-7 [transform-style:preserve-3d]">
                    <div data-fact>
                      <div className="flex size-16 items-center justify-center rounded-2xl border border-[rgba(0,255,135,0.22)] bg-[rgba(0,255,135,0.07)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110">
                        <IconArt
                          src={f.img}
                          fallback={Icon}
                          className="h-11 w-auto max-w-11"
                        />
                      </div>

                      <p className="mt-6 text-micro font-semibold uppercase text-muted">
                        {f.label}
                      </p>

                      <p className="mt-2 font-display text-figure text-white">
                        {'counter' in f && f.counter ? (
                          <Counter to={f.counter} prefix="$" />
                        ) : (
                          f.value
                        )}
                      </p>

                      <p className="mt-4 text-body text-muted">{f.body}</p>
                    </div>
                  </GlassCard>
                </div>
              )
            })}
          </div>

          {/* One instrument, three cells: the conditions every entrant trades
            under. Same feed, sealed accounts, live volatility. */}
          <div ref={panel} data-node className="mt-14">
            <Telemetry />
          </div>
        </div>
      </div>
    </section>
  )
}

import { useLayoutEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { Award, Medal, Trophy } from 'lucide-react'
import { GlassCard } from './ui/GlassCard'
import { Counter } from './ui/Counter'
import { Eyebrow } from './ui/Eyebrow'
import { IconArt } from './ui/IconArt'
import { depthIn, viewportOnce } from '../lib/motion'
import { parallax, scrollScene } from '../lib/scrollScene'

// DOM order is 1-2-3: that is the reading order on mobile and for screen
// readers. Only desktop reorders it into a podium, via `order`.
const PRIZES = [
  {
    place: '1st',
    amount: 100000,
    icon: Trophy,
    img: '/img/trophy-1.webp',
    order: 'md:order-2',
    drop: '',
    pad: 'pt-14 pb-11',
    art: 'h-40',
    plinth: 'h-14',
    ring: 'border-[rgba(0,255,135,0.42)]',
    glow: 'rgba(0,255,135,0.20)',
    scale: 'md:scale-[1.06]',
  },
  {
    place: '2nd',
    amount: 50000,
    icon: Medal,
    img: '/img/trophy-2.webp',
    order: 'md:order-1',
    drop: 'md:mb-[-28.3%]',
    pad: 'pt-9 pb-8',
    art: 'h-24',
    plinth: 'h-6',
    ring: 'border-white/12',
    glow: 'rgba(255,255,255,0.05)',
    scale: '',
  },
  {
    place: '3rd',
    amount: 25000,
    icon: Award,
    img: '/img/trophy-3.webp',
    order: 'md:order-3',
    drop: 'md:mb-[-28.3%]',
    pad: 'pt-9 pb-8',
    art: 'h-24',
    plinth: 'h-6',
    ring: 'border-white/10',
    glow: 'rgba(255,255,255,0.04)',
    scale: '',
  },
] as const

export function Prizes() {
  const root = useRef<HTMLElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const streak = useRef<HTMLImageElement>(null)

  useLayoutEffect(
    () =>
      scrollScene(root.current, () => {
        // The podium rises into place as the section is read, and the light
        // leak across the head drifts the other way.
        parallax(stage.current, { yPercent: -9 }, root.current!)
        parallax(streak.current, { yPercent: 55, opacity: 0.15 }, root.current!)
      }),
    [],
  )

  return (
    <section
      ref={root}
      id="prizes"
      className="relative overflow-hidden px-6 pb-20 pt-24 sm:pb-24 sm:pt-32 xl:px-20 2xl:px-28"
      aria-labelledby="prizes-heading"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 -z-10 size-[44rem] -translate-x-1/2 rounded-full bg-[#00FF87] opacity-[0.06] blur-[160px]"
      />

      {/* Light-leak streak across the section head. `screen` drops the black
          the generator baked around the glow. */}
      <img
        src="/img/streak.webp"
        alt=""
        aria-hidden
        ref={streak}
        loading="lazy"
        className="pointer-events-none absolute inset-x-0 top-4 -z-10 h-40 w-full object-cover opacity-55 mix-blend-screen"
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />

      <div className="shell">
        {/* Split head: the argument on the left, the number on the right.
            A centred block here left both margins doing nothing and buried
            the one figure the section exists to state. */}
        <header className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between md:gap-16">
          {/* Hangs into the left margin on wide screens, the same as the
              registration head. The measure on the heading is wider than the
              one on the body copy on purpose: display type needs the room,
              reading type does not want it. */}
          <div>
            <div data-reveal>
              <Eyebrow>Paid in cash</Eyebrow>
            </div>
            <h2
              id="prizes-heading"
              data-reveal="0.06"
              className="mt-6 max-w-3xl text-h2"
            >
              Three traders{' '}
              <span className="text-[#00FF87]">take the pool</span>
            </h2>
            <p
              data-reveal="0.12"
              className="mt-6 max-w-xl text-lead text-muted"
            >
              Paid to the three traders who grow their demo balance the most by
              the close of 18 September. Everyone else keeps the track record.
            </p>
          </div>

          <p data-reveal="0.1" className="shrink-0 md:text-right">
            <span className="block font-mono text-nano uppercase text-muted">
              Total pool
            </span>
            <span className="tabular mt-2 block font-display text-h2 text-[#00FF87]">
              <Counter to={175000} prefix="$" duration={2200} />
            </span>
          </p>
        </header>

        {/* The cards stand on the podium art. Padding-bottom is a percentage
            of the container WIDTH, so the overlap stays proportional as the
            podium scales  roughly half of it sits behind the cards. */}
        <div ref={stage}>
          <div className="relative isolate mt-16 md:origin-top md:scale-[0.85] md:pb-[25.45%] md:-mb-[7%]">
            <img
              src="/img/podium.webp"
              alt=""
              aria-hidden
              loading="lazy"
              className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 hidden w-full select-none md:block"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />

            <div className="relative z-10 grid gap-6 md:grid-cols-3 md:items-end md:gap-7">
              {PRIZES.map((p, i) => {
                const first = p.place === '1st'
                const Icon = p.icon
                return (
                  <motion.div
                    key={p.place}
                    className={`relative ${p.order} ${p.drop} ${p.scale}`}
                    variants={depthIn}
                    custom={i}
                    initial="hidden"
                    whileInView="show"
                    viewport={viewportOnce}
                  >
                    {/* Sits outside GlassCard: the card clips its own overflow
                    so the sheen stays inside the rounded corners. */}
                    {first && (
                      <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-[linear-gradient(180deg,#5cffb4,#00c853)] px-3.5 py-1 text-nano font-bold uppercase text-black shadow-[0_6px_24px_-4px_rgba(0,255,135,0.7)]">
                        Champion
                      </span>
                    )}

                    <GlassCard
                      tilt={first ? 9 : 6}
                      className={`group relative flex flex-col items-center border ${p.ring} px-7 ${p.pad} text-center`}
                    >
                      {/* Carbon/mesh surface, kept faint so the type stays the
                      brightest thing on the card. */}
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 bg-[url('/img/card-texture.webp')] bg-cover bg-center opacity-[0.22] mix-blend-luminosity"
                      />
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 opacity-70"
                        style={{
                          background: `radial-gradient(120% 70% at 50% 0%, ${p.glow}, transparent 60%)`,
                        }}
                      />

                      <div
                        className={`relative flex items-end justify-center transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-2 ${p.art}`}
                      >
                        <IconArt
                          src={p.img}
                          fallback={Icon}
                          className={`h-full w-auto ${first ? '' : 'opacity-90'}`}
                        />
                        {/* Contact shadow  without it the trophy floats. */}
                        <span
                          aria-hidden
                          className="absolute -bottom-1 left-1/2 h-5 w-[70%] -translate-x-1/2 rounded-[50%] bg-[#00FF87] opacity-30 blur-lg"
                        />
                      </div>

                      <p className="mt-7 text-micro font-semibold uppercase text-muted">
                        {p.place} place
                      </p>

                      <p
                        className={`mt-2 font-display ${
                          first
                            ? 'text-figure text-[#00FF87]'
                            : 'text-h3 text-white'
                        }`}
                      >
                        <Counter
                          to={p.amount}
                          prefix="$"
                          duration={first ? 2000 : 1500}
                        />
                      </p>

                      {/* Bottom rim only  the podium art below supplies the
                      actual plinth now. */}
                      <div
                        aria-hidden
                        className="mt-8 h-px w-full bg-[linear-gradient(90deg,transparent,rgba(0,255,135,0.35),transparent)]"
                      />
                    </GlassCard>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

import { motion } from 'motion/react'
import LaurelWreath from '~icons/tabler/laurel-wreath'
import Medal from '~icons/tabler/medal-2'
import Podium from '~icons/tabler/podium'
import Trophy from '~icons/tabler/trophy-filled'
import { GlassCard } from './ui/GlassCard'
import { Counter } from './ui/Counter'
import { IconArt } from './ui/IconArt'
import { depthIn, viewportOnce } from '../lib/motion'

// DOM order is 1-2-3-4: that is the reading order on mobile and for screen
// readers. Only desktop reorders it into a podium, via `md:col-start-*`.
//
// The desktop grid tiles podium-4tier.webp (1620x452) in image pixels, so a
// card's column centre IS its platform's centre. Measured from the art:
// platforms span 41-351, 382-699, 732-1031, 1045-1595, i.e. centres at
// 196 / 540.5 / 881.5 / 1320. Columns 36|320|369|313|564|18 reproduce those
// four centres exactly and still sum to 1620. The grid therefore runs at
// gap-0 -- a gap would take width the podium art has not got, which is what
// pushed every card left of its platform. Gutters come from `cell` padding
// instead: padding sits inside the column, so it cannot move the centre.
// `md:row-start-1` is not decoration: a definite column with an auto row makes
// the placement cursor wrap, and the champion would sit alone on row 1 with
// the rest below it.
//
// Card padding tightens below xl on purpose. An `fr` column cannot shrink
// under its item's min-content width, and a roomy "$1,000" floors the
// champion column; once one column is floored the rest lose the ratio and
// every card slides off its platform again.
//
// `drop` is how far below the champion each card sits. A percentage margin on
// a grid item resolves against ITS OWN grid area, so each value is the
// platform's top offset divided by that column's width, both in image pixels
// -- the ratio holds at every breakpoint. Tops: 2nd +128, 3rd +167, 4th +251.
const PRIZES = [
  {
    place: '1st',
    label: '1st place',
    amount: 1000,
    icon: Trophy,
    img: '/img/trophy-1.webp',
    // Wider padding than the rest: this column is the widest, and
    // md:scale-[1.06] widens the card again. It keeps it inside its platform.
    cell: 'md:col-start-3 md:row-start-1 md:px-3 xl:px-5',
    drop: '',
    pad: 'pt-14 pb-10',
    art: 'h-32',
    plinth: 'h-14',
    ring: 'border-[rgba(0,255,135,0.42)]',
    glow: 'rgba(0,255,135,0.20)',
    scale: 'md:scale-[1.06]',
  },
  {
    place: '2nd',
    label: '2nd place',
    amount: 500,
    icon: Medal,
    img: '/img/trophy-2.webp',
    cell: 'md:col-start-2 md:row-start-1 md:px-2 xl:px-3',
    drop: 'md:mb-[-40%]',
    pad: 'pt-10 pb-8',
    art: 'h-20',
    plinth: 'h-6',
    ring: 'border-white/12',
    glow: 'rgba(255,255,255,0.05)',
    scale: '',
  },
  {
    place: '3rd',
    label: '3rd place',
    amount: 250,
    icon: LaurelWreath,
    img: '/img/trophy-3.webp',
    cell: 'md:col-start-4 md:row-start-1 md:px-2 xl:px-3',
    drop: 'md:mb-[-53.4%]',
    pad: 'pt-10 pb-8',
    art: 'h-20',
    plinth: 'h-6',
    ring: 'border-white/10',
    glow: 'rgba(255,255,255,0.04)',
    scale: '',
  },
  {
    // What one person in the band takes, matching the three cards beside it
    // -- the $2,350 pot across 47 places would read as a single prize. The
    // card still reads as a band, not a position: widest plinth, lowest step,
    // dimmest ring.
    place: '4th',
    label: '4th \u2013 50th place',
    amount: 50,
    icon: Podium,
    img: '/img/trophy-4.webp',
    cell: 'md:col-start-5 md:row-start-1 md:px-2 xl:px-3',
    drop: 'md:mb-[-44.5%]',
    pad: 'pt-10 pb-8',
    art: 'h-16',
    plinth: 'h-6',
    ring: 'border-white/8',
    glow: 'rgba(255,255,255,0.03)',
    scale: '',
  },
] as const

export function Prizes() {
  return (
    <section
      id="prizes"
      className="relative overflow-hidden px-6 pb-20 pt-28 sm:pb-24 sm:pt-36"
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
        loading="lazy"
        className="pointer-events-none absolute inset-x-0 top-4 -z-10 h-40 w-full object-cover opacity-55 mix-blend-screen"
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />

      <div className="mx-auto max-w-[76rem]">
        <header className="mx-auto max-w-2xl text-center">
          <h2
            id="prizes-heading"
            className="text-[clamp(2.1rem,5.2vw,3.6rem)] font-bold leading-[1.05]"
          >
            <span className="text-[#00FF87]">Prizes</span>
          </h2>
          <p className="mt-5 text-[1.05rem] leading-relaxed text-[#E4EAE7]">
            Paid to the fifty traders who grow their demo balance the most by
            the close of 18 September.
          </p>
        </header>

        {/* The cards stand on the podium art. Padding-bottom is a percentage
            of the container WIDTH, so the overlap stays proportional as the
            podium scales  roughly half of it sits behind the cards. */}
        <div className="relative isolate mt-20 md:pb-[27.9%]">
          <img
            src="/img/podium-4tier.webp"
            alt=""
            aria-hidden
            loading="lazy"
            className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 hidden w-full select-none md:block"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />

          <div className="relative z-10 grid gap-6 md:grid-cols-[36fr_320fr_369fr_313fr_564fr_18fr] md:items-end md:gap-0">
          {PRIZES.map((p, i) => {
            const first = p.place === '1st'
            const Icon = p.icon
            return (
              <motion.div
                key={p.place}
                className={`relative ${p.cell} ${p.drop} ${p.scale}`}
                variants={depthIn}
                custom={i}
                initial="hidden"
                whileInView="show"
                viewport={viewportOnce}
              >
                {/* Sits outside GlassCard: the card clips its own overflow
                    so the sheen stays inside the rounded corners. */}
                {first && (
                  <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-[linear-gradient(180deg,#5cffb4,#00c853)] px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-black shadow-[0_6px_24px_-4px_rgba(0,255,135,0.7)]">
                    Champion
                  </span>
                )}

                <GlassCard
                  tilt={first ? 9 : 6}
                  className={`group relative flex flex-col items-center border ${p.ring} px-4 xl:px-7 ${p.pad} text-center`}
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

                  <p className="mt-7 text-[12px] font-semibold uppercase tracking-[0.22em] text-[#E4EAE7]">
                    {p.label}
                  </p>

                  <p
                    className={`mt-2 font-bold leading-none tracking-tight ${
                      first
                        ? 'text-[clamp(2.2rem,4.5vw,3rem)] text-[#00FF87] text-glow'
                        : 'text-[clamp(1.75rem,3.6vw,2.25rem)] text-white'
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
    </section>
  )
}

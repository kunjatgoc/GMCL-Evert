import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { CalendarDays, Globe2, UserCheck, Users } from 'lucide-react'
import { Counter } from '../components/ui/Counter'
import { COUNTRIES } from '../lib/countries'
import { EASE, depthIn } from '../lib/motion'
import { getStats, type Stats } from './api'
import { TEXT } from '../panel/type'
import { StatsSkeleton, useDelayed } from '../panel/Skeleton'
import { TrendChart } from './TrendChart'

const nameFor = (code: string) =>
  COUNTRIES.find((c) => c.code === code)?.name ?? code

const flagFor = (code: string) => COUNTRIES.find((c) => c.code === code)?.flag ?? '·'

function Card({
  label,
  value,
  sub,
  icon: Icon,
  index,
  accent = false,
}: {
  label: string
  value: number
  sub: string
  icon: typeof Users
  index: number
  /** The one card whose number is green. Rule 2: one green accent per view --
   *  four identical green numbers is four accents, which is none. */
  accent?: boolean
}) {
  return (
    <motion.div
      className="glass glass-lip group relative overflow-hidden rounded-2xl bg-[var(--admin-card)] p-5"
      variants={depthIn}
      custom={index}
      initial="hidden"
      animate="show"
      // Lifts toward the cursor. A spring rather than a duration, so it
      // settles on the way up and follows the pointer back down.
      whileHover={{ y: -5, transition: { type: 'spring', stiffness: 380, damping: 24 } }}
    >
      {/* Engraved instrument grid, not the prize cards' carbon weave: this
          card holds a measurement, and the surface should say so. */}
      <img
        src="/img/data-texture.webp"
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.22] mix-blend-screen"
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />
      {/* Deep Forest, not Signal Green: the card needs depth in its corner,
          not a second thing glowing next to the number. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-[radial-gradient(circle,rgba(31,92,65,0.55),transparent_70%)] opacity-70 transition-opacity duration-500 group-hover:opacity-100"
      />

      <span className="relative flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04]">
          <Icon className="size-4 text-[var(--admin-muted)]" />
        </span>
        <span className={`${TEXT.label} font-semibold uppercase tracking-[0.1em] text-[var(--admin-muted)]`}>
          {label}
        </span>
      </span>

      <Counter
        to={value}
        className={`${TEXT.display} relative mt-5 block font-bold leading-none ${
          accent ? 'text-[var(--admin-primary)]' : 'text-white'
        }`}
      />
      <p className={`${TEXT.label} relative mt-2.5 text-[var(--admin-muted)]`}>{sub}</p>
    </motion.div>
  )
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const showSkeleton = useDelayed()

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load.'))
  }, [])

  if (error) return <p className={`${TEXT.body} text-[var(--admin-destructive)]`}>{error}</p>
  if (!stats) return showSkeleton ? <StatsSkeleton /> : null

  const busiest = stats.top_countries[0]?.entries ?? 1
  // Share is of every entrant, not of the five shown, or the percentages add
  // up to 100 and imply these are the only countries.
  const total = Math.max(1, stats.demo_total)

  return (
    <section>
      <header>
        {/* The hero's masked reveal, scaled down to a page heading: the line
            rises out from behind a hard clip rather than fading in. */}
        <h1
          className={`${TEXT.display} overflow-hidden pb-[0.1em] font-bold leading-[1.05]`}
        >
          <motion.span
            className="block"
            initial={{ y: '110%' }}
            animate={{ y: '0%' }}
            transition={{ duration: 0.9, ease: EASE }}
          >
            Dashboard
          </motion.span>
        </h1>
      </header>

      <div className="mt-6 grid gap-4 [perspective:1400px] sm:grid-cols-2 xl:grid-cols-4">
        {/* The league's headline number, and the only green one. */}
        <Card
          index={0}
          accent
          label="Demo ID users"
          value={stats.demo_total}
          sub={`${stats.demo_today} today · ${stats.demo_week} this week`}
          icon={Users}
        />
        <Card
          index={1}
          label="Real ID users"
          value={stats.real_total}
          sub={`${stats.real_today} today · ${stats.real_week} this week`}
          icon={UserCheck}
        />
        <Card
          index={2}
          label="Signed up today"
          value={stats.demo_today + stats.real_today}
          sub="Demo and real combined"
          icon={CalendarDays}
        />
        <Card
          index={3}
          label="Countries"
          value={stats.countries}
          sub="Represented by demo entrants"
          icon={Globe2}
        />
      </div>

      {/* Wide chart, narrow ranking. The two are not equals: one is the shape
          of the campaign, the other is a footnote to it. */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.65fr_1fr]">
      <motion.div
        className="glass glass-lip relative overflow-hidden rounded-2xl bg-[var(--admin-card)] p-6"
        variants={depthIn}
        custom={4}
        initial="hidden"
        animate="show"
      >
        <h2 className={`${TEXT.body} font-semibold tracking-tight text-white`}>
          Signups per day
        </h2>
        <div className="mt-5">
          <TrendChart data={stats.daily} />
        </div>
      </motion.div>

      <motion.div
        className="glass glass-lip relative overflow-hidden rounded-2xl bg-[var(--admin-card)] p-6"
        variants={depthIn}
        custom={5}
        initial="hidden"
        animate="show"
      >
        <h2 className={`${TEXT.body} font-semibold tracking-tight text-white`}>
          Where the entrants are
        </h2>

        <ul className="mt-5 space-y-4">
          {stats.top_countries.map((c, i) => (
            <motion.li
              key={c.country}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.5 + i * 0.07 }}
            >
              <span className={`${TEXT.body} flex items-center gap-2.5`}>
                <span aria-hidden>{flagFor(c.country)}</span>
                <span className="truncate text-[#E4EAE7]">
                  {nameFor(c.country)}
                </span>
                <span className="tabular ml-auto shrink-0 font-semibold text-white">
                  {c.entries}
                </span>
                <span className={`${TEXT.label} tabular w-12 shrink-0 text-right text-[var(--admin-muted)]`}>
                  {Math.round((c.entries / total) * 100)}%
                </span>
              </span>

              {/* Bar widths are relative to the biggest row, not to the total:
                  it is a ranking, and scaling to the total would flatten every
                  bar into a stub once the list is long. The percentage above
                  is the share, and says so. */}
              <span className="mt-2 block h-2.5 overflow-hidden rounded-full bg-white/[0.05]">
                <motion.span
                  className="block h-full rounded-full bg-[linear-gradient(90deg,#22A968,#3EE68A)] shadow-[0_0_18px_-2px_rgba(62,230,138,0.7)]"
                  style={{ minWidth: 4 }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(c.entries / busiest) * 100}%` }}
                  transition={{ duration: 1, ease: EASE, delay: 0.6 + i * 0.07 }}
                />
              </span>
            </motion.li>
          ))}
        </ul>
      </motion.div>
      </div>
    </section>
  )
}

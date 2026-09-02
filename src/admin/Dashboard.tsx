import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { CalendarDays, Globe2, UserCheck, Users } from 'lucide-react'
import { Counter } from '../components/ui/Counter'
import { COUNTRIES } from '../lib/countries'
import { EASE, depthIn } from '../lib/motion'
import { getStats, type Stats } from './api'
import { TEXT } from './type'
import { StatsSkeleton, useDelayed } from './Skeleton'

const nameFor = (code: string) =>
  COUNTRIES.find((c) => c.code === code)?.name ?? code

const flagFor = (code: string) => COUNTRIES.find((c) => c.code === code)?.flag ?? '·'

function Card({
  label,
  value,
  sub,
  icon: Icon,
  index,
}: {
  label: string
  value: number
  sub: string
  icon: typeof Users
  index: number
}) {
  return (
    <motion.div
      className="glass glass-lip group relative overflow-hidden rounded-2xl p-5"
      variants={depthIn}
      custom={index}
      initial="hidden"
      animate="show"
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
      {/* Corner bloom, brightening on hover so the card answers the cursor. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-[radial-gradient(circle,rgba(0,255,135,0.22),transparent_70%)] opacity-60 transition-opacity duration-500 group-hover:opacity-100"
      />

      <span className="relative flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-[rgba(0,255,135,0.25)] bg-[rgba(0,255,135,0.08)]">
          <Icon className="size-4 text-[#00FF87]" />
        </span>
        <span className={`${TEXT.label} font-semibold uppercase tracking-[0.1em] text-[#E4EAE7]/85`}>
          {label}
        </span>
      </span>

      <Counter
        to={value}
        className={`${TEXT.display} relative mt-5 block font-bold leading-none text-white`}
      />
      <p className={`${TEXT.label} relative mt-2.5 text-[#E4EAE7]/70`}>{sub}</p>
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

  if (error) return <p className={`${TEXT.body} text-[#ff9a9a]`}>{error}</p>
  if (!stats) return showSkeleton ? <StatsSkeleton /> : null

  const busiest = stats.top_countries[0]?.entries ?? 1

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
            Dash<span className="text-[#00FF87] text-glow">board</span>
          </motion.span>
        </h1>
      </header>

      <div className="mt-8 grid gap-4 [perspective:1400px] sm:grid-cols-2 xl:grid-cols-4">
        <Card
          index={0}
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

      <motion.div
        className="glass glass-lip relative mt-6 overflow-hidden rounded-2xl p-6"
        variants={depthIn}
        custom={4}
        initial="hidden"
        animate="show"
      >
        <h2 className={`${TEXT.label} font-semibold uppercase tracking-[0.1em] text-[#E4EAE7]/85`}>
          Where the entrants are
        </h2>

        <ul className="mt-5 space-y-3.5">
          {stats.top_countries.map((c, i) => (
            <motion.li
              key={c.country}
              className="flex items-center gap-4"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.5 + i * 0.07 }}
            >
              <span className={`${TEXT.body} flex w-64 shrink-0 items-center gap-2.5`}>
                <span aria-hidden>{flagFor(c.country)}</span>
                <span className="truncate text-[#E4EAE7]">
                  {nameFor(c.country)}
                </span>
              </span>

              {/* Widths are relative to the biggest row, not to the total: it
                  is a ranking, and scaling to the total would flatten every
                  bar into a stub once the list is long. */}
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                <motion.span
                  className="block h-full rounded-full bg-[linear-gradient(90deg,#00c853,#00FF87)] shadow-[0_0_18px_-2px_rgba(0,255,135,0.7)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${(c.entries / busiest) * 100}%` }}
                  transition={{ duration: 1, ease: EASE, delay: 0.6 + i * 0.07 }}
                />
              </span>

              <span className={`${TEXT.body} tabular w-16 shrink-0 text-right font-semibold text-white`}>
                {c.entries}
              </span>
            </motion.li>
          ))}
        </ul>
      </motion.div>
    </section>
  )
}

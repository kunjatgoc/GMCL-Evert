import { useEffect, useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import { Loader2 } from 'lucide-react'
import CalendarEvent from '~icons/tabler/calendar-event'
import ChartCandle from '~icons/tabler/chart-candle'
import Moneybag from '~icons/tabler/moneybag'
import Trophy from '~icons/tabler/trophy-filled'
import { getLeagueEntry, joinLeague, type LeagueEntry } from './api'
import { Unauthorized } from '../lib/api'
import { EASE } from '../lib/motion'
import { TEXT, btnPrimary, control, fieldLabel } from '../panel/type'
import { ErrorAlert } from '../components/auth/FormAlert'

/**
 * The league announcement, and the one thing it asks for.
 *
 * Written as a landing page rather than another panel screen: the entrant has
 * already signed in and already has a MetaID, so this page is not informing
 * them of a status, it is selling them a week. That is why the hero sits on
 * the bare panel ground with no card around it, and why exactly one thing on
 * the page wears a border and an accent -- the box that takes the MetaID.
 * Five equal cards would say five equal things.
 */

/** Local midnight, so a comparison counts days and not hours. */
const midnight = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/** Whole days from `a` to `b`. Rounded because a DST boundary makes one of
 *  them 23 or 25 hours long, and this is a count of dates, not of hours. */
const daysBetween = (a: Date, b: Date) =>
  Math.round((midnight(b) - midnight(a)) / 86_400_000)

/** Month is 0-based: 8 is September. */
export const LEAGUE_START = new Date(2026, 8, 7)
export const LEAGUE_END = new Date(2026, 8, 13)
export const LEAGUE_DAYS = daysBetween(LEAGUE_START, LEAGUE_END) + 1

export type Phase =
  | { name: 'before'; days: number }
  | { name: 'running'; day: number }
  | { name: 'after' }

/**
 * Where today sits against the league window.
 *
 * Exported because it is the only logic on this page and the only thing worth
 * a test: a date screen that quietly goes stale is the failure mode, and this
 * function is where that would happen.
 */
export function leaguePhase(now: Date): Phase {
  const until = daysBetween(now, LEAGUE_START)
  if (until > 0) return { name: 'before', days: until }
  const day = 1 - until
  return day <= LEAGUE_DAYS ? { name: 'running', day } : { name: 'after' }
}

export const phaseLabel = (p: Phase) =>
  p.name === 'before'
    ? p.days === 1
      ? 'Starts tomorrow'
      : `Starts in ${p.days} days`
    : p.name === 'running'
      ? `Day ${p.day} of ${LEAGUE_DAYS}, trading now`
      : 'This league has finished'

/** The seven dates themselves. Built from the start date so the strip cannot
 *  drift out of step with the window above it. */
const DAYS = Array.from(
  { length: LEAGUE_DAYS },
  (_, i) => new Date(2026, 8, LEAGUE_START.getDate() + i)
)

const weekday = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short' })

const longDate = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })

const joinedOn = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

const FACTS = [
  {
    icon: CalendarEvent,
    value: `${LEAGUE_DAYS} days`,
    body: `${weekday(LEAGUE_START)} ${longDate(LEAGUE_START)} to ${weekday(LEAGUE_END)} ${longDate(LEAGUE_END)}.`,
  },
  {
    icon: Moneybag,
    value: '$10,000',
    body: 'Demo capital. The same for everyone, and none of it is your own.',
  },
  {
    icon: ChartCandle,
    value: 'Biggest gain',
    body: 'Whoever grows their account the most by the last day wins.',
  },
]

/** Sits between the hero and the strip, one line, no decoration of its own. */
function PhaseLine({ phase }: { phase: Phase }) {
  const live = phase.name === 'running'
  return (
    <p className={`${TEXT.label} flex items-center gap-2.5`}>
      <span
        aria-hidden
        className={`size-2 rounded-full ${live ? 'bg-[var(--admin-primary)]' : 'bg-[var(--admin-muted)]'}`}
      />
      <span className={live ? 'text-[var(--admin-primary)]' : 'text-[var(--admin-muted)]'}>
        {phaseLabel(phase)}
      </span>
    </p>
  )
}

/** The week, as a week. Seven tiles because the league is seven days, which
 *  is a fact about this league and not a layout that happened to fit. */
function DayStrip({ phase }: { phase: Phase }) {
  return (
    <ol className="mt-7 grid grid-cols-4 gap-2 sm:grid-cols-7 sm:gap-2.5">
      {DAYS.map((d, i) => {
        const today = phase.name === 'running' && phase.day === i + 1
        const done = phase.name === 'after' || (phase.name === 'running' && i + 1 < phase.day)
        return (
          <motion.li
            key={d.toISOString()}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: EASE, delay: 0.12 + i * 0.03 }}
            aria-current={today ? 'date' : undefined}
            className={`rounded-xl border px-3 py-3 text-center ${
              today
                ? 'border-[rgba(62,230,138,0.5)] bg-[rgba(62,230,138,0.1)]'
                : 'border-white/8 bg-white/[0.02]'
            } ${done && !today ? 'opacity-45' : ''}`}
          >
            <span
              className={`${TEXT.label} block text-[var(--admin-muted)]`}
            >
              {weekday(d)}
            </span>
            <span
              className={`${TEXT.body} tabular mt-0.5 block font-semibold ${
                today ? 'text-[var(--admin-primary)]' : 'text-[#E4EAE7]'
              }`}
            >
              {d.getDate()}
            </span>
          </motion.li>
        )
      })}
    </ol>
  )
}

/** Takes the MetaID, or shows the one already taken. The only bordered thing
 *  on the page, because it is the only thing the page wants. */
function JoinBox({
  entry,
  onJoined,
}: {
  entry: LeagueEntry | null | undefined
  onJoined: (e: LeagueEntry) => void
}) {
  const [metaid, setMetaid] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await joinLeague(metaid)
      // Read it back rather than assume: the address on the row is chosen by
      // the database, so the screen would otherwise be guessing at it.
      const saved = await getLeagueEntry()
      if (saved) onJoined(saved)
    } catch (err) {
      if (err instanceof Unauthorized) window.location.href = '/login'
      else setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  if (entry === undefined) {
    return (
      <div className="mt-8 h-[8.5rem] animate-pulse rounded-2xl border border-white/8 bg-white/[0.02]" />
    )
  }

  if (entry) {
    return (
      <section className="mt-8 rounded-2xl border border-[rgba(62,230,138,0.35)] bg-[rgba(62,230,138,0.06)] p-6 sm:p-7">
        <div className="flex items-start gap-3.5">
          <span
            aria-hidden
            className="grid size-11 shrink-0 place-items-center rounded-xl border border-[rgba(62,230,138,0.3)] bg-[rgba(62,230,138,0.1)] text-[var(--admin-primary)]"
          >
            <Trophy className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className={`${TEXT.body} font-semibold`}>You are in the league</h2>
            <p className={`${TEXT.label} mt-1 text-[var(--admin-muted)]`}>
              Joined {joinedOn(entry.created_at)}
            </p>
          </div>
        </div>

        <dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          <div>
            <dt className={`${TEXT.label} text-[var(--admin-muted)]`}>MetaID</dt>
            <dd className={`${TEXT.body} mt-1.5 break-words font-semibold text-white`}>
              {entry.metaid}
            </dd>
          </div>
          <div>
            <dt className={`${TEXT.label} text-[var(--admin-muted)]`}>Email</dt>
            <dd className={`${TEXT.body} mt-1.5 break-words text-[#E4EAE7]`}>
              {entry.email}
            </dd>
          </div>
        </dl>
      </section>
    )
  }

  return (
    <section className="mt-8 rounded-2xl border border-[rgba(62,230,138,0.28)] bg-[var(--admin-card)] p-6 sm:p-7">
      <h2 className={`${TEXT.body} font-semibold`}>Enter with your MetaID</h2>
      <p className={`${TEXT.label} mt-1.5 max-w-prose text-[var(--admin-muted)]`}>
        The one newera approved for you. Find it on the Request a MetaID screen
        if you are not sure.
      </p>

      <form onSubmit={submit} className="mt-6">
        <label className={`${fieldLabel} mb-2 block`} htmlFor="league-metaid">
          MetaID
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="league-metaid"
            name="metaid"
            required
            maxLength={120}
            autoComplete="off"
            spellCheck={false}
            value={metaid}
            onChange={(e) => setMetaid(e.target.value)}
            placeholder="e.g. NW-4821903"
            className={`${control} w-full sm:flex-1`}
          />
          <button
            type="submit"
            disabled={busy || !metaid.trim()}
            className={`${btnPrimary} shrink-0`}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Trophy className="size-4" />}
            Join the league
          </button>
        </div>
        {error && (
          <div className="mt-4">
            <ErrorAlert>{error}</ErrorAlert>
          </div>
        )}
      </form>
    </section>
  )
}

export function LeagueScreen() {
  const [entry, setEntry] = useState<LeagueEntry | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  // Read once, at mount. The window does not move while the screen is open.
  const [phase] = useState(() => leaguePhase(new Date()))

  useEffect(() => {
    getLeagueEntry()
      .then(setEntry)
      .catch((e) => {
        if (e instanceof Unauthorized) window.location.href = '/login'
        else {
          setEntry(null)
          setError('We could not check whether you have joined. Try again.')
        }
      })
  }, [])

  return (
    <div className="xl:max-w-4xl">
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
      >
        <p
          className={`${TEXT.label} inline-flex items-center rounded-full border border-[rgba(62,230,138,0.28)] bg-[rgba(62,230,138,0.07)] px-3.5 py-1.5 font-semibold uppercase tracking-[0.12em] text-[var(--admin-primary)]`}
        >
          {longDate(LEAGUE_START)} to {longDate(LEAGUE_END)} 2026
        </p>

        <h1
          className={`${TEXT.display} mt-5 font-[family-name:var(--font-display)] font-bold leading-[1.05]`}
        >
          Seven days on the
          <br className="hidden sm:block" /> leaderboard
        </h1>

        <p className={`${TEXT.body} mt-5 max-w-prose text-[#E4EAE7]`}>
          Everyone starts the week with the same $10,000 demo account. Grow it
          the most by the end of {longDate(LEAGUE_END)} and you take first
          place. Nothing you deposit is at risk, because nothing is deposited.
        </p>

        <div className="mt-5">
          <PhaseLine phase={phase} />
        </div>
      </motion.header>

      <DayStrip phase={phase} />

      {error && (
        <div className="mt-6">
          <ErrorAlert>{error}</ErrorAlert>
        </div>
      )}

      <JoinBox entry={entry} onJoined={setEntry} />

      {/* Quiet by design: dividers, no cards. The one card on this page is the
          box above, and three more would flatten it back into a grid. */}
      <dl className="mt-10 grid gap-6 border-t border-white/8 pt-7 sm:grid-cols-3">
        {FACTS.map((f) => {
          const Icon = f.icon
          return (
            <div key={f.value}>
              <Icon className="size-5 text-[var(--admin-primary)]" aria-hidden />
              <dt className={`${TEXT.body} mt-3 font-semibold`}>{f.value}</dt>
              <dd className={`${TEXT.label} mt-1.5 leading-relaxed text-[var(--admin-muted)]`}>
                {f.body}
              </dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}

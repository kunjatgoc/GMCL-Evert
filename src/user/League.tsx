import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Loader2 } from 'lucide-react'
import CalendarEvent from '~icons/tabler/calendar-event'
import ChartCandle from '~icons/tabler/chart-candle'
import Moneybag from '~icons/tabler/moneybag'
import Trophy from '~icons/tabler/trophy-filled'
import { getLeagueEntry, joinLeague, type LeagueEntry } from './api'
import { Unauthorized } from '../lib/api'
import { EASE, viewportOnce } from '../lib/motion'
import { prefersReducedMotion } from '../lib/motionPreference'
import { TEXT, btnPrimary, control, fieldLabel } from '../panel/type'
import { ErrorAlert } from '../components/auth/FormAlert'

/**
 * The league announcement, built as a landing page rather than a panel screen.
 *
 * Every other screen here is a document: a heading, some rows, a quiet action.
 * This one has to sell a week, so it borrows the shape a landing page has --
 * a hero that fills the first screen, then stacked full-width sections that
 * argue for it one at a time, ending on the thing it wants. Sections rather
 * than one dense screen because an argument has an order, and a reader who is
 * already convinced can act from the hero without meeting the rest of it.
 *
 * It cancels the shell's gutter with a negative margin rather than the shell
 * learning about it: one screen wanting no margin is not a reason for four
 * others to grow a prop. Every band paints its own ground, so no part of the
 * page is ever bare.
 */

/** Four to six digits, e.g. 43563. Mirrors METAID_RE in api/index.py and the
 *  check constraint on league_entry; this copy only greys out the button. */
export const METAID_RE = /^[0-9]{4,6}$/

/** Local midnight, so a comparison counts days and not hours. */
const midnight = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/** Whole days from `a` to `b`. Rounded because a DST boundary makes one of
 *  them 23 or 25 hours long, and this is a count of dates, not of hours. */
const daysBetween = (a: Date, b: Date) =>
  Math.round((midnight(b) - midnight(a)) / 86_400_000)

/** Month is 0-based: 8 is September. */
export const LEAGUE_START = new Date(2026, 8, 7)
export const LEAGUE_END = new Date(2026, 8, 18)
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

/**
 * The prize table, as the marketing page states it. `places` is how many
 * people are paid at that rate, which is what makes 4th to 50th a band rather
 * than a fourth position.
 */
export const PRIZES = [
  { place: '1st', amount: 1000, places: 1 },
  { place: '2nd', amount: 500, places: 1 },
  { place: '3rd', amount: 250, places: 1 },
  { place: '4th to 50th', amount: 50, places: 47 },
] as const

/** Both totals are summed rather than written down, so a changed tier cannot
 *  leave a headline number saying something the table underneath denies. */
export const PRIZE_POOL = PRIZES.reduce((n, p) => n + p.amount * p.places, 0)
export const PRIZE_PLACES = PRIZES.reduce((n, p) => n + p.places, 0)

const money = (n: number) => `$${n.toLocaleString('en-US')}`

/** Named once: the hero's button scrolls to it and the band answers to it. */
const JOIN_ID = 'join'

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

/**
 * The three steps, in the order they actually happen. Numbered because this
 * genuinely is a sequence -- you cannot enter an account number nobody has
 * issued you -- and not because numbers look tidy on a landing page.
 */
const STEPS = [
  {
    icon: CalendarEvent,
    title: 'Get an account',
    body: 'Ask for one on the Request an Account screen. newera checks the address and answers.',
  },
  {
    icon: Moneybag,
    title: 'Enter it below',
    body: 'Type the account number newera approved. That is the whole entry, and it costs nothing.',
  },
  {
    icon: ChartCandle,
    title: 'Trade the week',
    body: `Everyone starts on ${longDate(LEAGUE_START)} with the same $10,000 of demo money.`,
  },
]

/**
 * Three bands, not five.
 *
 * A landing page argues in order, but this reader is already signed in and
 * already holds an account -- most of the argument is won before they arrive.
 * Three screens of scroll asks them to work for a form they came here to
 * fill in. So the week folds into the hero where the dates already are, and
 * the steps sit beside the prizes rather than above them.
 *
 * Bands meet through gradient rather than a rule. A hard border says "new
 * document"; a wash says "same page, further down", which is what a landing
 * page's sections actually are.
 */

/** Section heading, shared by the two bands under the hero so they read as
 *  one page rather than two designs. */
function BandHead({ eyebrow, title }: { eyebrow: string; title: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={viewportOnce}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <p className={`${fieldLabel} text-[var(--admin-primary)]`}>{eyebrow}</p>
      <h2 className="mt-2.5 font-[family-name:var(--font-display)] text-[clamp(1.7rem,2.9vw,2.4rem)] font-bold leading-[1.05] tracking-[-0.02em] text-white">
        {title}
      </h2>
    </motion.div>
  )
}

/** One line under the headline, saying where today sits in the window. */
function PhaseLine({ phase }: { phase: Phase }) {
  const live = phase.name === 'running'
  return (
    <p className="flex items-center gap-2.5 text-[13px]">
      <span
        aria-hidden
        className={`size-2 rounded-full ${
          live ? 'animate-pulse bg-[var(--admin-primary)]' : 'bg-[var(--admin-muted)]'
        }`}
      />
      <span
        className={`font-semibold uppercase tracking-[0.14em] ${
          live ? 'text-[var(--admin-primary)]' : 'text-[var(--admin-muted)]'
        }`}
      >
        {phaseLabel(phase)}
      </span>
    </p>
  )
}

/** The window, inside the hero. One tile per day because the count is a fact
 *  about this league and not a layout that happened to fit. */
function DayStrip({ phase }: { phase: Phase }) {
  return (
    <ol className="grid grid-cols-6 gap-1.5 sm:grid-cols-12 sm:gap-2">
      {DAYS.map((d, i) => {
        const today = phase.name === 'running' && phase.day === i + 1
        const done =
          phase.name === 'after' || (phase.name === 'running' && i + 1 < phase.day)
        return (
          <motion.li
            key={d.toISOString()}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE, delay: 0.25 + i * 0.03 }}
            aria-current={today ? 'date' : undefined}
            className={`rounded-xl border py-3 text-center backdrop-blur-sm ${
              today
                ? 'border-[rgba(62,230,138,0.55)] bg-[linear-gradient(180deg,rgba(62,230,138,0.22),rgba(62,230,138,0.06))]'
                : 'border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.015))]'
            } ${done && !today ? 'opacity-40' : ''}`}
          >
            <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
              {weekday(d)}
            </span>
            <span
              className={`tabular mt-0.5 block font-[family-name:var(--font-display)] text-[clamp(1.3rem,2vw,1.75rem)] font-bold leading-none ${
                today ? 'text-[var(--admin-primary)]' : 'text-white'
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

/**
 * Band 1. The announcement, the week, and one way on.
 *
 * Sized to a little under the viewport rather than exactly it: a hero that
 * ends on the fold looks like the whole page, and this one has more below.
 */
function Hero({
  phase,
  joined,
  onJump,
}: {
  phase: Phase
  joined: boolean
  onJump: () => void
}) {
  return (
    <section className="relative isolate flex min-h-[34rem] flex-col justify-center gap-10 overflow-hidden px-6 py-14 md:min-h-[min(82vh,54rem)] xl:px-16">
      {/* Every image on this screen is optional and hides itself if absent,
          so the page is complete before a single one is generated. Paths are
          the League set in design/prompts.md -- nothing here points at an
          asset the marketing page or the login screen already used. */}
      <img
        src="/img/league-arena.webp"
        alt=""
        aria-hidden
        loading="eager"
        className="pointer-events-none absolute inset-0 -z-20 size-full object-cover object-right opacity-70 [mask-image:linear-gradient(180deg,#000_58%,transparent)]"
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />
      {/* Two gradients doing two jobs. The first keeps the left third
          readable whatever the art does on the right, where the depth is
          meant to build. The second pulls the bottom edge down into the band
          below, so the two meet in a wash instead of on a line. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(100deg,rgba(8,17,14,0.97)_0%,rgba(8,17,14,0.86)_38%,rgba(8,17,14,0.3)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-1/3 -z-10 size-[40rem] rounded-full bg-[radial-gradient(circle,rgba(62,230,138,0.22),transparent_68%)] blur-[90px]"
      />
      {/* Last of the hero's layers, so it washes out the glow and the art
          together. Anything painted after this one would be cut off square
          by overflow-hidden and draw the line these bands are avoiding. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-64 bg-[linear-gradient(180deg,transparent,#0A100E)]"
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: EASE }}
        className="max-w-4xl"
      >
        <p className="inline-flex items-center rounded-full border border-[rgba(62,230,138,0.35)] bg-[linear-gradient(180deg,rgba(62,230,138,0.18),rgba(62,230,138,0.04))] px-4 py-1.5 text-[13px] font-bold uppercase tracking-[0.16em] text-[var(--admin-primary)]">
          {longDate(LEAGUE_START)} to {longDate(LEAGUE_END)} 2026
        </p>

        <h1 className="mt-5 font-[family-name:var(--font-display)] text-[clamp(2.5rem,5.8vw,4.9rem)] font-bold leading-[0.95] tracking-[-0.035em] text-white">
          Seven days on{' '}
          <span className="text-[var(--admin-primary)]">the leaderboard</span>
        </h1>

        <p className="mt-5 max-w-2xl text-[clamp(1rem,1.25vw,1.15rem)] leading-relaxed text-[#E4EAE7]">
          Join the upcoming league from 7th to 18th Sept and get a chance to
          win $1,000 USD.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button type="button" onClick={onJump} className={btnPrimary}>
            <Trophy className="size-4" />
            {joined ? 'See your entry' : 'Join the league'}
          </button>
          <PhaseLine phase={phase} />
        </div>
      </motion.div>

      {/* The week lives here rather than in a band of its own: it is the
          dates, and the dates are the announcement. */}
      <div className="max-w-3xl">
        <p className={`${fieldLabel} mb-2.5`}>{LEAGUE_DAYS} days</p>
        <DayStrip phase={phase} />
      </div>
    </section>
  )
}

/**
 * Band 2. How it works, beside what it pays.
 *
 * Side by side rather than stacked because they answer one question between
 * them -- what do I do, and what do I get -- and stacking them made the page
 * a screen longer for no extra argument.
 */
function StepsAndPrizes() {
  return (
    <section className="relative isolate overflow-hidden bg-[linear-gradient(180deg,#0A100E_0%,#0D1512_55%,#0A100E_100%)] px-6 py-16 sm:py-20 xl:px-16">
      <img
        src="/img/league-lanes.webp"
        alt=""
        aria-hidden
        loading="lazy"
        className="pointer-events-none absolute inset-0 -z-20 size-full object-cover opacity-[0.1] [mask-image:linear-gradient(180deg,transparent,#000_26%,#000_74%,transparent)]"
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 -z-10 size-[34rem] translate-x-1/3 -translate-y-1/4 rounded-full bg-[radial-gradient(circle,rgba(62,230,138,0.16),transparent_70%)] blur-[110px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 bg-[linear-gradient(180deg,#0A100E,transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 bg-[linear-gradient(180deg,transparent,#0A100E)]"
      />

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <div>
          <BandHead eyebrow="How it works" title="Three steps to enter" />

          <ol className="mt-8 space-y-px overflow-hidden rounded-2xl border border-white/8">
            {STEPS.map((s, i) => {
              const Icon = s.icon
              return (
                <motion.li
                  key={s.title}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={viewportOnce}
                  transition={{ duration: 0.4, ease: EASE, delay: i * 0.07 }}
                  className="flex gap-4 bg-[linear-gradient(90deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))] px-5 py-5"
                >
                  <span className="tabular mt-0.5 font-[family-name:var(--font-display)] text-[15px] font-bold text-[var(--admin-primary)]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-2.5 text-[18px] font-bold text-white">
                      <Icon
                        className="size-[18px] shrink-0 text-[var(--admin-primary)]"
                        aria-hidden
                      />
                      {s.title}
                    </h3>
                    <p className={`${TEXT.label} mt-1.5 leading-relaxed text-[var(--admin-muted)]`}>
                      {s.body}
                    </p>
                  </div>
                </motion.li>
              )
            })}
          </ol>
        </div>

        <div className="relative">
          <BandHead
            eyebrow="Prize pool"
            title={
              <span className="tabular text-[clamp(2.4rem,5vw,3.6rem)]">
                {money(PRIZE_POOL)}
              </span>
            }
          />
          <p className={`${TEXT.label} mt-2 text-[var(--admin-muted)]`}>
            Paid across {PRIZE_PLACES} places. Nothing to pay in, at any point.
          </p>

          <motion.dl
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewportOnce}
            transition={{ duration: 0.4, ease: EASE, delay: 0.08 }}
            className="mt-6 space-y-px overflow-hidden rounded-2xl border border-white/8"
          >
            {PRIZES.map((p, i) => (
              <div
                key={p.place}
                className={`flex items-baseline justify-between gap-4 px-5 py-4 ${
                  i === 0
                    ? 'bg-[linear-gradient(90deg,rgba(62,230,138,0.2),rgba(62,230,138,0.05))]'
                    : 'bg-[linear-gradient(90deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))]'
                }`}
              >
                <dt
                  className={`text-[16px] font-semibold ${
                    i === 0 ? 'text-[var(--admin-primary)]' : 'text-[#E4EAE7]'
                  }`}
                >
                  {p.place}
                </dt>
                <dd
                  className={`tabular text-[21px] font-bold ${
                    i === 0 ? 'text-[var(--admin-primary)]' : 'text-white'
                  }`}
                >
                  {money(p.amount)}
                  {p.places > 1 && (
                    <span className={`${TEXT.label} ml-2 font-medium text-[var(--admin-muted)]`}>
                      each
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </motion.dl>

          {/* One plinth, not three. The marketing page already sells the
              podium; this band sells first place. */}
          <img
            src="/img/league-plinth.webp"
            alt=""
            aria-hidden
            loading="lazy"
            className="pointer-events-none mx-auto -mb-6 mt-2 block w-full max-w-[20rem] select-none opacity-80 mix-blend-screen [mask-image:radial-gradient(62%_52%_at_50%_62%,#000_30%,transparent_76%)]"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        </div>
      </div>
    </section>
  )
}

/**
 * Shown once, on the join that succeeds, and gone on its own.
 *
 * No close button and no backdrop: it reports something that already
 * happened, so there is nothing to decide and nothing to dismiss. That also
 * means it must never trap focus or cover the entry it is congratulating --
 * it sits top-centre, above everything, and lets clicks through.
 *
 * `role="status"` rather than an alert: a win is not an emergency, so a
 * screen reader announces it when it finishes what it is saying.
 */
const CONGRATS_MS = 4200

function Congrats({ show, onDone }: { show: boolean; onDone: () => void }) {
  useEffect(() => {
    if (!show) return
    const t = setTimeout(onDone, CONGRATS_MS)
    return () => clearTimeout(t)
  }, [show, onDone])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.98 }}
          transition={{ duration: 0.42, ease: EASE }}
          className="pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center px-4"
        >
          <div className="relative flex items-center gap-4 overflow-hidden rounded-2xl border border-[rgba(62,230,138,0.45)] bg-[linear-gradient(135deg,rgba(23,48,37,0.98),rgba(13,21,18,0.98))] px-6 py-4 shadow-[0_28px_70px_-20px_rgba(0,0,0,0.95)] backdrop-blur-md">
            {/* Sweeps across once as it lands. One gesture, not a loop: a
                banner that keeps moving after it has been read is noise. */}
            <motion.span
              aria-hidden
              initial={{ x: '-120%' }}
              animate={{ x: '120%' }}
              transition={{ duration: 1.1, ease: EASE, delay: 0.15 }}
              className="pointer-events-none absolute inset-y-0 w-1/3 bg-[linear-gradient(90deg,transparent,rgba(62,230,138,0.16),transparent)]"
            />
            <motion.span
              aria-hidden
              initial={{ scale: 0.5, rotate: -12 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.08 }}
              className="relative grid size-11 shrink-0 place-items-center rounded-xl border border-[rgba(62,230,138,0.45)] bg-[rgba(62,230,138,0.16)] text-[var(--admin-primary)]"
            >
              <Trophy className="size-5" />
            </motion.span>
            <div className="relative min-w-0">
              <p className="font-[family-name:var(--font-display)] text-[20px] font-bold leading-tight text-white">
                Congratulations
              </p>
              <p className={`${TEXT.label} mt-0.5 text-[#E4EAE7]`}>
                You are in the league. Good luck.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Band 3. The whole point of the page. */
function JoinBand({
  entry,
  onJoined,
  onCelebrate,
}: {
  entry: LeagueEntry | null | undefined
  onJoined: (e: LeagueEntry) => void
  /** Fired only on the join that succeeds, never on a reload that finds one. */
  onCelebrate: () => void
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
      onCelebrate()
    } catch (err) {
      if (err instanceof Unauthorized) window.location.href = '/login'
      else setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      id={JOIN_ID}
      className="relative isolate scroll-mt-4 overflow-hidden bg-[linear-gradient(180deg,#0A100E_0%,rgba(31,92,65,0.42)_58%,rgba(62,230,138,0.16)_100%)] px-6 py-16 sm:py-20 xl:px-16"
    >
      <img
        src="/img/league-gate.webp"
        alt=""
        aria-hidden
        loading="lazy"
        className="pointer-events-none absolute inset-0 -z-20 size-full object-cover opacity-55 [mask-image:linear-gradient(180deg,transparent,#000_34%)]"
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />
      {/* Keeps the centre dark enough to read a form over, whatever the gate
          art does at the two ends. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_70%_at_50%_45%,rgba(8,17,14,0.92),rgba(8,17,14,0.55))]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 bg-[linear-gradient(180deg,#0A100E,transparent)]"
      />

      <div className="mx-auto max-w-2xl text-center">
        {entry === undefined ? (
          <div className="mx-auto h-40 w-full animate-pulse rounded-2xl border border-white/8 bg-white/[0.02]" />
        ) : entry ? (
          <>
            <span
              aria-hidden
              className="mx-auto grid size-14 place-items-center rounded-2xl border border-[rgba(62,230,138,0.4)] bg-[linear-gradient(180deg,rgba(62,230,138,0.24),rgba(62,230,138,0.06))] text-[var(--admin-primary)]"
            >
              <Trophy className="size-6" />
            </span>
            <h2 className="mt-5 font-[family-name:var(--font-display)] text-[clamp(1.8rem,3.2vw,2.7rem)] font-bold leading-[1.05] text-white">
              You are in the league
            </h2>
            <p className={`${TEXT.body} mt-3 text-[#E4EAE7]`}>
              Joined {joinedOn(entry.created_at)}. Nothing else to do until{' '}
              {longDate(LEAGUE_START)}.
            </p>

            <dl className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-white/12 text-left sm:grid-cols-2">
              <div className="bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] px-6 py-5">
                <dt className={`${TEXT.label} text-[var(--admin-muted)]`}>MetaTrader5 Account</dt>
                <dd className="tabular mt-1 break-words text-[24px] font-bold text-white">
                  {entry.metaid}
                </dd>
              </div>
              <div className="bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] px-6 py-5">
                <dt className={`${TEXT.label} text-[var(--admin-muted)]`}>Email</dt>
                <dd className={`${TEXT.body} mt-1 break-words text-[#E4EAE7]`}>
                  {entry.email}
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <>
            <h2 className="font-[family-name:var(--font-display)] text-[clamp(1.8rem,3.2vw,2.7rem)] font-bold leading-[1.05] tracking-[-0.02em] text-white">
              Enter with your MetaTrader5 Account
            </h2>
            <p className={`${TEXT.body} mx-auto mt-3 max-w-lg text-[#E4EAE7]`}>
              The one newera approved for you. Find it on the Request an
              Account screen if you are not sure.
            </p>

            <form onSubmit={submit} className="mx-auto mt-8 max-w-lg text-left">
              <label className={`${fieldLabel} mb-2 block`} htmlFor="league-metaid">
                MetaTrader5 Account
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                {/* The rule is stated to the browser rather than checked in an
                    effect: pattern blocks the submit, inputMode brings up a
                    number pad on a phone, and title is what the browser reads
                    out when it refuses. The server checks it again -- this is a
                    convenience, not the guard. */}
                <input
                  id="league-metaid"
                  name="metaid"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{4,6}"
                  maxLength={6}
                  title="An account number is 4 to 6 digits"
                  aria-describedby="league-metaid-hint"
                  autoComplete="off"
                  spellCheck={false}
                  value={metaid}
                  onChange={(e) => setMetaid(e.target.value)}
                  placeholder="e.g. 43563"
                  className={`${control} tabular w-full text-[20px] sm:flex-1`}
                />
                <button
                  type="submit"
                  disabled={busy || !METAID_RE.test(metaid.trim())}
                  className={`${btnPrimary} shrink-0`}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trophy className="size-4" />
                  )}
                  Join the league
                </button>
              </div>
              <p
                id="league-metaid-hint"
                className={`${TEXT.label} mt-2.5 text-[var(--admin-muted)]`}
              >
                4 to 6 digits, no letters.
              </p>

              {error && (
                <div className="mt-4">
                  <ErrorAlert>{error}</ErrorAlert>
                </div>
              )}
            </form>
          </>
        )}
      </div>
    </section>
  )
}

export function LeagueScreen() {
  const [entry, setEntry] = useState<LeagueEntry | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  // Read once, at mount. The window does not move while the screen is open.
  const [phase] = useState(() => leaguePhase(new Date()))
  const [celebrating, setCelebrating] = useState(false)

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

  /** Smooth unless the reader has asked for less motion, in which case it
   *  still goes there, just without the travel. */
  const jump = () =>
    document.getElementById(JOIN_ID)?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start',
    })

  return (
    <div className="-m-5 bg-[#0A100E] sm:-m-6 xl:-m-8">
      <Hero phase={phase} joined={Boolean(entry)} onJump={jump} />
      <StepsAndPrizes />

      {error && (
        <div className="px-6 pt-8 xl:px-16">
          <ErrorAlert>{error}</ErrorAlert>
        </div>
      )}

      <JoinBand
        entry={entry}
        onJoined={setEntry}
        onCelebrate={() => setCelebrating(true)}
      />
      <Congrats show={celebrating} onDone={() => setCelebrating(false)} />
    </div>
  )
}

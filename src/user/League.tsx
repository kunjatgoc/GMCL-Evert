import { useEffect, useId, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Loader2 } from 'lucide-react'
import CalendarEvent from '~icons/tabler/calendar-event'
import ChartCandle from '~icons/tabler/chart-candle'
import Moneybag from '~icons/tabler/moneybag'
import Check from '~icons/tabler/check'
import Pencil from '~icons/tabler/pencil'
import Plus from '~icons/tabler/plus'
import Trophy from '~icons/tabler/trophy-filled'
import {
  editLeagueEntry,
  getLeagueStatus,
  joinLeague,
  type LeagueEntry,
} from './api'
import { SupportBand } from '../components/ui/Support'
import { Unauthorized } from '../lib/api'
import { formatIst, istDate, istDaysBetween } from '../lib/time'
import { EASE, viewportOnce } from '../lib/motion'
import { prefersReducedMotion } from '../lib/motionPreference'
import {
  TEXT,
  btnGhost,
  btnPrimary,
  btnSecondary,
  control,
  fieldLabel,
} from '../panel/type'
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

/** Four to ten digits, e.g. 43563. Mirrors METAID_RE in api/index.py and the
 *  check constraint on league_entry; this copy only greys out the button. */
export const METAID_RE = /^[0-9]{4,10}$/

/**
 * The window, on the IST calendar.
 *
 * IST because that is what the league runs on and what the database counts in
 * -- see src/lib/time.ts. Written as dates rather than as `new Date(2026, 8, 7)`,
 * which was 7 September only for a reader already in India: a reader in New
 * York at 22:00 on the 6th is in the 7th in Delhi, and used to be told the
 * league had not started.
 */
export const LEAGUE_START = istDate('2026-09-07')
export const LEAGUE_END = istDate('2026-09-18')
export const LEAGUE_DAYS = istDaysBetween(LEAGUE_START, LEAGUE_END) + 1

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
  const until = istDaysBetween(now, LEAGUE_START)
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

const longDate = (d: Date) => formatIst(d, { day: 'numeric', month: 'long' })

const joinedOn = (iso: string) =>
  formatIst(iso, { day: 'numeric', month: 'short', year: 'numeric' })

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
 * fill in. So the window stays a line of text in the hero rather than a
 * calendar, and the steps sit beside the prizes rather than above them.
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
      <h2 className="mt-2.5 font-[family-name:var(--font-display)] text-[clamp(1.2rem,2vw,1.47rem)] font-bold leading-[1.05] tracking-[-0.02em] text-white">
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
    <section className="relative isolate flex min-h-[26rem] flex-col justify-center overflow-hidden px-6 py-12 md:min-h-[min(56vh,32rem)] xl:px-16">
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

        {/* The invitation is the headline now. It used to be a slogan with the
            actual offer in small type underneath, which put the one fact
            somebody is here for -- the dates and the prize -- in the line most
            likely to be skipped. leading is looser than the slogan's 0.95: a
            sentence three lines long needs room between them in a way two
            words never did. */}
        <h1 className="mt-5 font-[family-name:var(--font-display)] text-[clamp(1.75rem,3.6vw,2.67rem)] font-bold leading-[1.08] tracking-[-0.03em] text-white">
          Join the upcoming league from 7th to 18th Sept and get a chance to
          win <span className="text-[var(--admin-primary)]">$1,000 USD</span>.
        </h1>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button type="button" onClick={onJump} className={btnPrimary}>
            <Trophy className="size-4" />
            {joined ? 'See your entry' : 'Join the league'}
          </button>
          <PhaseLine phase={phase} />
        </div>
      </motion.div>
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
    <section className="relative isolate overflow-hidden bg-[linear-gradient(180deg,#0A100E_0%,#0D1512_55%,#0A100E_100%)] px-6 py-12 sm:py-14 xl:px-16">
      {/* A lanes plate used to sit here at opacity 0.1 under a mask that faded
          both ends of it. Between the two it was not visible on any screen it
          was looked at on, which made it 244KB fetched to change nothing. The
          washes below are what the band was actually reading as. */}
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
                  <span className="tabular mt-0.5 font-[family-name:var(--font-display)] text-[14px] font-bold text-[var(--admin-primary)]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-2.5 text-[14.5px] font-bold text-white">
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
              <span className="tabular text-[clamp(1.66rem,3.2vw,2.21rem)]">
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
                  className={`text-[13px] font-semibold ${
                    i === 0 ? 'text-[var(--admin-primary)]' : 'text-[#E4EAE7]'
                  }`}
                >
                  {p.place}
                </dt>
                <dd
                  className={`tabular text-[16.5px] font-bold ${
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

          {/* A plinth used to stand under the prize table. Both columns stretch
              to the taller of them, so 300px of podium in this one pushed the
              steps column out by the same amount and held the band open above
              the section below it. The prize table is the argument here; the
              picture of a podium was decoration charged at a third of a
              screen. */}
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
              <p className="font-[family-name:var(--font-display)] text-[15.5px] font-bold leading-tight text-white">
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

/**
 * What the two buttons wear beside an inline field: the field's own height, and
 * less of it sideways.
 *
 * `!` because btnPrimary and btnGhost carry their own padding and type size,
 * and two utilities setting the same property do not resolve by the order they
 * are written in the class attribute.
 *
 * Applied only in the compact shape; the standalone forms keep the full-size
 * buttons, which is what a page-level action should look like.
 */
const COMPACT_BTN = 'h-11 !px-3.5 !text-[14px]'

/**
 * The numbers this person has already entered, which a new one may not repeat.
 *
 * `exceptId` is the row being corrected. Without it an edit that leaves the
 * number alone would count as a duplicate of itself and the Save button would
 * never enable -- so the exclusion is the whole reason this is a function
 * rather than a `.map` at each call site, and it is what the test pins.
 *
 * One person, their own entries. Two different people holding the same number
 * is a separate question, deliberately left open -- see
 * docs/database-open-items.md.
 */
export const takenMetaids = (
  entries: readonly LeagueEntry[],
  exceptId?: number
): string[] =>
  entries.filter((e) => e.id !== exceptId).map((e) => e.metaid)

/**
 * What the field says the moment the number matches one already entered.
 *
 * Two lengths for one message, because the two places it appears are not the
 * same size. The form has a line to itself and says the whole thing; the
 * compact row has the width left over beside two buttons, and a sentence that
 * wrapped there would be clipped by the fixed-height line it sits on. The red
 * border carries the rest of the meaning in that case.
 *
 * Worded as a prompt rather than a refusal: the likely cause is somebody
 * adding a second account and pasting the first one by mistake.
 */
const DUPLICATE_MESSAGE = 'You have already entered this account. Check the number.'
const DUPLICATE_SHORT = 'Already entered.'

/**
 * The account number field, and the one button that acts on it.
 *
 * Written once because it appears twice -- adding an entry and correcting one
 * -- and the rule it states to the browser is the part that must not differ
 * between them.
 */
function MetaidForm({
  initial = '',
  submitLabel,
  busy,
  compact = false,
  focus = false,
  taken = [],
  onSubmit,
  onCancel,
}: {
  initial?: string
  submitLabel: string
  busy: boolean
  /** Only where the form appeared because the reader asked for it -- Edit on a
   *  row, or Add under the list. The browser scrolls an autofocused field into
   *  view, so a form that arrives with the screen would open it halfway down
   *  itself, past the heading that says what it is. */
  focus?: boolean
  /** Inside a row of the list, where the label and the hint are dropped so the
   *  row is the same height whether it is being read or corrected. A card that
   *  grows under the cursor moves everything below it. */
  compact?: boolean
  /** The numbers already entered, so a repeat is answered as it is typed
   *  rather than after a round trip. Build it with `takenMetaids`. */
  taken?: readonly string[]
  onSubmit: (metaid: string) => void
  /** Present on a correction, absent on the first entry: there is nothing to
   *  go back to when the list is empty. */
  onCancel?: () => void
}) {
  const [metaid, setMetaid] = useState(initial)
  const id = useId()

  const trimmed = metaid.trim()
  // As it is typed, not on submit. The server still refuses a duplicate with
  // a 409 -- the unique index on (user_id, metaid) is the guard, and two taps
  // on a slow button race past anything a screen can check. This is so the
  // answer arrives while the number is still on screen and under the cursor.
  const duplicate = taken.includes(trimmed)
  const valid = METAID_RE.test(trimmed)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(metaid.trim())
      }}
      className={compact ? 'w-full text-left' : 'text-left'}
    >
      {!compact && (
        <label className={`${fieldLabel} mb-2 block`} htmlFor={id}>
          MetaTrader5 Account
        </label>
      )}
      <div className={compact ? 'flex gap-2' : 'flex flex-col gap-3 sm:flex-row'}>
        {/* The rule is stated to the browser rather than checked in an effect:
            pattern blocks the submit, inputMode brings up a number pad on a
            phone, and title is what the browser reads out when it refuses. The
            server checks it again -- this is a convenience, not the guard. */}
        <input
          id={id}
          name="metaid"
          required
          autoFocus={focus}
          inputMode="numeric"
          pattern="[0-9]{4,10}"
          maxLength={10}
          title="An account number is 4 to 10 digits"
          aria-label={compact ? 'MetaTrader5 Account' : undefined}
          aria-describedby={`${id}-hint`}
          aria-invalid={duplicate || undefined}
          autoComplete="off"
          spellCheck={false}
          value={metaid}
          onChange={(e) => setMetaid(e.target.value)}
          placeholder="e.g. 43563"
          className={`${control} tabular w-full min-w-0 flex-1 ${
            compact ? 'h-10 max-sm:text-[16px] text-[14.5px]' : 'max-sm:text-[16px] text-[15.5px]'
          } ${duplicate ? '!border-[rgba(248,113,113,0.55)]' : ''}`}
        />
        <button
          type="submit"
          disabled={busy || !valid || duplicate}
          className={`${btnPrimary} shrink-0 ${compact ? COMPACT_BTN : ''}`}
        >
          {/* A trophy is for entering; a correction is not an entry. */}
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : compact ? (
            <Check className="size-4" />
          ) : (
            <Trophy className="size-4" />
          )}
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className={`${btnGhost} shrink-0 ${compact ? COMPACT_BTN : ''}`}
          >
            Cancel
          </button>
        )}
      </div>
      {/* One line, two jobs. Standing on its own it states the rule; the
          moment the number repeats one already entered it says so instead, in
          the same place, so nothing below it moves.

          Compact keeps the line rather than dropping it, at a fixed height and
          empty when there is nothing to say. A row that grew a message while
          being corrected would push every row under it down -- which is the
          shift the min-height on the row exists to prevent. */}
      <p
        id={`${id}-hint`}
        aria-live="polite"
        className={`${TEXT.label} ${
          compact ? 'mt-1 h-4 truncate leading-4' : 'mt-2.5'
        } ${duplicate ? 'text-[#F87171]' : 'text-[var(--admin-muted)]'}`}
      >
        {duplicate
          ? compact
            ? DUPLICATE_SHORT
            : DUPLICATE_MESSAGE
          : compact
            ? ''
            : '4 to 10 digits, no letters.'}
      </p>
    </form>
  )
}

/**
 * One row of the list -- holding an account, being corrected, or taking a new
 * one. Written once and shared, because the three are the same card and the
 * list stops reading as a list the moment they drift apart.
 *
 * The height is the tallest mode, which is the row being corrected: the
 * compact form carries a line for the duplicate message, reserved whether or
 * not it has anything to say. Measured at 64px of form plus the 32px of
 * padding here, so 6rem holds it exactly and a row being read is not left with
 * a band of empty space under it. One height across both modes is the property
 * being kept; it was 6.5rem when the type was two steps larger.
 */
const ENTRY_ROW =
  'flex min-h-[6rem] items-center bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] px-4 py-4 sm:px-6'

/**
 * One entry, and the correction of it.
 *
 * Reading and editing in the same place rather than a dialog: there is one
 * field, and a dialog for one field is a second screen to dismiss. Editing
 * only -- an entry is never removed, so what was recorded stays recorded and
 * a mistyped number is corrected rather than erased and re-made.
 */
function EntryRow({
  entry,
  entries,
  editing,
  busy,
  onEdit,
  onCancel,
  onSave,
}: {
  entry: LeagueEntry
  /** The whole list, so a correction can be checked against the other rows.
   *  This row is excluded, or leaving the number alone would read as a
   *  duplicate of itself and Save would never enable. */
  entries: readonly LeagueEntry[]
  editing: boolean
  busy: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: (metaid: string) => void
}) {
  return (
    <li className={ENTRY_ROW}>
      {editing ? (
        <MetaidForm
          initial={entry.metaid}
          submitLabel="Save"
          busy={busy}
          compact
          focus
          taken={takenMetaids(entries, entry.id)}
          onSubmit={onSave}
          onCancel={onCancel}
        />
      ) : (
        <div className="flex w-full items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="tabular text-[18.5px] font-bold leading-none text-white">
              {entry.metaid}
            </p>
            <p className={`${TEXT.label} mt-2 truncate text-[var(--admin-muted)]`}>
              {entry.email} &middot; joined {joinedOn(entry.created_at)}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onEdit}
            className={`${btnGhost} shrink-0`}
          >
            <Pencil className="size-4" />
            Edit
          </button>
        </div>
      )}
    </li>
  )
}

/** Band 3. The whole point of the page. */
function JoinBand({
  entries,
  onChanged,
  onCelebrate,
}: {
  /** Undefined until the server answers. */
  entries: LeagueEntry[] | undefined
  onChanged: (entries: LeagueEntry[]) => void
  /** Fired only on the entry that succeeds, never on a reload that finds one. */
  onCelebrate: () => void
}) {
  /** Which row is being corrected, if any. One at a time: two open fields on
   *  the same list is two answers to the same question. */
  const [editingId, setEditingId] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Both writes end the same way, so they share the ending.
   *
   * The list is read back rather than patched in place: the address on a row
   * is chosen by the database, and the screen would otherwise be guessing at
   * it. `done` runs only on the write that succeeded.
   */
  const run = async (write: () => Promise<unknown>, done: () => void) => {
    setBusy(true)
    setError(null)
    try {
      await write()
      const { entries: saved } = await getLeagueStatus()
      onChanged(saved)
      done()
    } catch (err) {
      if (err instanceof Unauthorized) window.location.href = '/login'
      else setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const add = (metaid: string) =>
    run(() => joinLeague(metaid), () => {
      setAdding(false)
      onCelebrate()
    })

  const save = (id: number, metaid: string) =>
    run(() => editLeagueEntry(id, metaid), () => setEditingId(null))

  return (
    <section
      id={JOIN_ID}
      className="relative isolate scroll-mt-4 overflow-hidden bg-[linear-gradient(180deg,#0A100E_0%,rgba(31,92,65,0.42)_58%,rgba(62,230,138,0.16)_100%)] px-6 py-12 sm:py-14 xl:px-16"
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
        {/* The form is always here. Getting an account and entering the league
            were written as step one and step two, and they are not: they run
            alongside each other, and somebody who already holds a number has
            no reason to be shown a locked band telling them to go and ask for
            one. Whether newera has approved anything is no longer this page's
            question. */}
        {entries === undefined ? (
          <div className="mx-auto h-40 w-full animate-pulse rounded-2xl border border-white/8 bg-white/[0.02]" />
        ) : entries.length === 0 ? (
          <>
            <h2 className="font-[family-name:var(--font-display)] text-[clamp(1.24rem,2.1vw,1.61rem)] font-bold leading-[1.05] tracking-[-0.02em] text-white">
              Enter with your MetaTrader5 Account
            </h2>
            <p className={`${TEXT.body} mx-auto mt-3 max-w-lg text-[#E4EAE7]`}>
              The one newera approved for you. Find it on the MetaTrader
              Accounts screen if you are not sure. You can enter more than one.
            </p>
            <div className="mx-auto mt-8 max-w-lg">
              <MetaidForm submitLabel="Join the league" busy={busy} onSubmit={add} />
            </div>
          </>
        ) : (
          <>
            <span
              aria-hidden
              className="mx-auto grid size-14 place-items-center rounded-2xl border border-[rgba(62,230,138,0.4)] bg-[linear-gradient(180deg,rgba(62,230,138,0.24),rgba(62,230,138,0.06))] text-[var(--admin-primary)]"
            >
              <Trophy className="size-6" />
            </span>
            <h2 className="mt-5 font-[family-name:var(--font-display)] text-[clamp(1.24rem,2.1vw,1.61rem)] font-bold leading-[1.05] text-white">
              You are in the league
            </h2>
            <p className={`${TEXT.body} mt-3 text-[#E4EAE7]`}>
              {entries.length === 1
                ? 'One account entered'
                : `${entries.length} accounts entered`}
              . Nothing else to do until {longDate(LEAGUE_START)}.
            </p>
            {/* Said here rather than left to be discovered from the buttons.
                Two things are not obvious from a list: that a second account
                is allowed at all, and that a wrong number can be corrected
                instead of lived with. */}
            <p className={`${TEXT.label} mx-auto mt-2 max-w-lg text-[var(--admin-muted)]`}>
              You can enter more than one account. Add another below, or press
              Edit to correct a number.
            </p>

            <ul className="mt-8 space-y-px overflow-hidden rounded-2xl border border-white/12 text-left">
              {entries.map((e) => (
                <EntryRow
                  key={e.id}
                  entry={e}
                  entries={entries}
                  editing={editingId === e.id}
                  busy={busy}
                  onEdit={() => {
                    setError(null)
                    setAdding(false)
                    setEditingId(e.id)
                  }}
                  onCancel={() => setEditingId(null)}
                  onSave={(metaid) => save(e.id, metaid)}
                />
              ))}

              {/* The new account is typed into the list, not into a panel
                  underneath it. It is going to become one of these rows, and
                  a differently shaped box below the list only says that it is
                  something else. */}
              {adding && (
                <li className={ENTRY_ROW}>
                  <MetaidForm
                    submitLabel="Add"
                    busy={busy}
                    compact
                    focus
                    taken={takenMetaids(entries)}
                    onSubmit={add}
                    onCancel={() => setAdding(false)}
                  />
                </li>
              )}
            </ul>

            {!adding && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setError(null)
                  setEditingId(null)
                  setAdding(true)
                }}
                className={`${btnSecondary} mt-5`}
              >
                <Plus className="size-4" />
                Add another account
              </button>
            )}
          </>
        )}

        {error && (
          <div className="mt-5 text-left">
            <ErrorAlert>{error}</ErrorAlert>
          </div>
        )}
      </div>
    </section>
  )
}

export function LeagueScreen() {
  const [entries, setEntries] = useState<LeagueEntry[] | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  // Read once, at mount. The window does not move while the screen is open.
  const [phase] = useState(() => leaguePhase(new Date()))
  const [celebrating, setCelebrating] = useState(false)

  useEffect(() => {
    getLeagueStatus()
      .then(({ entries }) => setEntries(entries))
      .catch((e) => {
        if (e instanceof Unauthorized) window.location.href = '/login'
        else {
          setEntries([])
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
      <Hero phase={phase} joined={Boolean(entries?.length)} onJump={jump} />
      <StepsAndPrizes />

      {error && (
        <div className="px-6 pt-8 xl:px-16">
          <ErrorAlert>{error}</ErrorAlert>
        </div>
      )}

      <JoinBand
        entries={entries}
        onChanged={setEntries}
        onCelebrate={() => setCelebrating(true)}
      />

      {/* After the entry form and not before it. Anyone who could enter has
          entered by here; anyone who could not is the reason this exists. */}
      <footer className="border-t border-white/5 px-6 py-10 xl:px-16">
        <SupportBand />
      </footer>

      <Congrats show={celebrating} onDone={() => setCelebrating(false)} />
    </div>
  )
}

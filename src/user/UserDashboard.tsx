import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { motion } from 'motion/react'
import {
  Check,
  CheckCircle2,
  Clock,
  LayoutDashboard,
  Loader2,
  Send,
  Trophy,
  UserRound,
  Wallet,
  X,
  XCircle,
} from 'lucide-react'
import ChartCandle from '~icons/tabler/chart-candle'
import { IconArt, type IconComponent } from '../components/ui/IconArt'
import { changePassword, updateName, Unauthorized, type Me } from '../lib/api'
import {
  checkMetaidEmail,
  listMetaid,
  requestMetaid,
  type MetaidRequest,
  type MetaidType,
} from './api'
import { LeagueScreen } from './League'
import { getLeagueEntry, type LeagueEntry } from './api'
import { PanelShell, type PanelRoute } from '../panel/PanelShell'
import {
  TEXT,
  btnGhost,
  btnIcon,
  btnPrimary,
  btnSecondary,
  control,
  fieldLabel,
  modalCard,
  modalShell,
} from '../panel/type'
import { ErrorAlert, Notice } from '../components/auth/FormAlert'
import { EASE } from '../lib/motion'

/** The MetaTrader mark, for the rail. IconArt already draws an image and
 *  falls back to a glyph when the file is missing, so this is a src and a
 *  name; `Send` is what shows if the asset ever goes astray. */
const Mt5Mark = ({ className }: { className?: string }) => (
  <IconArt src="/img/mt5-icon.webp" fallback={Send} className={className} />
)

/** What an entrant can reach, drawn by the same rail the admin panel uses --
 *  the list is what differs between roles, never the shell.
 *
 *  The main list is the work, in the order it is done: get an account, then
 *  enter the league with it. The footer is the account itself, which is why
 *  My Profile sits down there beside the address and the sign-out control. */
const ROUTES: readonly PanelRoute[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, view: DashboardScreen },
  {
    path: '/request-metaid',
    label: 'MetaTrader Account',
    icon: Mt5Mark,
    view: RequestScreen,
  },
  { path: '/league', label: 'League', icon: Trophy, view: LeagueScreen },
  {
    path: '/profile',
    label: 'My Profile',
    icon: UserRound,
    view: ProfileScreen,
    atBottom: true,
  },
]

export default function UserDashboard() {
  return <PanelShell views={{ end_user: { subtitle: 'Your account', routes: ROUTES } }} />
}

type Kind = { type: MetaidType; title: string; blurb: string; icon: IconComponent }

const KINDS: readonly Kind[] = [
  {
    type: 'demo',
    title: 'Demo MetaTrader5 Account',
    blurb:
      'Trade in the league with $10,000 of demo money. No deposit. No risk to your own money.',
    icon: ChartCandle,
  },
  {
    type: 'real',
    title: 'Real MetaTrader5 Account',
    blurb:
      'A real trading account with newera Broker, opened once they have checked your details.',
    icon: Wallet,
  },
]

const STATUS = {
  pending: { icon: Clock, tone: 'text-[var(--admin-gold)]', label: 'Pending' },
  approved: { icon: CheckCircle2, tone: 'text-[#3EE68A]', label: 'Approved' },
  rejected: { icon: XCircle, tone: 'text-[var(--admin-destructive)]', label: 'Rejected' },
} as const

/** What the screen says once a request is in. Asked for word for word. */
const AFTER_SUBMIT = 'Your verification will be done soon within 24hr to 48hr.'

const card = 'rounded-2xl border border-white/8 bg-[var(--admin-card)]'
const heading = `${TEXT.display} font-[family-name:var(--font-display)] font-bold leading-[1.05]`

function StatusChip({ status }: { status: MetaidRequest['status'] }) {
  const { icon: Icon, tone, label } = STATUS[status]
  return (
    <span
      className={`${TEXT.label} inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-medium ${tone}`}
    >
      <Icon className="size-3.5" />
      {label}
    </span>
  )
}

/** Each screen fetches what it needs. Two screens and one small list -- lifting
 *  it into the shell would only make the shell care about account requests. */
function useRequests() {
  const [rows, setRows] = useState<MetaidRequest[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () =>
    listMetaid()
      .then(setRows)
      .catch((e: unknown) => {
        if (e instanceof Unauthorized) window.location.href = '/login'
        else setError(e instanceof Error ? e.message : 'Something went wrong.')
      })

  useEffect(() => {
    load()
  }, [])

  return { rows, error, reload: load }
}

function Loading() {
  return (
    <p className={`${TEXT.body} mt-10 text-center text-[var(--admin-muted)]`} role="status">
      <Loader2 className="mx-auto size-6 animate-spin" />
    </p>
  )
}

/**
 * One numbered card per step, in the order they have to happen.
 *
 * Numbered because it genuinely is a sequence: the league asks for an account
 * number newera has not issued yet at step one. Each card carries its own
 * state rather than a separate status list below -- where a request stands is
 * the state of step one, not a second subject.
 */
function StepCard({
  step,
  title,
  body,
  done,
  children,
  delay,
}: {
  step: number
  title: string
  body: string
  done: boolean
  children: ReactNode
  delay: number
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay }}
      className={`${card} relative flex flex-col overflow-hidden p-7 xl:p-8 ${
        done ? 'border-[rgba(62,230,138,0.35)]' : ''
      }`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 size-48 rounded-full bg-[var(--admin-primary)] opacity-[0.09] blur-[70px]"
      />

      <div className="relative flex items-center gap-3">
        <span
          className={`tabular grid size-9 shrink-0 place-items-center rounded-xl border text-[15px] font-bold ${
            done
              ? 'border-[rgba(62,230,138,0.45)] bg-[rgba(62,230,138,0.14)] text-[#3EE68A]'
              : 'border-white/12 bg-white/[0.04] text-[#E4EAE7]'
          }`}
        >
          {done ? <Check className="size-4" /> : step}
        </span>
        <p className={`${TEXT.label} font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]`}>
          Step {step}
        </p>
      </div>

      <h2 className="relative mt-5 font-[family-name:var(--font-display)] text-[clamp(1.4rem,2.2vw,1.9rem)] font-bold leading-tight text-white">
        {title}
      </h2>
      <p className={`${TEXT.body} relative mt-3 leading-relaxed text-[#E4EAE7]`}>
        {body}
      </p>

      <div className="relative mt-auto pt-7">{children}</div>
    </motion.article>
  )
}

/** Who you are, and the two things to do. */
function DashboardScreen({ me }: { me: Me }) {
  const { rows, error } = useRequests()
  const firstName = me.full_name?.trim().split(/\s+/)[0]
  const [joined, setJoined] = useState<LeagueEntry | null | undefined>(undefined)

  useEffect(() => {
    // A failure here only costs the second card its tick, so it is swallowed
    // rather than shown: the dashboard is not where you would fix it.
    getLeagueEntry()
      .then(setJoined)
      .catch(() => setJoined(null))
  }, [])

  const approved = rows?.find((r) => r.status === 'approved')
  const pending = rows?.find((r) => r.status === 'pending')

  return (
    <div className="xl:max-w-5xl">
      <h1 className={heading}>
        {firstName ? (
          <>
            Hi, <span className="text-[#3EE68A]">{firstName}</span>
          </>
        ) : (
          <>
            Welcome <span className="text-[#3EE68A]">back</span>
          </>
        )}
      </h1>
      <p className={`${TEXT.body} mt-4 max-w-2xl text-[#E4EAE7]`}>
        Two steps, in this order.
      </p>

      {error && <div className="mt-6"><ErrorAlert>{error}</ErrorAlert></div>}

      <div className="mt-8 grid max-w-3xl gap-5">
        <StepCard
          step={1}
          delay={0.05}
          done={Boolean(approved)}
          title="Request the MetaTrader5 Account"
          body="Ask newera for a demo or a real account. They check the address and answer. You need the number they issue before you can enter."
        >
          {!rows ? (
            <Loading />
          ) : approved ? (
            <p className={`${TEXT.body} text-[#E4EAE7]`}>
              Approved. Your {approved.type} account is ready under{' '}
              {approved.email}.
            </p>
          ) : pending ? (
            <>
              <StatusChip status="pending" />
              <p className={`${TEXT.label} mt-3 text-[var(--admin-muted)]`}>
                {AFTER_SUBMIT}
              </p>
            </>
          ) : (
            <a href="/request-metaid" className={btnPrimary}>
              <Send className="size-4" />
              Request an account
            </a>
          )}
        </StepCard>

        <StepCard
          step={2}
          delay={0.13}
          done={Boolean(joined)}
          title="Join the League"
          body="Join the upcoming league from 7th Sept to 18th Sept for a chance to win $1,000 USD."
        >
          {joined === undefined ? (
            <Loading />
          ) : joined ? (
            <p className={`${TEXT.body} text-[#E4EAE7]`}>
              You are in, under account{' '}
              <span className="tabular font-semibold text-white">
                {joined.metaid}
              </span>
              .
            </p>
          ) : (
            <a href="/league" className={btnPrimary}>
              <Trophy className="size-4" />
              Join the league
            </a>
          )}
        </StepCard>
      </div>
    </div>
  )
}

/** The two options, and the modal that takes the address for either. */
function RequestScreen({ me }: { me: Me }) {
  const { rows, error, reload } = useRequests()
  const [open, setOpen] = useState<Kind | null>(null)

  const latestOf = (type: MetaidType) => rows?.find((r) => r.type === type)
  // A settled request leaves the way clear to ask again; only a rejected one
  // needs to. Approved means the account is on its way, and the database
  // refuses a second pending row of the same type anyway.
  const canAsk = (type: MetaidType) => {
    const latest = latestOf(type)
    return !latest || latest.status === 'rejected'
  }

  return (
    <div className="xl:max-w-5xl">
      <h1 className={heading}>
        Choose your{' '}
        <span className="text-[#3EE68A]">MetaTrader5 Account</span>
      </h1>
      <p className={`${TEXT.body} mt-4 max-w-2xl text-[#E4EAE7]`}>
        Choose one. newera checks every request before it is approved.
      </p>

      {error && <div className="mt-6"><ErrorAlert>{error}</ErrorAlert></div>}

      {!rows ? (
        <Loading />
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {KINDS.map((kind, i) => {
            const latest = latestOf(kind.type)
            const Icon = kind.icon
            return (
              <motion.article
                key={kind.type}
                className={`${card} flex flex-col p-6`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE, delay: 0.05 + i * 0.08 }}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-[rgba(62,230,138,0.25)] bg-[rgba(62,230,138,0.08)] text-[#3EE68A]">
                    <Icon className="size-5" />
                  </span>
                  {latest && <StatusChip status={latest.status} />}
                </div>

                <h2 className={`${TEXT.body} mt-5 font-semibold`}>{kind.title}</h2>
                <p className={`${TEXT.label} mt-2 leading-relaxed text-[var(--admin-muted)]`}>
                  {kind.blurb}
                </p>

                <div className="mt-auto pt-5">
                  {canAsk(kind.type) ? (
                    <button
                      type="button"
                      onClick={() => setOpen(kind)}
                      className={`${btnPrimary} w-full`}
                    >
                      <Send className="size-4" />
                      Request {kind.title}
                    </button>
                  ) : (
                    <p
                      className={`${TEXT.label} rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 leading-relaxed text-[#E4EAE7]`}
                    >
                      {latest?.status === 'pending'
                        ? AFTER_SUBMIT
                        : `Congratulations. Your ${kind.title} is approved for ${latest?.email}.`}
                    </p>
                  )}
                </div>
              </motion.article>
            )
          })}
        </div>
      )}

      {open && (
        <RequestModal
          kind={open}
          accountEmail={me.email}
          onClose={() => setOpen(null)}
          onChanged={reload}
        />
      )}
    </div>
  )
}

type ModalProps = {
  kind: Kind
  /** The account's own address. Demo is issued against it without asking, and
   *  Real starts by checking whether it can be. */
  accountEmail: string
  onClose: () => void
  onChanged: () => Promise<void>
}

/**
 * What each kind asks for, which is as little as it can.
 *
 * Demo asks nothing: it is issued against the address the account already
 * signed in with, so the dialog opens, files the request and says how long the
 * answer takes.
 *
 * Real starts the same way but has to check first, because the address may
 * already have an account on the broker's side. If it is free the dialog says
 * which address it will use and asks only for a confirmation; if it is not,
 * that is the one case where a different address is asked for.
 */
type Step =
  | { name: 'checking' }
  | { name: 'confirm'; email: string }
  | { name: 'taken'; email: string }
  | { name: 'sent' }

function RequestModal({ kind, accountEmail, onClose, onChanged }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const [step, setStep] = useState<Step>({ name: 'checking' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  const fail = (e: unknown) => {
    if (e instanceof Unauthorized) window.location.href = '/login'
    else setError(e instanceof Error ? e.message : 'Something went wrong.')
  }

  const file = async (email: string) => {
    setBusy(true)
    setError(null)
    try {
      await requestMetaid(kind.type, email)
      setStep({ name: 'sent' })
      // Refreshed behind the open dialog, so closing lands on the new status.
      await onChanged()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  // Demo files straight away; Real asks the broker about the address first.
  useEffect(() => {
    let cancelled = false
    const open = async () => {
      if (kind.type === 'demo') {
        await file(accountEmail)
        return
      }
      try {
        const { available } = await checkMetaidEmail(accountEmail)
        if (cancelled) return
        setStep(
          available
            ? { name: 'confirm', email: accountEmail }
            : { name: 'taken', email: accountEmail }
        )
      } catch (e) {
        if (!cancelled) fail(e)
      }
    }
    open()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** The one case a different address is asked for: the account's own is taken. */
  const onSubmitOther = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const email = String(new FormData(e.currentTarget).get('email') ?? '')
    setBusy(true)
    setError(null)
    try {
      const { available } = await checkMetaidEmail(email)
      if (!available) {
        setStep({ name: 'taken', email })
        setError('This email also has an account. Try a different one.')
        return
      }
      await file(email)
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  const title =
    step.name === 'sent'
      ? 'Request sent'
      : step.name === 'taken'
        ? 'This email is already in use'
        : kind.title

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && !busy && ref.current?.close()}
      aria-labelledby="request-modal-title"
      className={modalShell}
      style={{ colorScheme: 'dark' }}
    >
      <div className={modalCard}>
        <div className="flex items-start gap-3.5">
          <span
            aria-hidden
            className={`grid size-11 shrink-0 place-items-center rounded-xl border ${
              step.name === 'taken'
                ? 'border-[rgba(228,85,60,0.3)] bg-[rgba(228,85,60,0.08)] text-[var(--admin-destructive)]'
                : 'border-[rgba(62,230,138,0.3)] bg-[rgba(62,230,138,0.08)] text-[#3EE68A]'
            }`}
          >
            {step.name === 'sent' ? (
              <CheckCircle2 className="size-5" />
            ) : step.name === 'taken' ? (
              <XCircle className="size-5" />
            ) : (
              <kind.icon className="size-5" />
            )}
          </span>
          <div className="min-w-0">
            <h2 id="request-modal-title" className={`${TEXT.body} font-semibold`}>
              {title}
            </h2>
            {/* Only when the heading is not already the kind's name. */}
            {title !== kind.title && (
              <p className={`${TEXT.label} mt-1 text-[var(--admin-muted)]`}>
                {kind.title}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close"
            className={`${btnIcon} ml-auto`}
          >
            <X className="size-4" />
          </button>
        </div>

        {step.name === 'checking' && (
          <p className={`${TEXT.body} mt-6 flex items-center gap-3 text-[#E4EAE7]`} role="status">
            <Loader2 className="size-4 animate-spin" />
            {kind.type === 'demo' ? 'Sending your request' : 'Checking your email'}
          </p>
        )}

        {step.name === 'confirm' && (
          <>
            <p className={`${TEXT.body} mt-6 leading-relaxed text-[#E4EAE7]`}>
              Your {kind.title} will be held against this email:
            </p>
            <p
              className={`${TEXT.body} mt-3 break-all rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 font-medium`}
            >
              {step.email}
            </p>
            {error && <div className="mt-4"><ErrorAlert>{error}</ErrorAlert></div>}
            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => ref.current?.close()}
                className={btnGhost}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => file(step.email)}
                className={btnPrimary}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Confirm
              </button>
            </div>
          </>
        )}

        {step.name === 'taken' && (
          <form onSubmit={onSubmitOther} className="mt-6">
            <p className={`${TEXT.body} leading-relaxed text-[#E4EAE7]`}>
              <span className="break-all font-medium">{step.email}</span> already
              has a newera account. Enter a different email for your {kind.title}.
            </p>
            <div className="mt-5">
              <label className={`${fieldLabel} mb-2 block`} htmlFor="metaid-email">
                Different email
              </label>
              <input
                id="metaid-email"
                name="email"
                type="email"
                required
                autoFocus
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                className={`${control} w-full`}
              />
            </div>
            {error && <div className="mt-4"><ErrorAlert>{error}</ErrorAlert></div>}
            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => ref.current?.close()}
                className={btnGhost}
              >
                Cancel
              </button>
              <button type="submit" disabled={busy} className={btnPrimary}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Use this email
              </button>
            </div>
          </form>
        )}

        {step.name === 'sent' && (
          <>
            <p className={`${TEXT.body} mt-6 leading-relaxed text-[#E4EAE7]`}>
              {AFTER_SUBMIT}
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => ref.current?.close()}
                className={btnSecondary}
              >
                Done
              </button>
            </div>
          </>
        )}

        {error && step.name === 'checking' && (
          <div className="mt-5">
            <ErrorAlert>{error}</ErrorAlert>
          </div>
        )}
      </div>
    </dialog>
  )
}

/**
 * What the account is, and the two parts of it its owner can change.
 *
 * Email and phone are shown but not editable. Both are unique identifiers
 * other people are told about -- the address confirmed at sign-up, the number
 * the account is found by -- so moving either is a support job with its own
 * confirmation rather than a text field, and saying so beats an input that
 * refuses to save.
 */
function ProfileScreen({ me }: { me: Me }) {
  const [name, setName] = useState(me.full_name ?? '')
  const [savedName, setSavedName] = useState(me.full_name ?? '')
  const [nameBusy, setNameBusy] = useState(false)
  const [nameDone, setNameDone] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  const [pwBusy, setPwBusy] = useState(false)
  const [pwDone, setPwDone] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)

  const fail = (set: (m: string) => void) => (e: unknown) => {
    if (e instanceof Unauthorized) window.location.href = '/login'
    else set(e instanceof Error ? e.message : 'Something went wrong.')
  }

  const saveName = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setNameBusy(true)
    setNameError(null)
    setNameDone(false)
    try {
      const { full_name } = await updateName(name)
      setSavedName(full_name)
      setName(full_name)
      setNameDone(true)
    } catch (err) {
      fail(setNameError)(err)
    } finally {
      setNameBusy(false)
    }
  }

  const savePassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const next = String(data.get('new_password') ?? '')

    setPwError(null)
    setPwDone(false)
    if (next !== String(data.get('confirm') ?? '')) {
      setPwError('The passwords do not match.')
      return
    }

    setPwBusy(true)
    try {
      await changePassword(String(data.get('current_password') ?? ''), next)
      form.reset()
      setPwDone(true)
    } catch (err) {
      fail(setPwError)(err)
    } finally {
      setPwBusy(false)
    }
  }

  return (
    <div className="xl:max-w-5xl">
      <h1 className={heading}>
        My <span className="text-[#3EE68A]">Profile</span>
      </h1>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className={`${card} p-6`}>
          <h2 className={`${TEXT.body} font-semibold`}>Your details</h2>

          <form onSubmit={saveName} className="mt-5 space-y-5">
            <div>
              <label className={`${fieldLabel} mb-2 block`} htmlFor="full-name">
                Full name
              </label>
              <input
                id="full-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setNameDone(false)
                }}
                required
                minLength={2}
                maxLength={80}
                autoComplete="name"
                className={`${control} w-full`}
              />
            </div>

            {/* Shown, not editable, and told why -- an input that refuses to
                save is worse than a line of read-only text. */}
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className={fieldLabel}>Email</dt>
                <dd className={`${TEXT.body} mt-1 break-all text-[var(--admin-muted)]`}>
                  {me.email}
                </dd>
              </div>
              <div>
                <dt className={fieldLabel}>Phone</dt>
                <dd className={`${TEXT.body} mt-1 text-[var(--admin-muted)]`}>
                  {me.phone}
                </dd>
              </div>
            </dl>
            <p className={`${TEXT.label} -mt-1 text-[var(--admin-muted)]`}>
              You cannot change your email or phone number here. Contact us if
              you need to change them.
            </p>

            {nameError && <ErrorAlert>{nameError}</ErrorAlert>}
            {nameDone && <Notice>Name saved.</Notice>}

            <button
              type="submit"
              disabled={nameBusy || name.trim() === savedName.trim()}
              className={`${btnPrimary} w-full sm:w-auto`}
            >
              {nameBusy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Save name
            </button>
          </form>
        </section>

        <section className={`${card} p-6`}>
          <h2 className={`${TEXT.body} font-semibold`}>Change password</h2>

          <form onSubmit={savePassword} className="mt-5 space-y-5">
            <div>
              <label className={`${fieldLabel} mb-2 block`} htmlFor="current-password">
                Current password
              </label>
              <input
                id="current-password"
                name="current_password"
                type="password"
                required
                autoComplete="current-password"
                className={`${control} w-full`}
              />
            </div>
            <div>
              <label className={`${fieldLabel} mb-2 block`} htmlFor="new-password">
                New password
              </label>
              <input
                id="new-password"
                name="new_password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                className={`${control} w-full`}
              />
            </div>
            <div>
              <label className={`${fieldLabel} mb-2 block`} htmlFor="confirm-password">
                Confirm new password
              </label>
              <input
                id="confirm-password"
                name="confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Type it again"
                className={`${control} w-full`}
              />
            </div>

            {pwError && <ErrorAlert>{pwError}</ErrorAlert>}
            {pwDone && <Notice>Password changed.</Notice>}

            <button type="submit" disabled={pwBusy} className={`${btnPrimary} w-full sm:w-auto`}>
              {pwBusy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Change password
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}

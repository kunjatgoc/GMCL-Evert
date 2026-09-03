import { useEffect, useRef, useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import {
  CheckCircle2,
  Clock,
  LayoutDashboard,
  LineChart,
  Loader2,
  LogOut,
  Send,
  Wallet,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { getMe, logout, Unauthorized, type Me } from '../lib/api'
import {
  listMetaid,
  requestMetaid,
  type MetaidRequest,
  type MetaidType,
} from './api'
import { AuthBackdrop, Lockup } from '../components/auth/AuthShell'
import { ErrorAlert } from '../components/auth/FormAlert'
import { GlowButton, holdDone } from '../components/ui/GlowButton'
import { Eyebrow } from '../components/ui/Eyebrow'
import { field, label } from '../lib/fieldStyles'
import { EASE, depthIn } from '../lib/motion'

/**
 * The entrant's area: two screens behind one load.
 *
 * A pathname check rather than a router, the same way main.tsx picks between
 * screens -- two pages that share one fetch do not justify a dependency, and
 * the chunk is already downloaded by the time either is drawn.
 */
const DASHBOARD = '/dashboard'
const REQUEST = '/request-metaid'

const MENU = [
  { path: DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
  { path: REQUEST, label: 'Request a MetaID', icon: Send },
] as const

type Kind = { type: MetaidType; title: string; blurb: string; icon: LucideIcon }

const KINDS: readonly Kind[] = [
  {
    type: 'demo',
    title: 'Demo MetaID',
    blurb:
      'A $10,000 demo balance to trade the league with. No deposit, no risk to your own funds.',
    icon: LineChart,
  },
  {
    type: 'real',
    title: 'Real MetaID',
    blurb:
      'A live account with newera Broker, issued to the address you give here once their checks clear.',
    icon: Wallet,
  },
]

const STATUS = {
  pending: { icon: Clock, tone: 'text-[#ffd166]', label: 'Pending' },
  approved: { icon: CheckCircle2, tone: 'text-[#00FF87]', label: 'Approved' },
  rejected: { icon: XCircle, tone: 'text-[#ff9a9a]', label: 'Rejected' },
} as const

/** What the screen says once a request is in. Asked for word for word. */
const AFTER_SUBMIT = 'Your verification will be done soon within 24hr to 48hr.'

const day = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

const titleOf = (type: MetaidType) =>
  KINDS.find((k) => k.type === type)?.title ?? type

function StatusChip({ status }: { status: MetaidRequest['status'] }) {
  const { icon: Icon, tone, label: text } = STATUS[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[12.5px] font-medium ${tone}`}
    >
      <Icon className="size-3.5" />
      {text}
    </span>
  )
}

export default function UserDashboard() {
  const [me, setMe] = useState<Me | null>(null)
  const [requests, setRequests] = useState<MetaidRequest[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const path = window.location.pathname.replace(/\/+$/, '') || DASHBOARD

  const load = () =>
    Promise.all([getMe(), listMetaid()])
      .then(([m, rows]) => {
        setMe(m)
        setRequests(rows)
      })
      .catch((e: unknown) => {
        // The cookie is the session, so the guard is "does /me answer".
        if (e instanceof Unauthorized) window.location.href = '/login'
        else setError(e instanceof Error ? e.message : 'Something went wrong.')
      })

  useEffect(() => {
    load()
  }, [])

  const signOut = async () => {
    await logout().catch(() => {})
    window.location.href = '/login'
  }

  return (
    <main className="grain relative isolate min-h-dvh overflow-hidden px-6 py-8 sm:py-10">
      <AuthBackdrop />
      {/* A flat scrim rather than the sign-in screen's column-shaped one: this
          page is wider and scrolls, so the darkening has to hold everywhere. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[#060908]/72" />

      <div className="relative z-10 mx-auto w-full max-w-3xl">
        <header className="flex items-center justify-between gap-4">
          <Lockup />
          <motion.button
            type="button"
            onClick={signOut}
            className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-[14px] font-medium text-[#E4EAE7] backdrop-blur-md transition-colors duration-300 hover:border-[rgba(0,255,135,0.4)] hover:bg-white/[0.07] hover:text-white"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
          >
            <LogOut className="size-4" />
            Sign out
          </motion.button>
        </header>

        {/* Plain links, not pushState: two screens sharing one already-loaded
            chunk, and every other navigation on the site works this way. */}
        <nav className="mt-8 flex gap-2" aria-label="Sections">
          {MENU.map(({ path: to, label: text, icon: Icon }) => {
            const current = to === path
            return (
              <a
                key={to}
                href={to}
                aria-current={current ? 'page' : undefined}
                className={`inline-flex h-11 items-center gap-2 rounded-full border px-4 text-[14px] font-medium transition-colors duration-300 ${
                  current
                    ? 'border-[rgba(0,255,135,0.45)] bg-[rgba(0,255,135,0.09)] text-[#00FF87]'
                    : 'border-white/10 bg-white/[0.04] text-[#E4EAE7] hover:border-white/20 hover:text-white'
                }`}
              >
                <Icon className="size-4" />
                {text}
              </a>
            )
          })}
        </nav>

        {me && requests ? (
          path === REQUEST ? (
            <RequestScreen
              me={me}
              requests={requests}
              onChanged={load}
            />
          ) : (
            <DashboardScreen me={me} requests={requests} />
          )
        ) : (
          !error && (
            <p className="mt-24 text-center text-[#E4EAE7]/60" role="status">
              <Loader2 className="mx-auto size-6 animate-spin" />
            </p>
          )
        )}

        {error && (
          <div className="mt-10">
            <ErrorAlert>{error}</ErrorAlert>
          </div>
        )}
      </div>
    </main>
  )
}

/** Who you are, and where each request stands. Nothing to fill in. */
function DashboardScreen({ me, requests }: { me: Me; requests: MetaidRequest[] }) {
  const firstName = me.full_name?.trim().split(/\s+/)[0]

  return (
    <>
      <motion.section
        className="mt-12"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
      >
        <Eyebrow>Your dashboard</Eyebrow>
        <h1 className="mt-5 text-balance text-[clamp(2rem,6vw,2.85rem)] font-bold leading-[1.05]">
          {firstName ? (
            <>
              Hi, <span className="text-[#00FF87] text-glow">{firstName}</span>
            </>
          ) : (
            <>
              Welcome <span className="text-[#00FF87] text-glow">back</span>
            </>
          )}
        </h1>

        <dl className="mt-6 grid gap-x-8 gap-y-3 text-[15px] sm:grid-cols-2">
          <div>
            <dt className="text-[#E4EAE7]/55">Account email</dt>
            <dd className="mt-0.5 text-[#E4EAE7]">{me.email}</dd>
          </div>
          <div>
            <dt className="text-[#E4EAE7]/55">Phone number</dt>
            <dd className="mt-0.5 text-[#E4EAE7]">{me.phone}</dd>
          </div>
        </dl>
      </motion.section>

      <motion.section
        className="mt-12"
        variants={depthIn}
        custom={3}
        initial="hidden"
        animate="show"
      >
        <h2 className="text-[1.35rem] font-bold leading-tight">Your requests</h2>

        {requests.length === 0 ? (
          <div className="glass glass-lip mt-5 rounded-3xl p-7">
            <p className="text-[15.5px] leading-relaxed text-[#E4EAE7]/85">
              You have not asked for a MetaID yet. Pick one and we will take it
              from there.
            </p>
            <GlowButton
              href={REQUEST}
              magnetic={false}
              icon={<Send className="size-4" />}
              className="mt-5 w-full px-6 py-3.5 text-[15px] sm:w-auto"
            >
              Request a MetaID
            </GlowButton>
          </div>
        ) : (
          <ul className="mt-5 space-y-3">
            {requests.map((r) => (
              <li
                key={r.id}
                className="glass glass-lip flex flex-wrap items-start justify-between gap-x-6 gap-y-3 rounded-2xl px-6 py-5"
              >
                <div className="min-w-0">
                  <p className="text-[15.5px] font-semibold">{titleOf(r.type)}</p>
                  <p className="mt-1 break-words text-[14px] text-[#E4EAE7]/75">
                    To {r.email} &middot; asked {day(r.created_at)}
                  </p>
                  {r.status === 'pending' && (
                    <p className="mt-2 text-[14px] text-[#E4EAE7]/85">
                      {AFTER_SUBMIT}
                    </p>
                  )}
                  {r.status === 'rejected' && r.decision_note && (
                    <p className="mt-2 text-[14px] text-[#ff9a9a]">
                      {r.decision_note}
                    </p>
                  )}
                </div>
                <StatusChip status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </motion.section>
    </>
  )
}

type RequestProps = {
  me: Me
  requests: MetaidRequest[]
  onChanged: () => Promise<void>
}

/** The two options, and the modal that takes the address for either. */
function RequestScreen({ me, requests, onChanged }: RequestProps) {
  const [open, setOpen] = useState<Kind | null>(null)

  // A settled request leaves the way clear to ask again; only a rejected one
  // needs to. Approved means the MetaID is on its way, and the database
  // refuses a second pending row of the same type anyway.
  const latestOf = (type: MetaidType) => requests.find((r) => r.type === type)
  const canAsk = (type: MetaidType) => {
    const latest = latestOf(type)
    return !latest || latest.status === 'rejected'
  }

  return (
    <>
      <motion.section
        className="mt-12"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
      >
        <Eyebrow>Request a MetaID</Eyebrow>
        <h1 className="mt-5 text-balance text-[clamp(2rem,6vw,2.85rem)] font-bold leading-[1.05]">
          Pick your <span className="text-[#00FF87] text-glow">MetaID</span>
        </h1>
        <p className="mt-5 max-w-xl text-[1.05rem] leading-relaxed text-[#E4EAE7]">
          Choose one, tell us the address it should go to, and newera takes it
          from there.
        </p>
      </motion.section>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {KINDS.map((kind, i) => {
          const latest = latestOf(kind.type)
          const Icon = kind.icon
          return (
            <motion.article
              key={kind.type}
              className="glass glass-lip relative flex flex-col overflow-hidden rounded-3xl p-7"
              variants={depthIn}
              custom={i + 3}
              initial="hidden"
              animate="show"
            >
              <img
                src="/img/card-texture.webp"
                alt=""
                aria-hidden
                className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.13] mix-blend-screen"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />

              <div className="relative flex items-start justify-between gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-[rgba(0,255,135,0.3)] bg-[rgba(0,255,135,0.07)] text-[#00FF87]">
                  <Icon className="size-5" />
                </span>
                {latest && <StatusChip status={latest.status} />}
              </div>

              <h2 className="relative mt-5 text-[1.35rem] font-bold leading-tight">
                {kind.title}
              </h2>
              <p className="relative mt-2 text-[14.5px] leading-relaxed text-[#E4EAE7]/85">
                {kind.blurb}
              </p>

              <div className="relative mt-auto pt-6">
                {canAsk(kind.type) ? (
                  <GlowButton
                    type="button"
                    magnetic={false}
                    onClick={() => setOpen(kind)}
                    icon={<Send className="size-4" />}
                    className="w-full cursor-pointer px-6 py-3.5 text-[15px]"
                  >
                    Request {kind.title}
                  </GlowButton>
                ) : (
                  <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[14px] leading-relaxed text-[#E4EAE7]/85">
                    {latest?.status === 'pending'
                      ? AFTER_SUBMIT
                      : `Approved. Your MetaID goes to ${latest?.email}.`}
                  </p>
                )}
              </div>
            </motion.article>
          )
        })}
      </div>

      {open && (
        <RequestModal
          kind={open}
          defaultEmail={latestOf(open.type)?.email ?? me.email}
          onClose={() => setOpen(null)}
          onChanged={onChanged}
        />
      )}
    </>
  )
}

type ModalProps = {
  kind: Kind
  defaultEmail: string
  onClose: () => void
  onChanged: () => Promise<void>
}

/**
 * A native <dialog>, opened with showModal(). Escape to close, focus trapped,
 * the page behind it inert, and a real ::backdrop -- all of it free, and none
 * of it worth hand-rolling.
 */
function RequestModal({ kind, defaultEmail, onClose, onChanged }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const email = String(new FormData(e.currentTarget).get('email') ?? '')

    setBusy(true)
    setError(null)
    try {
      await requestMetaid(kind.type, email)
      setBusy(false)
      setDone(true)
      await holdDone()
      setSent(true)
      // Refreshed behind the open dialog, so closing lands on the new status.
      await onChanged()
    } catch (err: unknown) {
      if (err instanceof Unauthorized) window.location.href = '/login'
      else setError(err instanceof Error ? err.message : 'Request failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // Native dialogs do not close on a backdrop click. The target is the
      // dialog itself only when the click landed outside its content.
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      aria-labelledby="request-modal-title"
      // m-auto because Tailwind's preflight zeroes the margin a modal dialog
      // centres itself with. Without it the box sits in the top-left corner.
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-3xl border-0 bg-transparent p-0 text-[#E4EAE7] backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <div className="glass glass-lip relative rounded-3xl p-7">
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label="Close"
          className="absolute right-5 top-5 grid size-9 cursor-pointer place-items-center rounded-full border border-white/10 bg-white/[0.04] text-[#E4EAE7]/70 transition-colors duration-200 hover:border-white/25 hover:text-white"
        >
          <X className="size-4" />
        </button>

        <h2 id="request-modal-title" className="pr-12 text-[1.35rem] font-bold leading-tight">
          {sent ? 'Request received' : kind.title}
        </h2>

        {sent ? (
          <div className="mt-5 space-y-5">
            <p className="text-[15.5px] leading-relaxed text-[#E4EAE7]">
              {AFTER_SUBMIT}
            </p>
            <GlowButton
              type="button"
              magnetic={false}
              onClick={() => ref.current?.close()}
              className="w-full cursor-pointer px-6 py-3.5 text-[15px]"
            >
              Done
            </GlowButton>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-5 space-y-5">
            <div>
              <label className={label} htmlFor="metaid-email">
                Send the MetaID to
              </label>
              <input
                id="metaid-email"
                name="email"
                type="email"
                required
                autoFocus
                inputMode="email"
                autoComplete="email"
                defaultValue={defaultEmail}
                className={`${field} w-full`}
              />
              <p className="mt-2 text-[13.5px] leading-relaxed text-[#E4EAE7]/65">
                The address newera issues the MetaID against. It does not have
                to be your sign-in address.
              </p>
            </div>

            {error && <ErrorAlert>{error}</ErrorAlert>}

            <GlowButton
              type="submit"
              magnetic={false}
              icon={<Send className="size-4" />}
              state={done ? 'done' : busy ? 'busy' : 'idle'}
              doneLabel="Requested"
              className="w-full cursor-pointer px-6 py-3.5 text-[15px]"
            >
              Submit request
            </GlowButton>
          </form>
        )}
      </div>
    </dialog>
  )
}

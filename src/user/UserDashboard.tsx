import { useEffect, useRef, useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import {
  CheckCircle2,
  Clock,
  LayoutDashboard,
  LineChart,
  Loader2,
  Send,
  Wallet,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { Unauthorized, type Me } from '../lib/api'
import { listMetaid, requestMetaid, type MetaidRequest, type MetaidType } from './api'
import { PanelShell, type PanelRoute } from '../panel/PanelShell'
import {
  TEXT,
  btnIcon,
  btnPrimary,
  btnSecondary,
  control,
  fieldLabel,
  modalCard,
  modalShell,
} from '../panel/type'
import { ErrorAlert } from '../components/auth/FormAlert'
import { EASE } from '../lib/motion'

/** What an entrant can reach. Two screens, drawn by the same rail the admin
 *  panel uses -- the list is what differs between roles, never the shell. */
const ROUTES: readonly PanelRoute[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, view: DashboardScreen },
  { path: '/request-metaid', label: 'Request a MetaID', icon: Send, view: RequestScreen },
]

export default function UserDashboard() {
  return <PanelShell routes={ROUTES} subtitle="Your account" role="end_user" />
}

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
  pending: { icon: Clock, tone: 'text-[var(--admin-gold)]', label: 'Pending' },
  approved: { icon: CheckCircle2, tone: 'text-[#3EE68A]', label: 'Approved' },
  rejected: { icon: XCircle, tone: 'text-[var(--admin-destructive)]', label: 'Rejected' },
} as const

/** What the screen says once a request is in. Asked for word for word. */
const AFTER_SUBMIT = 'Your verification will be done soon within 24hr to 48hr.'

const day = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

const titleOf = (type: MetaidType) => KINDS.find((k) => k.type === type)?.title ?? type

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
 *  it into the shell would only make the shell care about MetaIDs. */
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

/** Who you are, and where each request stands. Nothing to fill in. */
function DashboardScreen({ me }: { me: Me }) {
  const { rows, error } = useRequests()
  const firstName = me.full_name?.trim().split(/\s+/)[0]

  return (
    <div>
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

      <dl className="mt-6 grid gap-x-10 gap-y-3 sm:grid-cols-2">
        <div>
          <dt className={fieldLabel}>Account email</dt>
          <dd className={`${TEXT.body} mt-1 break-words`}>{me.email}</dd>
        </div>
        <div>
          <dt className={fieldLabel}>Phone number</dt>
          <dd className={`${TEXT.body} mt-1`}>{me.phone}</dd>
        </div>
      </dl>

      {error && <div className="mt-6"><ErrorAlert>{error}</ErrorAlert></div>}

      <h2 className={`${TEXT.body} mt-8 font-semibold`}>Your requests</h2>

      {!rows ? (
        <Loading />
      ) : rows.length === 0 ? (
        <div className={`${card} mt-4 p-6 xl:max-w-5xl`}>
          <p className={`${TEXT.body} text-[#E4EAE7]`}>
            You have not asked for a MetaID yet. Pick one and we will take it
            from there.
          </p>
          <a href="/request-metaid" className={`${btnPrimary} mt-5`}>
            <Send className="size-4" />
            Request a MetaID
          </a>
        </div>
      ) : (
        <ul className="mt-4 space-y-3 xl:max-w-5xl">
          {rows.map((r, i) => (
            <motion.li
              key={r.id}
              className={`${card} flex flex-wrap items-start justify-between gap-x-6 gap-y-3 px-6 py-5`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: EASE, delay: i * 0.05 }}
            >
              <div className="min-w-0">
                <p className={`${TEXT.body} font-semibold`}>{titleOf(r.type)}</p>
                <p className={`${TEXT.label} mt-1 break-words text-[var(--admin-muted)]`}>
                  To {r.email} &middot; asked {day(r.created_at)}
                </p>
                {r.status === 'pending' && (
                  <p className={`${TEXT.label} mt-2 text-[#E4EAE7]`}>{AFTER_SUBMIT}</p>
                )}
                {r.status === 'rejected' && r.decision_note && (
                  <p className={`${TEXT.label} mt-2 text-[var(--admin-destructive)]`}>
                    {r.decision_note}
                  </p>
                )}
              </div>
              <StatusChip status={r.status} />
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** The two options, and the modal that takes the address for either. */
function RequestScreen() {
  const { rows, error, reload } = useRequests()
  const [open, setOpen] = useState<Kind | null>(null)

  const latestOf = (type: MetaidType) => rows?.find((r) => r.type === type)
  // A settled request leaves the way clear to ask again; only a rejected one
  // needs to. Approved means the MetaID is on its way, and the database
  // refuses a second pending row of the same type anyway.
  const canAsk = (type: MetaidType) => {
    const latest = latestOf(type)
    return !latest || latest.status === 'rejected'
  }

  return (
    <div>
      <h1 className={heading}>
        Pick your <span className="text-[#3EE68A]">MetaID</span>
      </h1>
      <p className={`${TEXT.body} mt-4 max-w-2xl text-[#E4EAE7]`}>
        Choose one, tell us the address it should go to, and newera takes it
        from there.
      </p>

      {error && <div className="mt-6"><ErrorAlert>{error}</ErrorAlert></div>}

      {!rows ? (
        <Loading />
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:max-w-5xl">
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
                        : `Approved. Your MetaID goes to ${latest?.email}.`}
                    </p>
                  )}
                </div>
              </motion.article>
            )
          })}
        </div>
      )}

      {open && (
        <RequestModal kind={open} onClose={() => setOpen(null)} onChanged={reload} />
      )}
    </div>
  )
}

type ModalProps = {
  kind: Kind
  onClose: () => void
  onChanged: () => Promise<void>
}

/**
 * A native <dialog>, opened with showModal(). Escape to close, focus trapped,
 * the page behind it inert, and a real ::backdrop -- all of it free, and none
 * of it worth hand-rolling.
 */
function RequestModal({ kind, onClose, onChanged }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const [busy, setBusy] = useState(false)
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
      className={modalShell}
      style={{ colorScheme: 'dark' }}
    >
      <div className={modalCard}>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label="Close"
          className={`${btnIcon} absolute right-5 top-5`}
        >
          <X className="size-4" />
        </button>

        <h2 id="request-modal-title" className={`${TEXT.body} pr-12 font-semibold`}>
          {sent ? 'Request received' : kind.title}
        </h2>

        {sent ? (
          <div className="mt-5 space-y-5">
            <p className={`${TEXT.body} leading-relaxed`}>{AFTER_SUBMIT}</p>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              className={`${btnSecondary} w-full`}
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-5 space-y-5">
            <div>
              <label className={`${fieldLabel} mb-2 block`} htmlFor="metaid-email">
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
                placeholder="you@example.com"
                className={`${control} w-full`}
              />
              <p className={`${TEXT.label} mt-2 leading-relaxed text-[var(--admin-muted)]`}>
                The address newera issues the MetaID against. It does not have
                to be your sign-in address.
              </p>
            </div>

            {error && <ErrorAlert>{error}</ErrorAlert>}

            <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {busy ? 'Sending' : 'Submit request'}
            </button>
          </form>
        )}
      </div>
    </dialog>
  )
}

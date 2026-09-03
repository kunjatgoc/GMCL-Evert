import { useEffect, useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import {
  CheckCircle2,
  Clock,
  LineChart,
  Loader2,
  LogOut,
  Send,
  Wallet,
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

const day = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

/**
 * The entrant's dashboard: one card per kind of MetaID, each showing the
 * latest answer or the form to ask. newera decides in the admin panel and
 * emails the MetaID itself, so nothing here ever displays one.
 */
export default function UserDashboard() {
  const [me, setMe] = useState<Me | null>(null)
  const [requests, setRequests] = useState<MetaidRequest[] | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  const firstName = me?.full_name?.trim().split(/\s+/)[0]

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

        {me && requests ? (
          <>
            <motion.section
              className="mt-14"
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
              <p className="mt-3 text-[15px] text-[#E4EAE7]/75">{me.email}</p>
              <p className="mt-5 max-w-xl text-[1.05rem] leading-relaxed text-[#E4EAE7]">
                Ask for the MetaID you want to trade with. newera answers each
                request by email, and the answer shows here.
              </p>
            </motion.section>

            {error && (
              <div className="mt-8">
                <ErrorAlert>{error}</ErrorAlert>
              </div>
            )}

            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {KINDS.map((kind, i) => (
                <MetaidCard
                  key={kind.type}
                  kind={kind}
                  index={i}
                  latest={requests.find((r) => r.type === kind.type)}
                  accountEmail={me.email}
                  onChanged={load}
                />
              ))}
            </div>
          </>
        ) : (
          !error && (
            <p className="mt-24 text-center text-[#E4EAE7]/60" role="status">
              <Loader2 className="mx-auto size-6 animate-spin" />
            </p>
          )
        )}

        {error && !me && (
          <div className="mt-10">
            <ErrorAlert>{error}</ErrorAlert>
          </div>
        )}
      </div>
    </main>
  )
}

type CardProps = {
  kind: Kind
  index: number
  /** Newest request of this kind, if any. */
  latest?: MetaidRequest
  accountEmail: string
  onChanged: () => Promise<void>
}

const STATUS = {
  pending: { icon: Clock, tone: 'text-[#ffd166]', label: 'Waiting for newera' },
  approved: { icon: CheckCircle2, tone: 'text-[#00FF87]', label: 'Approved' },
  rejected: { icon: XCircle, tone: 'text-[#ff9a9a]', label: 'Declined' },
} as const

function MetaidCard({ kind, index, latest, accountEmail, onChanged }: CardProps) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const Icon = kind.icon

  // A settled request leaves the way clear to ask again; only a declined one
  // needs to. Approved means the MetaID is on its way, and asking twice would
  // only confuse whoever answers.
  const canAsk = !latest || latest.status === 'rejected'

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
      await onChanged()
    } catch (err: unknown) {
      if (err instanceof Unauthorized) window.location.href = '/login'
      else setError(err instanceof Error ? err.message : 'Request failed.')
    } finally {
      setBusy(false)
    }
  }

  const status = latest && STATUS[latest.status]
  const StatusIcon = status?.icon

  return (
    <motion.article
      className="glass glass-lip relative flex flex-col overflow-hidden rounded-3xl p-7"
      variants={depthIn}
      custom={index + 3}
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
        {status && StatusIcon && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[12.5px] font-medium ${status.tone}`}
          >
            <StatusIcon className="size-3.5" />
            {status.label}
          </span>
        )}
      </div>

      <h2 className="relative mt-5 text-[1.35rem] font-bold leading-tight">{kind.title}</h2>
      <p className="relative mt-2 text-[14.5px] leading-relaxed text-[#E4EAE7]/85">
        {kind.blurb}
      </p>

      {latest && (
        <div className="relative mt-5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[14px] leading-relaxed text-[#E4EAE7]/85">
          {latest.status === 'pending' && (
            <>
              Asked on {day(latest.created_at)} for{' '}
              <span className="text-white">{latest.email}</span>. newera will
              email you once it is decided.
            </>
          )}
          {latest.status === 'approved' && (
            <>
              Approved{latest.decided_at ? ` on ${day(latest.decided_at)}` : ''}.
              Your MetaID goes to <span className="text-white">{latest.email}</span>.
            </>
          )}
          {latest.status === 'rejected' && (
            <>
              Declined{latest.decided_at ? ` on ${day(latest.decided_at)}` : ''}.
              {latest.decision_note ? ` ${latest.decision_note}` : ''} You can ask
              again below.
            </>
          )}
        </div>
      )}

      {canAsk && (
        <form onSubmit={onSubmit} className="relative mt-5 space-y-4">
          <div>
            <label className={label} htmlFor={`${kind.type}-email`}>
              Send the MetaID to
            </label>
            <input
              id={`${kind.type}-email`}
              name="email"
              type="email"
              required
              inputMode="email"
              autoComplete="email"
              defaultValue={latest?.email ?? accountEmail}
              className={`${field} w-full`}
            />
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
            Request {kind.title}
          </GlowButton>
        </form>
      )}
    </motion.article>
  )
}

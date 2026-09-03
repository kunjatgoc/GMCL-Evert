import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { GlowButton, holdDone } from '../ui/GlowButton'
import { label } from '../../lib/fieldStyles'
import { resendOtp, submitOtp } from '../../lib/submit'
import { prefersReducedMotion } from '../../lib/motionPreference'
import { ErrorAlert, Notice } from './FormAlert'
import { resetOrbit, runOrbit, type OrbitParts, type OrbitPhase } from './orbit'

/** Mirrors OTP_RESEND_SECONDS in api/index.py. The server is the rule; this
 *  only stops the button offering something that would be refused. */
const RESEND_SECONDS = 60

type Props = {
  /** Where the code went, for the notices. */
  address: string
  /** Whether the step before this one actually mailed a code. False means one
   *  went out moments ago and is still live, so the copy must not claim a
   *  fresh one. */
  sent: boolean
  /** The code was right and the session is set. */
  onVerified: (role: string) => void
  /** The pending cookie lapsed, so no code can be checked or re-sent. The
   *  caller decides where that leaves the person. */
  onExpired: () => void
  /** The quiet link opposite the resend. */
  back: { label: string; onClick: () => void }
  submitLabel?: string
}

/**
 * The confirmation step. Owns the code, the countdown and its own messages,
 * so sign-in and sign-up share one screen for it rather than two copies that
 * would drift.
 */
export function OtpForm({
  address,
  sent,
  onVerified,
  onExpired,
  back,
  submitLabel = 'Verify and sign in',
}: Props) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(() =>
    sent
      ? `We sent a six-digit code to ${address}.`
      : `A code was sent to ${address} moments ago. Use that one.`
  )
  const [cooldown, setCooldown] = useState(RESEND_SECONDS)
  const [phase, setPhase] = useState<OrbitPhase>('idle')

  const gridRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<SVGSVGElement>(null)
  const hubRef = useRef<HTMLSpanElement>(null)
  const landedRef = useRef<HTMLSpanElement>(null)

  const orbitParts = (): OrbitParts | null => {
    const grid = gridRef.current
    const ring = ringRef.current
    const hub = hubRef.current
    const landed = landedRef.current
    if (!grid || !ring || !hub || !landed) return null
    return { grid, ring, hub, landed }
  }

  // One timeout per second rather than an interval, so the countdown cannot
  // outlive the component or double up.
  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const parts = orbitParts()
    // The turn is the whole answer, so a person who asked for less motion gets
    // the plain busy button instead -- not a shortened turn.
    if (!parts || prefersReducedMotion()) {
      setBusy(true)
      const res = await submitOtp(code)
      setBusy(false)
      if (res.ok) {
        setDone(true)
        await holdDone()
        onVerified(res.role)
        return
      }
      if (res.expired) {
        onExpired()
        return
      }
      setError(res.error)
      return
    }

    // Asked at the same moment the row starts to curl, so the wind-up is spent
    // on the wait rather than added to it.
    const pending = submitOtp(code)
    await runOrbit(
      parts,
      pending.then((r) => r.ok),
      setPhase
    )

    const res = await pending
    if (res.ok) {
      onVerified(res.role)
      return
    }

    resetOrbit(parts)
    setPhase('idle')
    if (res.expired) {
      onExpired()
      return
    }
    // The code that was just refused is not worth another press.
    setCode('')
    setError(res.error)
  }

  const onResend = async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    const res = await resendOtp()
    setBusy(false)

    if (res.ok) {
      setCode('')
      setCooldown(RESEND_SECONDS)
      setNotice(`A new code is on its way to ${address}.`)
      return
    }
    if (res.expired) {
      onExpired()
      return
    }
    setError(res.error)
  }

  // The ring is wider and taller than the row it came from, so the two lines
  // closest to it stand down while it turns rather than being drawn through.
  const turning = phase !== 'idle'
  const standDown = turning ? 'opacity-0' : 'opacity-100'

  return (
    <form onSubmit={onSubmit} className="relative space-y-5">
      <div>
        <label
          className={`${label} transition-opacity duration-300 ${standDown}`}
          htmlFor="otp"
        >
          Six-digit code
        </label>

        {/* Six slots drawn behind one real field, not six fields. The input
            keeps `one-time-code`, so a paste of all six digits and the
            browser's own autofill both still land in one place; the boxes are
            only what the digits look like. Non-digits are dropped as they
            arrive, so the server never sees a code it would only reject.

            Raised is empty, sunk is filled: a box with a digit in it is
            pressed into the card, and the one waiting for the next digit is
            lit. Lit, not green -- green is what a verified code earns, and
            spending it on "your cursor is here" leaves the tick nothing to
            say. */}
        <div className="group relative" data-phase={phase}>
          <input
            id="otp"
            name="otp"
            required
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            disabled={phase !== 'idle'}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            // Transparent rather than hidden: a field with no box still takes
            // the OS autofill and the paste, and screen readers still find it.
            className="absolute inset-0 z-10 w-full cursor-text bg-transparent text-transparent caret-transparent outline-none disabled:cursor-default"
          />

          {/* The track the six curl onto. Dotted on purpose: a solid ring at
              this size reads as a loading spinner, and non-scaling-stroke
              keeps the dots the same weight whatever radius the row works out
              to. Sized and placed by orbit.ts, which knows the radius. */}
          <svg
            ref={ringRef}
            aria-hidden
            viewBox="0 0 100 100"
            className="pointer-events-none absolute z-0 opacity-0 [overflow:visible]"
          >
            <circle
              cx="50"
              cy="50"
              r="50"
              fill="none"
              vectorEffect="non-scaling-stroke"
              strokeWidth="1.5"
              strokeDasharray="2 8"
              strokeLinecap="round"
              className="stroke-white/35 transition-colors duration-200 group-data-[phase=ok]:stroke-[#00FF87]"
            />
          </svg>

          {/* The point it all turns around, and collapses into. */}
          <span
            ref={hubRef}
            aria-hidden
            className="pointer-events-none absolute z-0 size-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/50 opacity-0 transition-colors duration-200 group-data-[phase=ok]:bg-[#00FF87]"
          />

          <div ref={gridRef} aria-hidden className="grid grid-cols-6 gap-2">
            {Array.from({ length: 6 }, (_, i) => {
              const filled = i < code.length
              // The caret sits on the next empty box, and stays on the last
              // one once all six are in.
              const active = i === Math.min(code.length, 5)
              return (
                <span
                  key={i}
                  data-filled={filled || undefined}
                  className={[
                    'grid h-14 place-items-center rounded-xl border text-[22px] font-semibold',
                    'transition-[background-color,border-color,box-shadow,color] duration-200',
                    'ease-[cubic-bezier(0.23,1,0.32,1)]',
                    filled
                      ? // Sunk: darker than the card, and the lip moves to the
                        // inside of the top edge, where a pressed key catches it.
                        'border-black/40 bg-black/45 text-white shadow-[inset_0_2px_7px_rgba(0,0,0,0.75)]'
                      : // Raised: lighter than the card, lit along the top edge
                        // and casting a small shadow of its own.
                        'border-white/10 bg-white/[0.055] text-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_2px_6px_rgba(0,0,0,0.45)]',
                    // focus-within on the wrapper, not peer-focus: the boxes
                    // are the input's nephews, and a peer selector only
                    // reaches siblings.
                    active
                      ? 'group-focus-within:border-white/45 group-focus-within:bg-white/[0.08] group-focus-within:shadow-[0_0_0_4px_rgba(255,255,255,0.08)]'
                      : '',
                    // The verdict, once the server has given one. Nothing on
                    // this screen is green before it.
                    'group-data-[phase=ok]:!border-[#00FF87]/70 group-data-[phase=ok]:!bg-[rgba(0,255,135,0.14)] group-data-[phase=ok]:!text-[#9dffcf]',
                    'group-data-[phase=ok]:!shadow-[0_0_22px_-4px_rgba(0,255,135,0.55)]',
                    'group-data-[phase=fail]:!border-[#ff6b6b]/70 group-data-[phase=fail]:!text-[#ff9a9a]',
                  ].join(' ')}
                >
                  {code[i] ?? '0'}
                </span>
              )
            })}
          </div>

          {/* What the six become. Sits under them until the collapse hands the
              screen over to it. */}
          <span
            ref={landedRef}
            aria-hidden
            className="pointer-events-none absolute z-20 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl border border-[#00FF87]/70 bg-[rgba(0,255,135,0.14)] text-[#00FF87] opacity-0 shadow-[0_0_30px_-4px_rgba(0,255,135,0.7)]"
          >
            <Check className="size-6" strokeWidth={2.75} />
          </span>
        </div>
      </div>

      <div className={`transition-opacity duration-300 ${standDown}`}>
        {notice && <Notice>{notice}</Notice>}
        {error && <ErrorAlert>{error}</ErrorAlert>}
      </div>

      {/* No glyph ride while the ring turns: one thing answers one action, and
          the ring is already answering this one. */}
      <GlowButton
        type="submit"
        magnetic={false}
        icon={<ArrowRight className="size-4" />}
        state={done ? 'done' : busy ? 'busy' : 'idle'}
        doneLabel="Confirmed"
        disabled={turning || code.length < 6}
        className="mt-2 w-full cursor-pointer"
      >
        {submitLabel}
      </GlowButton>

      <p className="text-center text-[14px] leading-relaxed text-[#E4EAE7]/80">
        A one-time check on a new account. After this, your password is all
        you need.
      </p>

      <div className="flex items-center justify-between gap-4 pt-1 text-[13.5px]">
        <button
          type="button"
          disabled={turning}
          onClick={back.onClick}
          className="cursor-pointer text-[#E4EAE7]/75 underline-offset-4 transition-colors duration-200 hover:text-white hover:underline"
        >
          {back.label}
        </button>

        {/* Disabled for exactly as long as the server would refuse another,
            so the countdown is the rate limit made visible rather than a
            second rule that could disagree with it. */}
        <button
          type="button"
          onClick={onResend}
          disabled={busy || done || turning || cooldown > 0}
          className="cursor-pointer font-medium text-[#00FF87] underline-offset-4 transition-colors duration-200 hover:underline disabled:cursor-default disabled:text-[#E4EAE7]/45 disabled:no-underline"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
        </button>
      </div>
    </form>
  )
}

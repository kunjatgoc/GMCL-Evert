import { useEffect, useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { GlowButton } from '../ui/GlowButton'
import { field, label } from '../../lib/fieldStyles'
import { resendOtp, submitOtp } from '../../lib/submit'
import { ErrorAlert, Notice } from './FormAlert'

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
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(() =>
    sent
      ? `We sent a six-digit code to ${address}.`
      : `A code was sent to ${address} moments ago. Use that one.`
  )
  const [cooldown, setCooldown] = useState(RESEND_SECONDS)

  // One timeout per second rather than an interval, so the countdown cannot
  // outlive the component or double up.
  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await submitOtp(code)
    setBusy(false)

    if (res.ok) {
      onVerified(res.role)
      return
    }
    if (res.expired) {
      onExpired()
      return
    }
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

  return (
    <form onSubmit={onSubmit} className="relative space-y-5">
      <div>
        <label className={label} htmlFor="otp">
          Six-digit code
        </label>
        {/* One field rather than six boxes: `one-time-code` lets the phone
            offer the code from the notification, and a paste of all six
            digits lands in one place. Non-digits are dropped as they arrive,
            so the server never sees a code it would only reject. */}
        <input
          id="otp"
          name="otp"
          required
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className={`${field} w-full text-center text-[22px] font-semibold tracking-[0.45em] [text-indent:0.45em]`}
        />
      </div>

      {notice && <Notice>{notice}</Notice>}
      {error && <ErrorAlert>{error}</ErrorAlert>}

      <GlowButton
        type="submit"
        magnetic={false}
        disabled={busy || code.length < 6}
        className="mt-2 w-full cursor-pointer"
      >
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Verifying…
          </>
        ) : (
          submitLabel
        )}
      </GlowButton>

      <p className="text-center text-[14px] leading-relaxed text-[#E4EAE7]/80">
        A one-time check on a new account. After this, your password is all
        you need.
      </p>

      <div className="flex items-center justify-between gap-4 pt-1 text-[13.5px]">
        <button
          type="button"
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
          disabled={busy || cooldown > 0}
          className="cursor-pointer font-medium text-[#00FF87] underline-offset-4 transition-colors duration-200 hover:underline disabled:cursor-default disabled:text-[#E4EAE7]/45 disabled:no-underline"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
        </button>
      </div>
    </form>
  )
}

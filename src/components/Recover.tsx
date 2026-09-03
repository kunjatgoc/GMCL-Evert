import { useState, type FormEvent } from 'react'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { GlowButton, holdDone } from './ui/GlowButton'
import { field, label } from '../lib/fieldStyles'
import { submitForgotPassword, submitResetPassword } from '../lib/submit'
import { AuthShell } from './auth/AuthShell'
import { PasswordField } from './auth/PasswordField'
import { ErrorAlert, Notice } from './auth/FormAlert'

/**
 * The two halves of forgetting a password: asking for the link, and spending
 * it. One file because they are one flow, and neither is big enough to be
 * worth opening a second.
 *
 * Browser validation only, as on the sign-in screen -- `required`, `type`, and
 * `minLength` are every rule a client is entitled to hold an opinion about,
 * and the server checks all three again.
 */

/** Matches `Field(min_length=8)` on the endpoint and the signup schema. */
const MIN_PASSWORD = 8

export function ForgotPassword() {
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // Read before the await: currentTarget is null once the handler yields.
    const address = String(new FormData(e.currentTarget).get('email') ?? '')

    setBusy(true)
    setError(null)
    const res = await submitForgotPassword(address)
    setBusy(false)

    if (!res.ok) {
      setError(res.error)
      return
    }
    setSentTo(address)
  }

  return (
    <AuthShell
      eyebrow="Password reset"
      title={
        sentTo ? (
          <>
            Check your <span className="text-[#00FF87] text-glow">inbox</span>
          </>
        ) : (
          <>
            Forgot your <span className="text-[#00FF87] text-glow">password</span>
          </>
        )
      }
      footer={
        <>
          <ShieldCheck className="mr-1.5 inline size-4 -translate-y-px text-[#00FF87]" />
          The link expires in 30 minutes and works once
        </>
      }
    >
      {sentTo ? (
        // Worded around "if": the server will not say whether the address has
        // an account, so this screen must not imply one either way.
        <div className="relative space-y-5">
          <Notice>
            If {sentTo} has an account, a reset link is on its way. It expires
            in 30 minutes.
          </Notice>
          <p className="text-[15px] leading-relaxed text-[#E4EAE7]/80">
            Nothing arrived? Check the spam folder, then ask again in a minute
            &mdash; a link sent moments ago is still the live one.
          </p>
          <GlowButton
            href="/login"
            magnetic={false}
            icon={<ArrowRight className="size-4" />}
            className="w-full"
          >
            Back to sign in
          </GlowButton>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="relative space-y-5">
          <p className="text-[15px] leading-relaxed text-[#E4EAE7]/80">
            Give us the address on the account and we will send a link to
            choose a new password.
          </p>

          <div>
            <label className={label} htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              inputMode="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              className={`${field} w-full`}
            />
          </div>

          {error && <ErrorAlert>{error}</ErrorAlert>}

          <GlowButton
            type="submit"
            magnetic={false}
            icon={<ArrowRight className="size-4" />}
            state={busy ? 'busy' : 'idle'}
            className="mt-2 w-full cursor-pointer"
          >
            Send the link
          </GlowButton>

          <p className="text-center text-[14px] leading-relaxed text-[#E4EAE7]/80">
            Remembered it?{' '}
            <a
              href="/login"
              className="font-medium text-[#00FF87] underline-offset-4 hover:underline"
            >
              Sign in
            </a>
          </p>
        </form>
      )}
    </AuthShell>
  )
}

export function ResetPassword() {
  // Read once, at mount. The link is the whole credential, so a missing half
  // is a broken link and the form is never worth drawing.
  const [params] = useState(() => new URLSearchParams(window.location.search))
  const uid = params.get('uid') ?? ''
  const token = params.get('token') ?? ''

  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [changed, setChanged] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const password = String(data.get('password') ?? '')

    // Checked here rather than as you type: a password you are halfway through
    // typing does not match the one above it, and saying so on every keystroke
    // is noise. Nothing is sent when they differ, so the button never spins.
    if (password !== String(data.get('confirm') ?? '')) {
      setError('Those two passwords do not match.')
      return
    }

    setBusy(true)
    setError(null)
    const res = await submitResetPassword(uid, token, password)
    setBusy(false)

    if (!res.ok) {
      setError(res.error)
      return
    }
    setDone(true)
    await holdDone()
    setChanged(true)
  }

  const broken = !uid || !token

  return (
    <AuthShell
      eyebrow="Password reset"
      title={
        changed ? (
          <>
            That&rsquo;s <span className="text-[#00FF87] text-glow">done</span>
          </>
        ) : (
          <>
            Choose a new <span className="text-[#00FF87] text-glow">password</span>
          </>
        )
      }
      footer={
        <>
          <ShieldCheck className="mr-1.5 inline size-4 -translate-y-px text-[#00FF87]" />
          This link stops working once it is used
        </>
      }
    >
      {changed ? (
        <div className="relative space-y-5">
          <Notice>Your password is set. Sign in with it.</Notice>
          <GlowButton
            href="/login"
            magnetic={false}
            icon={<ArrowRight className="size-4" />}
            className="w-full"
          >
            Sign in
          </GlowButton>
        </div>
      ) : broken ? (
        <div className="relative space-y-5">
          <ErrorAlert>
            This link is incomplete. Open the one from the email in full, or ask
            for another.
          </ErrorAlert>
          <GlowButton
            href="/forgot-password"
            magnetic={false}
            icon={<ArrowRight className="size-4" />}
            className="w-full"
          >
            Send me a new link
          </GlowButton>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="relative space-y-5">
          <div>
            <label className={label} htmlFor="new-password">
              New password
            </label>
            <PasswordField
              id="new-password"
              name="password"
              required
              minLength={MIN_PASSWORD}
              autoFocus
              autoComplete="new-password"
              placeholder={`At least ${MIN_PASSWORD} characters`}
            />
          </div>

          <div>
            <label className={label} htmlFor="confirm-password">
              Confirm new password
            </label>
            <PasswordField
              id="confirm-password"
              name="confirm"
              required
              minLength={MIN_PASSWORD}
              // Same token as the field above, so a manager offers to fill
              // both with the one it just generated rather than treating this
              // as a second, different password.
              autoComplete="new-password"
              placeholder="Type it again"
            />
          </div>

          {error && <ErrorAlert>{error}</ErrorAlert>}

          <GlowButton
            type="submit"
            magnetic={false}
            icon={<ArrowRight className="size-4" />}
            state={done ? 'done' : busy ? 'busy' : 'idle'}
            doneLabel="Password set"
            className="mt-2 w-full cursor-pointer"
          >
            Set new password
          </GlowButton>

          {/* The way out when the link has lapsed, which is what the 401 above
              says and the only failure a person can act on. */}
          <p className="text-center text-[14px] leading-relaxed text-[#E4EAE7]/80">
            Link expired?{' '}
            <a
              href="/forgot-password"
              className="font-medium text-[#00FF87] underline-offset-4 hover:underline"
            >
              Ask for another
            </a>
          </p>
        </form>
      )}
    </AuthShell>
  )
}

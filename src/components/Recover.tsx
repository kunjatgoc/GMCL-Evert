import { useState, type FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
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
      eyebrow="Reset password"
      title={
        sentTo ? (
          <>
            Check your <span className="text-[#00FF87] text-glow">email</span>
          </>
        ) : (
          <>
            Forgot your <span className="text-[#00FF87] text-glow">password</span>
          </>
        )
      }

    >
      {sentTo ? (
        // Worded around "if": the server will not say whether the address has
        // an account, so this screen must not imply one either way.
        <div className="relative space-y-5">
          <Notice>
            If {sentTo} has an account, we sent a reset link to it. The link
            works for 30 minutes.
          </Notice>
          <p className="text-[15px] leading-relaxed text-[#E4EAE7]/80">
            No email? Check your spam folder. You can ask for a new link after
            one minute.
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
            Enter your email. We will send you a link to set a new password.
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
            Send link
          </GlowButton>

          <p className="text-center text-[14px] leading-relaxed text-[#E4EAE7]/80">
            Remember your password?{' '}
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
      setError('The passwords do not match.')
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
      eyebrow="Reset password"
      title={
        changed ? (
          <>
            Password <span className="text-[#00FF87] text-glow">changed</span>
          </>
        ) : (
          <>
            Set a new <span className="text-[#00FF87] text-glow">password</span>
          </>
        )
      }

    >
      {changed ? (
        <div className="relative space-y-5">
          <Notice>Your password is changed. You can sign in now.</Notice>
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
            This link is broken. Open the full link from your email, or ask for
            a new one.
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
            doneLabel="Password changed"
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
              Get a new one
            </a>
          </p>
        </form>
      )}
    </AuthShell>
  )
}

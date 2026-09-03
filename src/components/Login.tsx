import { useState, type FormEvent } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import { GlowButton } from './ui/GlowButton'
import { field, label } from '../lib/fieldStyles'
import { submitLogin } from '../lib/submit'
import { homeFor } from '../lib/api'
import { AuthShell } from './auth/AuthShell'
import { OtpForm } from './auth/OtpForm'
import { PasswordField } from './auth/PasswordField'
import { ErrorAlert } from './auth/FormAlert'

type Stage = { name: 'password' } | { name: 'otp'; address: string; sent: boolean }

/**
 * Sign-in, for admins and league entrants alike: the server says which by the
 * role it answers with, and the screen goes wherever that role lives.
 *
 * Validation is the browser's -- `required` plus `type="email"` covers every
 * rule a client is entitled to have an opinion about, and the only other
 * verdict (do these credentials match) belongs to the server. So no zod schema
 * and no form library here.
 *
 * Usually one stage. An address that has never been confirmed gets a second:
 * a six-digit code, once, mailed when the account was created. Both stages
 * wear the same glass, so the screen changes its question without changing its
 * shape.
 */
export function Login() {
  const [stage, setStage] = useState<Stage>({ name: 'password' })
  // Remembered across stages, so "use a different account" comes back with
  // the address still filled in.
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const backToPassword = (message: string | null = null) => {
    setStage({ name: 'password' })
    setError(message)
  }

  const onPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // Read before the await: currentTarget is null once the handler yields.
    const data = new FormData(e.currentTarget)
    const email = String(data.get('email') ?? '')

    setBusy(true)
    setError(null)
    const res = await submitLogin(email, String(data.get('password') ?? ''))
    setBusy(false)

    if (!res.ok) {
      setError(res.error)
      return
    }

    // The usual case: a confirmed address needs nothing else. Full navigation
    // rather than a client-side swap -- the panel is a separate chunk and the
    // session cookie has just changed.
    if (res.stage === 'done') {
      window.location.href = homeFor(res.role)
      return
    }

    setAddress(email)
    setStage({ name: 'otp', address: email, sent: res.sent })
  }

  return (
    <AuthShell
      eyebrow="Sign in"
      title={
        stage.name === 'password' ? (
          <>
            Back to the <span className="text-[#00FF87] text-glow">board</span>
          </>
        ) : (
          <>
            Confirm your <span className="text-[#00FF87] text-glow">email</span>
          </>
        )
      }
      footer={
        <>
          <ShieldCheck className="mr-1.5 inline size-4 -translate-y-px text-[#00FF87]" />
          All sign-ins are recorded
        </>
      }
    >
      {stage.name === 'password' ? (
        <form onSubmit={onPassword} className="relative space-y-5">
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
              defaultValue={address}
              placeholder="you@example.com"
              className={`${field} w-full`}
            />
          </div>

          <div>
            <label className={label} htmlFor="current-password">
              Password
            </label>
            <PasswordField
              id="current-password"
              name="password"
              required
              autoComplete="current-password"
            />
          </div>

          {error && <ErrorAlert>{error}</ErrorAlert>}

          <GlowButton
            type="submit"
            magnetic={false}
            disabled={busy}
            className="mt-2 w-full cursor-pointer"
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </GlowButton>

          <p className="text-center text-[14px] leading-relaxed text-[#E4EAE7]/80">
            New here?{' '}
            <a
              href="/signup"
              className="font-medium text-[#00FF87] underline-offset-4 hover:underline"
            >
              Create an account
            </a>
          </p>
        </form>
      ) : (
        <OtpForm
          address={stage.address}
          sent={stage.sent}
          onVerified={(role) => {
            window.location.href = homeFor(role)
          }}
          onExpired={() =>
            backToPassword('That sign-in expired. Enter your password again.')
          }
          back={{ label: 'Use a different account', onClick: () => backToPassword() }}
        />
      )}
    </AuthShell>
  )
}

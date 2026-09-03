import { useState, type FormEvent } from 'react'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { GlowButton, holdDone } from './ui/GlowButton'
import { field, label } from '../lib/fieldStyles'
import { submitLogin } from '../lib/submit'
import { homeFor } from '../lib/api'
import { AuthShell } from './auth/AuthShell'
import { OtpForm } from './auth/OtpForm'
import { PasswordField } from './auth/PasswordField'
import { ErrorAlert } from './auth/FormAlert'

/**
 * Sign-in, for admins and league entrants alike: the server says which by the
 * role it answers with, and the screen goes wherever that role lives.
 *
 * Usually one stage. An address that never answered its signup code is the
 * exception: the password proves the account is theirs, so a fresh code goes
 * out and the confirmation step runs here rather than turning them away. Ten
 * minutes is easy to miss, and signup will not take the address twice, so
 * without this a missed code is an account nobody can reach.
 *
 * Validation is the browser's -- `required` plus `type="email"` covers every
 * rule a client is entitled to have an opinion about, and the only other
 * verdict (do these credentials match) belongs to the server. So no zod schema
 * and no form library here.
 */
type Stage = { name: 'form' } | { name: 'otp'; address: string; sent: boolean }

export function Login() {
  const [stage, setStage] = useState<Stage>({ name: 'form' })
  const [busy, setBusy] = useState(false)
  // Held on the button while the tick reads, before the page moves on.
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // Read before the await: currentTarget is null once the handler yields.
    const data = new FormData(e.currentTarget)
    const address = String(data.get('email') ?? '')

    setBusy(true)
    setError(null)
    const res = await submitLogin(address, String(data.get('password') ?? ''))
    setBusy(false)

    if (!res.ok) {
      setError(res.error)
      return
    }

    // The password was right but the address was never confirmed. A code is on
    // its way (or one from moments ago is still live, which `sent` says), and
    // the session waits on it.
    if (res.stage === 'otp') {
      setStage({ name: 'otp', address, sent: res.sent })
      return
    }

    // Full navigation rather than a client-side swap: the panel is a separate
    // chunk and the session cookie has just changed.
    setDone(true)
    await holdDone()
    window.location.href = homeFor(res.role)
  }

  return (
    <AuthShell
      eyebrow="Sign in"
      wide={stage.name === 'otp'}
      title={
        stage.name === 'otp' ? (
          <>
            Confirm your <span className="text-[#00FF87] text-glow">email</span>
          </>
        ) : (
          <>
            Back to the <span className="text-[#00FF87] text-glow">board</span>
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
      {stage.name === 'form' && (
        <form onSubmit={onSubmit} className="relative space-y-5">
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

          <p className="-mt-1 text-right text-[14px]">
            <a
              href="/forgot-password"
              className="text-[#E4EAE7]/70 underline-offset-4 transition-colors duration-200 hover:text-[#00FF87] hover:underline"
            >
              Forgot your password?
            </a>
          </p>

          {error && <ErrorAlert>{error}</ErrorAlert>}

          <GlowButton
            type="submit"
            magnetic={false}
            icon={<ArrowRight className="size-4" />}
            state={done ? 'done' : busy ? 'busy' : 'idle'}
            doneLabel="Signed in"
            className="mt-2 w-full cursor-pointer"
          >
            Sign in
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
      )}

      {stage.name === 'otp' && (
        <OtpForm
          address={stage.address}
          sent={stage.sent}
          onVerified={(role) => {
            window.location.href = homeFor(role)
          }}
          // Unlike signup, this screen can start the whole thing over: the
          // password is the way back to a new code, so a lapsed pending cookie
          // costs one more sign-in and nothing else.
          onExpired={() => {
            setStage({ name: 'form' })
            setError('That took a while. Sign in again for a fresh code.')
          }}
          back={{
            label: 'Use a different account',
            onClick: () => {
              setError(null)
              setStage({ name: 'form' })
            },
          }}
        />
      )}
    </AuthShell>
  )
}

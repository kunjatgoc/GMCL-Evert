import { useState, type FormEvent } from 'react'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { GlowButton, holdDone } from './ui/GlowButton'
import { field, label } from '../lib/fieldStyles'
import { COUNTRIES } from '../lib/countries'
import { submitLogin, type LoginId } from '../lib/submit'
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

/** Which field the form is asking for. `users` has a unique index on each, so
 *  either one finds the account; this only decides which to show. */
type By = 'email' | 'phone'

export function Login() {
  const [stage, setStage] = useState<Stage>({ name: 'form' })
  const [by, setBy] = useState<By>('email')
  const [busy, setBusy] = useState(false)
  // Held on the button while the tick reads, before the page moves on.
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // Read before the await: currentTarget is null once the handler yields.
    const data = new FormData(e.currentTarget)
    const address = String(data.get('email') ?? '')
    const id: LoginId =
      by === 'email'
        ? { email: address }
        : {
            phone: String(data.get('phone') ?? ''),
            country: String(data.get('country') ?? ''),
          }

    setBusy(true)
    setError(null)
    const res = await submitLogin(id, String(data.get('password') ?? ''))
    setBusy(false)

    if (!res.ok) {
      setError(res.error)
      return
    }

    // The password was right but the address was never confirmed. A code is on
    // its way (or one from moments ago is still live, which `sent` says), and
    // the session waits on it.
    if (res.stage === 'otp') {
      // Signing in by phone gives no address to name, so the copy falls back
      // to "your inbox" rather than inventing one.
      setStage({ name: 'otp', address: address || 'your inbox', sent: res.sent })
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
          {/* Two buttons, not a select: two options that swap one field are
              a switch, and a switch you can see both halves of is faster to
              use than one you have to open. */}
          <div
            role="group"
            aria-label="Sign in with"
            className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1"
          >
            {(['email', 'phone'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setBy(option)
                  setError(null)
                }}
                aria-pressed={by === option}
                className={`flex-1 cursor-pointer rounded-lg px-3 py-2 text-[14px] font-medium capitalize transition-colors duration-300 ${
                  by === option
                    ? 'bg-[rgba(0,255,135,0.12)] text-[#00FF87]'
                    : 'text-[#E4EAE7]/70 hover:text-white'
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          {by === 'email' ? (
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
          ) : (
            <div>
              <label className={label} htmlFor="phone">
                Phone number
              </label>
              {/* The same country + national number pair the signup form uses,
                  because the number has to normalise to the E.164 string that
                  form stored or the unique index never matches. */}
              <div className="flex gap-2.5">
                <select
                  name="country"
                  defaultValue="IN"
                  aria-label="Country dialling code"
                  className={`${field} w-[7.75rem] shrink-0 cursor-pointer appearance-none pr-2`}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code} className="bg-[#121212]">
                      {c.flag} {c.dial}
                    </option>
                  ))}
                </select>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  inputMode="tel"
                  autoComplete="tel-national"
                  autoFocus
                  placeholder="98765 43210"
                  className={`${field} min-w-0 flex-1`}
                />
              </div>
            </div>
          )}

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

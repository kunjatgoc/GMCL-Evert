import { useState, type FormEvent } from 'react'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { GlowButton, holdDone } from './ui/GlowButton'
import { field, label } from '../lib/fieldStyles'
import { submitLogin } from '../lib/submit'
import { homeFor } from '../lib/api'
import { AuthShell } from './auth/AuthShell'
import { PasswordField } from './auth/PasswordField'
import { ErrorAlert } from './auth/FormAlert'

/**
 * Sign-in, for admins and league entrants alike: the server says which by the
 * role it answers with, and the screen goes wherever that role lives.
 *
 * One stage, always. The confirmation code belongs to account creation and is
 * asked for on the signup screen; an address that never answered one is
 * refused here with a message pointing at the inbox, not handed a second
 * chance to answer it.
 *
 * Validation is the browser's -- `required` plus `type="email"` covers every
 * rule a client is entitled to have an opinion about, and the only other
 * verdict (do these credentials match) belongs to the server. So no zod schema
 * and no form library here.
 */
export function Login() {
  const [busy, setBusy] = useState(false)
  // Held on the button while the tick reads, before the page moves on.
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // Read before the await: currentTarget is null once the handler yields.
    const data = new FormData(e.currentTarget)

    setBusy(true)
    setError(null)
    const res = await submitLogin(
      String(data.get('email') ?? ''),
      String(data.get('password') ?? '')
    )
    setBusy(false)

    if (!res.ok) {
      setError(res.error)
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
      title={
        <>
          Back to the <span className="text-[#00FF87] text-glow">board</span>
        </>
      }
      footer={
        <>
          <ShieldCheck className="mr-1.5 inline size-4 -translate-y-px text-[#00FF87]" />
          All sign-ins are recorded
        </>
      }
    >
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
    </AuthShell>
  )
}

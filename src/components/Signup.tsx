import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, ArrowRight } from 'lucide-react'
import ShieldCheck from '~icons/tabler/shield-check-filled'
import { GlowButton, holdDone } from './ui/GlowButton'
import { COUNTRIES, signupSchema, type Signup as SignupData } from '../lib/schema'
import { submitSignup } from '../lib/submit'
import { homeFor } from '../lib/api'
import { field, label } from '../lib/fieldStyles'
import { AuthShell } from './auth/AuthShell'
import { OtpForm } from './auth/OtpForm'
import { PasswordField } from './auth/PasswordField'
import { ErrorAlert } from './auth/FormAlert'

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p
      id={id}
      role="alert"
      className="mt-2 flex items-center gap-1.5 text-[13px] text-[#ff6b6b]"
    >
      <AlertCircle className="size-3.5 shrink-0" />
      {message}
    </p>
  )
}

type Stage =
  | { name: 'form' }
  | { name: 'otp'; address: string }
  // The pending cookie lapsed. The account exists by now, so the form is no
  // use -- the password at sign-in is what gets a new code.
  | { name: 'expired' }

/**
 * Account creation, then the confirmation step, then the dashboard.
 *
 * The form is the old registration form plus a password, and it keeps that
 * form's rules: the schema owns them, react-hook-form applies them, and the
 * server checks them again because the endpoint is public.
 */
export function Signup() {
  const [stage, setStage] = useState<Stage>({ name: 'form' })
  const [formError, setFormError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    getValues,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<SignupData>({
    resolver: zodResolver(signupSchema),
    // Leaving a field you never typed in is not a mistake -- it is a person
    // looking at the form. Judge on submit, then correct live from there.
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: { country: 'IN' },
  })

  // A number is only valid against a country, and that rule lives in the
  // schema's superRefine under path ['phone']. reValidateMode only refreshes
  // the field that changed, so switching country would leave a now-wrong
  // number sitting there unflagged -- or a now-correct one still flagged.
  // Only after a submit, so an untouched form stays quiet.
  const country = watch('country')
  useEffect(() => {
    if (isSubmitted && getValues('phone')) trigger('phone')
  }, [country, isSubmitted, getValues, trigger])

  const onSubmit = async (data: SignupData) => {
    setFormError(null)
    const res = await submitSignup(data)
    if (!res.ok) {
      setFormError(res.error)
      return
    }
    setDone(true)
    await holdDone()

    // Codes are bypassed, so the server hands back a session and this goes
    // straight where sign-in goes. The 'otp' branch below is still wired and
    // still correct -- it is what runs again the moment OTP_REQUIRED is on.
    if (res.stage === 'otp') {
      setStage({ name: 'otp', address: data.email })
      return
    }

    // Full navigation rather than a client-side swap: the panel is a separate
    // chunk and the session cookie has just changed.
    window.location.href = homeFor(res.role)
  }

  const title =
    stage.name === 'form' ? (
      <>
        Create your <span className="text-[#00FF87] text-glow">account</span>
      </>
    ) : stage.name === 'otp' ? (
      <>
        Confirm your <span className="text-[#00FF87] text-glow">email</span>
      </>
    ) : (
      <>
        Your code <span className="text-[#00FF87] text-glow">expired</span>
      </>
    )

  return (
    <AuthShell
      eyebrow="Sign up"
      title={title}
      wide
      footer={
        <>
          <ShieldCheck className="mr-1.5 inline size-4 -translate-y-px text-[#00FF87]" />
          Free to join. No deposit. No card needed.
        </>
      }
    >
      {stage.name === 'form' && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          onChange={() => formError && setFormError(null)}
          noValidate
          className="relative space-y-5"
        >
          <div>
            <label className={label} htmlFor="fullName">
              Full name
            </label>
            <input
              id="fullName"
              autoComplete="name"
              autoFocus
              placeholder="Arjun Sharma"
              aria-invalid={!!errors.fullName}
              aria-describedby={errors.fullName ? 'fullName-error' : undefined}
              className={`${field} w-full`}
              {...register('fullName')}
            />
            <FieldError id="fullName-error" message={errors.fullName?.message} />
          </div>

          <div>
            <label className={label} htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              className={`${field} w-full`}
              {...register('email')}
            />
            <FieldError id="email-error" message={errors.email?.message} />
          </div>

          <div>
            <label className={label} htmlFor="phone">
              Phone number
            </label>
            <div className="flex gap-2.5">
              <select
                aria-label="Country dialling code"
                className={`${field} w-[7.75rem] shrink-0 cursor-pointer appearance-none pr-2`}
                {...register('country')}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code} className="bg-[#121212]">
                    {c.flag} {c.dial}
                  </option>
                ))}
              </select>
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="98765 43210"
                aria-invalid={!!errors.phone}
                aria-describedby={errors.phone ? 'phone-error' : undefined}
                className={`${field} min-w-0 flex-1`}
                {...register('phone')}
              />
            </div>
            <FieldError id="phone-error" message={errors.phone?.message} />
          </div>

          <div>
            <label className={label} htmlFor="new-password">
              Password
            </label>
            <PasswordField
              id="new-password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
              {...register('password')}
            />
            <FieldError id="password-error" message={errors.password?.message} />
          </div>

          {formError && <ErrorAlert>{formError}</ErrorAlert>}

          <GlowButton
            type="submit"
            magnetic={false}
            icon={<ArrowRight className="size-4" />}
            state={done ? 'done' : isSubmitting ? 'busy' : 'idle'}
            doneLabel="Account created"
            className="mt-2 w-full cursor-pointer"
          >
            Create account
          </GlowButton>

          <p className="text-center text-[13px] leading-relaxed text-[#E4EAE7]/80">
            Already have an account?{' '}
            <a
              href="/login"
              className="font-medium text-[#00FF87] underline-offset-4 hover:underline"
            >
              Sign in
            </a>
          </p>
        </form>
      )}

      {stage.name === 'otp' && (
        <OtpForm
          address={stage.address}
          sent
          submitLabel="Confirm and continue"
          onVerified={(role) => {
            window.location.href = homeFor(role)
          }}
          onExpired={() => setStage({ name: 'expired' })}
          // The account already exists, so the form is not the way back.
          back={{
            label: 'Sign in instead',
            onClick: () => {
              window.location.href = '/login'
            },
          }}
        />
      )}

      {stage.name === 'expired' && (
        <div className="relative space-y-5 text-center">
          <p className="text-[14.5px] leading-relaxed text-[#E4EAE7]">
            Your account is saved, but your code expired. Sign in with your
            password and we will send you a new code.
          </p>
          <GlowButton
            href="/login"
            magnetic={false}
            icon={<ArrowRight className="size-4" />}
            className="w-full"
          >
            Sign in
          </GlowButton>
        </div>
      )}
    </AuthShell>
  )
}

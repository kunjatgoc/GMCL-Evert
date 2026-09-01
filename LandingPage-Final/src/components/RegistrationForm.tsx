import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion, AnimatePresence } from 'motion/react'
import { AlertCircle, Check, Loader2 } from 'lucide-react'
import { GlowButton } from './ui/GlowButton'
import { Eyebrow } from './ui/Eyebrow'
import { RealMoneyCta } from './RealMoneyCta'
import { COUNTRIES, registrationSchema, type Registration } from '../lib/schema'
import { submitRegistration } from '../lib/submit'
import { EASE } from '../lib/motion'

// No width here on purpose. These inputs sit in both block and flex
// contexts, and a baked-in `w-full` makes two flex siblings each claim the
// full row, overflowing the card.
const field =
  'rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-[16px] text-white ' +
  'placeholder:text-white/30 outline-none transition-all duration-300 ' +
  'focus:border-[rgba(0,255,135,0.55)] focus:bg-white/[0.05] ' +
  'focus:shadow-[0_0_0_4px_rgba(0,255,135,0.12)]'

const label =
  'mb-2 block text-[12px] font-semibold uppercase tracking-[0.16em] text-[#E4EAE7]'

function FieldError({ id, message }: { id: string; message?: string }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p
          id={id}
          role="alert"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="mt-2 flex items-center gap-1.5 text-[14px] text-[#ff6b6b]"
        >
          <AlertCircle className="size-3.5 shrink-0" />
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  )
}

export function RegistrationForm() {
  const [done, setDone] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    getValues,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<Registration>({
    resolver: zodResolver(registrationSchema),
    // Leaving a field you never typed in is not a mistake  it is a person
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

  const onSubmit = async (data: Registration) => {
    setFormError(null)
    const res = await submitRegistration(data)
    if (res.ok) setDone(true)
    else setFormError(res.error)
  }

  return (
    <section
      id="register"
      className="relative scroll-mt-8 overflow-hidden px-6 pb-28 pt-20 sm:pb-36 sm:pt-24"
      aria-labelledby="register-heading"
    >
      {/* `screen` drops the black the generator baked behind the points. The
          mask is INVERTED  clear through the middle  so the field surrounds
          the form instead of settling on top of the inputs. */}
      <img
        src="/img/particles.webp"
        alt=""
        aria-hidden
        loading="lazy"
        className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover opacity-30 mix-blend-screen [mask-image:radial-gradient(58%_54%_at_50%_50%,transparent_0%,transparent_42%,#000_88%)]"
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[38rem] [background:radial-gradient(70%_60%_at_50%_100%,rgba(0,255,135,0.14),transparent_70%)]"
      />

      {/* Centred. Not `.shell`  its max-width is declared after Tailwind's
          and would override the measure and stretch the card full-bleed. */}
      <div className="mx-auto max-w-2xl">
        <header className="text-center">
          <Eyebrow>Entries close 6 September</Eyebrow>
          <h2
            id="register-heading"
            className="mt-6 text-[clamp(2.1rem,5.2vw,3.4rem)] font-bold leading-[1.05]"
          >
            Join the League <span className="text-[#00FF87]">Now</span>
          </h2>
        </header>

        <div className="glass glass-lip relative mt-12 overflow-hidden rounded-3xl p-8 sm:p-11">
          <AnimatePresence mode="wait" initial={false}>
            {done ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: EASE }}
                className="flex flex-col items-center py-10 text-center"
                role="status"
                aria-live="polite"
              >
                <span className="relative flex size-16 items-center justify-center rounded-full border border-[rgba(0,255,135,0.4)] bg-[rgba(0,255,135,0.1)]">
                  <span
                    aria-hidden
                    className="absolute inset-0 animate-ping rounded-full border border-[#00FF87] opacity-40"
                  />
                  <Check className="size-7 text-[#00FF87]" />
                </span>
                <h3 className="mt-6 text-2xl font-bold">You are in.</h3>
                <p className="mt-3 max-w-sm text-[1rem] leading-relaxed text-[#E4EAE7]">
                  Your entry is recorded. newera Broker will email your league
                  credentials and the rule sheet before the board opens on
                  7 September.
                </p>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                onSubmit={handleSubmit(onSubmit)}
                onChange={() => formError && setFormError(null)}
                noValidate
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="space-y-5"
              >
                <div>
                  <label className={label} htmlFor="fullName">
                    Full name
                  </label>
                  <input
                    id="fullName"
                    autoComplete="name"
                    placeholder="Alex Mercer"
                    aria-invalid={!!errors.fullName}
                    aria-describedby={
                      errors.fullName ? 'fullName-error' : undefined
                    }
                    className={`${field} w-full`}
                    {...register('fullName')}
                  />
                  <FieldError
                    id="fullName-error"
                    message={errors.fullName?.message}
                  />
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
                    aria-describedby={
                      errors.email ? 'email-error' : undefined
                    }
                    className={`${field} w-full`}
                    {...register('email')}
                  />
                  <FieldError
                    id="email-error"
                    message={errors.email?.message}
                  />
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
                    aria-describedby={
                      errors.phone ? 'phone-error' : undefined
                    }
                      className={`${field} min-w-0 flex-1`}
                      {...register('phone')}
                    />
                  </div>
                  <FieldError
                    id="phone-error"
                    message={errors.phone?.message}
                  />
                </div>


                {formError && (
                  <p
                    role="alert"
                    className="flex items-center gap-2 rounded-xl border border-[#ff6b6b]/30 bg-[#ff6b6b]/10 px-4 py-3 text-[15px] text-[#ff9a9a]"
                  >
                    <AlertCircle className="size-4 shrink-0" />
                    {formError}
                  </p>
                )}

                <GlowButton
                  type="submit"
                  magnetic={false}
                  disabled={isSubmitting}
                  className="mt-2 w-full"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Registering…
                    </>
                  ) : (
                    'Register Now'
                  )}
                </GlowButton>

                <p className="pt-1 text-center text-[13.5px] leading-relaxed text-[#E4EAE7]/80">
                  Demo capital only. No deposit, no payment details, no risk to
                  your own funds.
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>

      <RealMoneyCta />
    </section>
  )
}

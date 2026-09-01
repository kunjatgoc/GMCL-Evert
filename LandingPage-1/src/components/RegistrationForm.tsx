import { useLayoutEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion, AnimatePresence } from 'motion/react'
import { AlertCircle, Check, Loader2 } from 'lucide-react'
import { Countdown } from './Countdown'
import { LumenCta } from '../threeui/LumenCta'
import { Eyebrow } from './ui/Eyebrow'
import { COUNTRIES, registrationSchema, type Registration } from '../lib/schema'
import { submitRegistration } from '../lib/submit'
import { EASE } from '../lib/motion'
import { parallax, scrollScene } from '../lib/scrollScene'

// No width here on purpose. These inputs sit in both block and flex
// contexts, and a baked-in `w-full` makes two flex siblings each claim the
// full row, overflowing the card.
const field =
  'rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-body text-white ' +
  'placeholder:text-white/30 outline-none transition-all duration-300 ' +
  'focus:border-[rgba(0,255,135,0.55)] focus:bg-white/[0.05] ' +
  'focus:shadow-[0_0_0_4px_rgba(0,255,135,0.12)]'

const label = 'mb-2.5 block text-micro font-semibold uppercase text-muted'

/** What the entrant is actually agreeing to. Stated beside the form rather
 *  than under it, so the fields never sit alone in the middle of the page. */
const TERMS = [
  'A $10,000 USD demo account, funded before the board opens.',
  'Twelve trading days, 7 to 18 September, same feed for everyone.',
  'No deposit, no card, no risk to money you already have.',
  'Credentials and the rule sheet by email before the 7th.',
]

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
          className="mt-2 flex items-center gap-1.5 text-small text-[#ff6b6b]"
        >
          <AlertCircle className="size-3.5 shrink-0" />
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  )
}

export function RegistrationForm() {
  const root = useRef<HTMLElement>(null)
  const card = useRef<HTMLDivElement>(null)

  // The card trails the column beside it, so the two halves arrive out of
  // step rather than as one slab.
  useLayoutEffect(
    () =>
      scrollScene(root.current, () =>
        parallax(card.current, { yPercent: -7 }, root.current!),
      ),
    [],
  )

  const [done, setDone] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Registration>({
    resolver: zodResolver(registrationSchema),
    // Leaving a field you never typed in is not a mistake -- it is a person
    // looking at the form. Judge on submit, then correct live from there.
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    // `accountType` has to start as '' here, not as a defaultValue on the
    // <select>: the field is registered, so react-hook-form owns the value
    // and the element's own attribute never reaches form state.
    defaultValues: {
      country: 'IN',
      accountType: '' as unknown as Registration['accountType'],
    },
  })

  const onSubmit = async (data: Registration) => {
    setFormError(null)
    const res = await submitRegistration(data)
    if (res.ok) setDone(true)
    else setFormError(res.error)
  }

  return (
    <section
      ref={root}
      id="register"
      className="relative scroll-mt-8 overflow-hidden px-6 pb-28 pt-24 sm:pb-36 sm:pt-32 xl:px-20 2xl:px-28"
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

      <div className="shell grid items-start gap-12 lg:grid-cols-12 lg:gap-16">
        <header className="lg:col-span-6 lg:sticky lg:top-24">
          <div data-reveal>
            <Eyebrow>Entries close 6 September</Eyebrow>
          </div>
          <h2
            id="register-heading"
            data-reveal="0.06"
            className="mt-6 text-[clamp(1.9rem,2.95vw,3.9rem)] leading-[1.04] lg:whitespace-nowrap"
          >
            Join the League <span className="text-[#00FF87]">Now</span>
          </h2>

          <ul data-reveal="0.12" className="mt-9 space-y-4">
            {TERMS.map((t) => (
              <li key={t} className="flex items-start gap-3.5 text-body text-muted">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-[rgba(0,255,135,0.28)] bg-[rgba(0,255,135,0.09)]">
                  <Check className="size-3.5 text-[#00FF87]" strokeWidth={3} />
                </span>
                <span className="pt-px">{t}</span>
              </li>
            ))}
          </ul>

          <div data-reveal="0.18" className="mt-10 max-w-xs">
            <p className="text-nano font-semibold uppercase text-muted">
              Time left to enter
            </p>
            <Countdown className="mt-2.5" />
          </div>
        </header>

        <div
          ref={card}
          className="glass glass-lip relative w-full overflow-hidden rounded-3xl p-8 sm:p-10 lg:col-span-5 lg:col-start-7"
        >
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
                <h3 className="mt-6 text-h3 font-bold">You are in.</h3>
                <p className="mt-3 max-w-sm text-body text-muted">
                  Your entry is recorded. NewEra Broker will email your league
                  credentials and the rule sheet before the board opens on 7
                  September.
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
                className="space-y-7"
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
                    aria-describedby={errors.email ? 'email-error' : undefined}
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
                    Mobile
                  </label>
                  <div className="flex gap-2.5">
                    <select
                      aria-label="Country dialling code"
                      className={`${field} w-[7.75rem] shrink-0 cursor-pointer appearance-none pr-2`}
                      {...register('country')}
                    >
                      {COUNTRIES.map((c) => (
                        <option
                          key={c.code}
                          value={c.code}
                          className="bg-[#121212]"
                        >
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

                <div>
                  <label className={label} htmlFor="accountType">
                    Account type
                  </label>
                  <select
                    id="accountType"
                    aria-invalid={!!errors.accountType}
                    aria-describedby={
                      errors.accountType ? 'accountType-error' : undefined
                    }
                    className={`${field} w-full cursor-pointer appearance-none`}
                    {...register('accountType')}
                  >
                    <option value="" disabled className="bg-[#121212]">
                      Select an account type
                    </option>
                    <option value="demo" className="bg-[#121212]">
                      Demo
                    </option>
                    <option value="real" className="bg-[#121212]">
                      Real
                    </option>
                    <option value="both" className="bg-[#121212]">
                      Both
                    </option>
                  </select>
                  <FieldError
                    id="accountType-error"
                    message={errors.accountType?.message}
                  />
                </div>

                {formError && (
                  <p
                    role="alert"
                    className="flex items-center gap-2 rounded-xl border border-[#ff6b6b]/30 bg-[#ff6b6b]/10 px-4 py-3 text-small text-[#ff9a9a]"
                  >
                    <AlertCircle className="size-4 shrink-0" />
                    {formError}
                  </p>
                )}

                <LumenCta
                  type="submit"
                  disabled={isSubmitting}
                  className="lumen-cta--block mt-3"
                  label={
                    isSubmitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Registering…
                      </>
                    ) : (
                      'Register Now'
                    )
                  }
                />

                <p className="pt-2 text-center text-small text-muted/80">
                  Demo capital only. No deposit, no payment details, no risk to
                  your own funds.
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}

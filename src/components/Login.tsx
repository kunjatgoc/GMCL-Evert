import { useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import { AlertCircle, ArrowLeft, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'
import { GlowButton } from './ui/GlowButton'
import { Eyebrow } from './ui/Eyebrow'
import { field, label } from '../lib/fieldStyles'
import { submitLogin } from '../lib/submit'
import { EASE, depthIn } from '../lib/motion'

/**
 * Member sign-in.
 *
 * Wears the hero's backdrop -- same skyline plate, same drift, same horizon
 * bloom -- so the screen reads as part of the event rather than a bolted-on
 * auth page. Nothing new was generated for it.
 *
 * Deliberately has no nav, no marquee and no route out to registration: this
 * screen does one thing. Validation is the browser's -- `required` plus
 * `type="email"` covers every rule a client is entitled to have an opinion
 * about, and the only other verdict (do these credentials match) belongs to
 * the server. So no zod schema and no form library here.
 */
export function Login() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reveal, setReveal] = useState(false)

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

    // ponytail: no gated area exists yet, so success lands back on the event
    // page. One string to change when there is somewhere to go.
    if (res.ok) window.location.href = '/'
    else setError(res.error)
  }

  return (
    <main className="grain relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-16">
      {/* The hero's plate, unchanged. Portrait crop on phones for the same
          reason it exists there: cover-cropping the landscape frame pushes the
          towers off the canvas. */}
      <div aria-hidden className="absolute inset-0 -z-20">
        <picture className="block h-full w-full [animation:hero-drift_30s_ease-in-out_infinite_alternate]">
          <source media="(max-width: 768px)" srcSet="/img/hero-plate-mobile.webp" />
          <img
            src="/img/hero-plate.webp"
            alt=""
            fetchPriority="high"
            className="h-full w-full object-cover object-center opacity-90"
          />
        </picture>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] [animation:horizon-glow_9s_ease-in-out_infinite] [background:radial-gradient(70%_60%_at_50%_92%,rgba(0,255,135,0.2),transparent_68%)]" />
      </div>

      {/* Legibility scrim. Centred rather than left-anchored like the hero's,
          because the card sits in the middle: darkest exactly under the
          inputs, thinning outward so the skyline still reads at the edges. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [background:radial-gradient(58%_52%_at_50%_50%,rgba(10,10,10,0.95)_0%,rgba(10,10,10,0.82)_58%,rgba(10,10,10,0.42)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-[#0a0a0a] to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-[#0a0a0a] to-transparent"
      />

      <motion.a
        href="/"
        aria-label="Back to the event page"
        className="group absolute left-5 top-5 z-20 inline-flex h-12 items-center rounded-full border border-white/10 bg-white/[0.04] px-3.5 text-[#E4EAE7] backdrop-blur-md transition-colors duration-300 hover:border-[rgba(0,255,135,0.4)] hover:bg-white/[0.07] hover:text-white sm:left-8 sm:top-8 sm:h-14 sm:px-4"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
      >
        <ArrowLeft
          aria-hidden
          className="size-5 shrink-0 transition-transform duration-300 group-hover:-translate-x-0.5 sm:size-6"
        />
        {/* max-width rather than width: `auto` is not an animatable length. */}
        <span
          aria-hidden
          className="max-w-0 overflow-hidden whitespace-nowrap text-[14px] font-medium opacity-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:max-w-[9rem] group-hover:pl-2.5 group-hover:opacity-100 group-focus-visible:max-w-[9rem] group-focus-visible:pl-2.5 group-focus-visible:opacity-100"
        >
          Event page
        </span>
      </motion.a>

      {/* depthIn rotates on X, which is inert without a perspective ancestor. */}
      <div className="relative z-10 w-full max-w-md [perspective:1200px]">
        <header className="text-center">
          {/* Lockup, not a link: the back control above already owns the trip
              home, and two routes to the same place is one too many. */}
          <motion.div
            className="inline-flex items-center gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <span
              aria-hidden
              className="grid size-10 shrink-0 place-items-center rounded-xl border border-[rgba(0,255,135,0.3)] bg-[rgba(0,255,135,0.07)] text-[12px] font-bold tracking-tight text-[#00FF87] shadow-[0_0_30px_-8px_rgba(0,255,135,0.75),inset_0_1px_0_0_rgba(255,255,255,0.08)]"
            >
              GML
            </span>
            <span className="text-left leading-none">
              <span className="block font-[family-name:var(--font-display)] text-[16px] font-bold tracking-tight text-white">
                Global Market League
              </span>
              {/* Same credit the footer carries, so the two agree. */}
              <span className="mt-1.5 block text-[10px] uppercase tracking-[0.2em] text-[#E4EAE7]/55">
                Associated with newera
              </span>
            </span>
          </motion.div>

          <motion.div
            className="mt-6"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
          >
            <Eyebrow>Registered traders</Eyebrow>
          </motion.div>

          {/* The hero's masked reveal: the line rises out from behind a hard
              clip rather than fading in. */}
          <h1 className="mt-6 text-balance text-[clamp(2rem,7vw,2.85rem)] font-bold leading-[1.05]">
            <span className="block overflow-hidden pb-[0.12em]">
              <motion.span
                className="block"
                initial={{ y: '110%' }}
                animate={{ y: '0%' }}
                transition={{ duration: 1.05, ease: EASE, delay: 0.22 }}
              >
                Back to the{' '}
                <span className="text-[#00FF87] text-glow">board</span>
              </motion.span>
            </span>
          </h1>
        </header>

        <motion.div
          className="glass glass-lip relative mt-9 overflow-hidden rounded-3xl p-7 sm:p-9"
          variants={depthIn}
          custom={3}
          initial="hidden"
          animate="show"
        >
          {/* Faint mesh over the glass, same texture the prize cards use. Kept
              low so the type stays the brightest thing on the card. */}
          <img
            src="/img/card-texture.webp"
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.13] mix-blend-screen"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />

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
              <label className={label} htmlFor="password">
                Password
              </label>
              {/* The toggle sits inside the field's box, so the padding-right
                  keeps typed text from running under it. */}
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={reveal ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={`${field} w-full pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setReveal((v) => !v)}
                  aria-label={reveal ? 'Hide password' : 'Show password'}
                  aria-pressed={reveal}
                  className="absolute inset-y-0 right-0 grid w-12 place-items-center text-white/45 transition-colors duration-200 hover:text-white"
                >
                  {reveal ? (
                    <EyeOff className="size-[18px]" />
                  ) : (
                    <Eye className="size-[18px]" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="flex items-center gap-2 rounded-xl border border-[#ff6b6b]/30 bg-[#ff6b6b]/10 px-4 py-3 text-[15px] text-[#ff9a9a]"
              >
                <AlertCircle className="size-4 shrink-0" />
                {error}
              </p>
            )}

            <GlowButton
              type="submit"
              magnetic={false}
              disabled={busy}
              className="mt-2 w-full"
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
          </form>
        </motion.div>

        <motion.p
          className="mt-8 text-center text-[13.5px] leading-relaxed text-[#E4EAE7]/75 [text-shadow:0_1px_10px_rgba(0,0,0,0.9)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.9 }}
        >
          <ShieldCheck className="mr-1.5 inline size-4 -translate-y-px text-[#00FF87]" />
          Demo accounts only · No real capital is traded
        </motion.p>
      </div>
    </main>
  )
}

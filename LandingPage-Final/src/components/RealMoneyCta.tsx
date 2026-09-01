import { useEffect, useState, type FormEvent } from 'react'
import { Check, Mail } from 'lucide-react'
import { SectionReveal } from './ui/SectionReveal'
import { scrollToId } from '../lib/scroll'
import { realAccountSchema } from '../lib/schema'
import { submitRealAccount } from '../lib/submit'

const ANCHOR = 'realaccount'

type Status = 'idle' | 'sending' | 'done'

/**
 * Wide, short companion to the registration card: the one path for entrants
 * who want a live balance rather than demo capital. Deliberately landscape and
 * a size wider than the form, so it reads as an aside to the offer above it
 * rather than a second competing form.
 *
 * Darker than the glass around it on purpose -- it sits directly under the
 * form and would otherwise read as a second panel of the same card.
 */
export function RealMoneyCta() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')

  // The section is lazy-loaded, so by the time this mounts the browser has
  // long since given up on /#realaccount -- the element did not exist when it
  // parsed the hash. Do the jump ourselves, through Lenis when it is driving.
  useEffect(() => {
    if (window.location.hash !== `#${ANCHOR}`) return
    const id = requestAnimationFrame(() => {
      // The card is the last thing on the page, so landing it at the top edge
      // leaves it stranded against the footer. Centre it in the viewport
      // instead -- it is short, and this is the only thing the link is for.
      const el = document.getElementById(ANCHOR)
      const gap = el ? (window.innerHeight - el.offsetHeight) / 2 : 0
      scrollToId(ANCHOR, -Math.max(24, gap))
    })
    return () => cancelAnimationFrame(id)
  }, [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (status === 'sending') return

    // Same address rule the league entry uses, so one form cannot accept what
    // the other rejects.
    const parsed = realAccountSchema.safeParse({ email })
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }

    setError('')
    setStatus('sending')
    const result = await submitRealAccount(parsed.data.email)

    if (result.ok) {
      setStatus('done')
      return
    }
    setStatus('idle')
    setError(result.error)
  }

  return (
    <SectionReveal className="mx-auto mt-10 max-w-5xl">
      <div
        id={ANCHOR}
        className="glass-lip relative flex scroll-mt-24 flex-col items-start gap-5 overflow-hidden rounded-3xl border border-white/10 bg-[#050D09]/95 px-7 py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-10 sm:px-10 sm:py-6"
      >
        <div>
          <p className="text-[1.2rem] font-semibold leading-snug text-white">
            Do you want to start with real money?
          </p>
          <p className="mt-1.5 text-[16px] leading-relaxed text-white/90">
            Ask for a MetaID with a real balance. Leave your email and we will
            facilitate the same.
          </p>
        </div>

        {status === 'done' ? (
          <p className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-[rgba(0,255,135,0.35)] bg-[rgba(0,255,135,0.08)] px-6 py-3 text-[15.5px] font-semibold text-[#00FF87]">
            <Check className="size-4" aria-hidden />
            We will email you shortly.
          </p>
        ) : (
          <form
            onSubmit={onSubmit}
            noValidate
            className="flex w-full shrink-0 flex-col gap-2 sm:w-auto"
          >
            <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-center">
              <label htmlFor="real-account-email" className="sr-only">
                Email address
              </label>
              <div className="relative sm:w-[19rem]">
                <Mail
                  className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#00FF87]"
                  aria-hidden
                />
                <input
                  id="real-account-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'real-account-error' : undefined}
                  className="w-full rounded-full border border-white/12 bg-white/[0.04] py-3 pl-11 pr-4 text-[15.5px] text-white placeholder:text-white/35 outline-none transition-colors duration-300 focus:border-[rgba(0,255,135,0.5)]"
                />
              </div>

              <button
                type="submit"
                disabled={status === 'sending'}
                className="shrink-0 rounded-full bg-[linear-gradient(180deg,#5cffb4_0%,#00ff87_38%,#00c853_100%)] px-7 py-3 text-[15.5px] font-semibold tracking-tight text-black shadow-[0_10px_40px_-8px_rgba(0,255,135,0.45)] transition-[filter,opacity] duration-300 hover:brightness-110 disabled:pointer-events-none disabled:opacity-55"
              >
                {status === 'sending' ? 'Sending…' : 'Request'}
              </button>
            </div>

            {error && (
              <p
                id="real-account-error"
                role="alert"
                className="px-1 text-[13.5px] text-[#ff8f8f]"
              >
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </SectionReveal>
  )
}

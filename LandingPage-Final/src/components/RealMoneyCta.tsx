import { useEffect } from 'react'
import { Mail } from 'lucide-react'
import { SectionReveal } from './ui/SectionReveal'
import { scrollToId } from '../lib/scroll'

const EMAIL = 'support@playgml.com'
const ANCHOR = 'realaccount'

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
  // The section is lazy-loaded, so by the time this mounts the browser has
  // long since given up on /#realaccount -- the element did not exist when it
  // parsed the hash. Do the jump ourselves, through Lenis when it is driving.
  useEffect(() => {
    if (window.location.hash !== `#${ANCHOR}`) return
    const id = requestAnimationFrame(() => scrollToId(ANCHOR))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <SectionReveal className="mx-auto mt-10 max-w-5xl">
      <div
        id={ANCHOR}
        className="glass-lip relative flex scroll-mt-24 flex-col items-start gap-4 overflow-hidden rounded-3xl border border-white/10 bg-[#050D09]/95 px-7 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-10 sm:px-10 sm:py-5"
      >
        <div>
          <p className="text-[1.2rem] font-semibold leading-snug text-white">
            Do you want to start with real money?
          </p>
          <p className="mt-1.5 text-[16px] leading-relaxed text-white/90">
            Ask for a MetaID with a real balance. Email us and we will
            facilitate the same.
          </p>
        </div>

        <a
          href={`mailto:${EMAIL}`}
          className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-[rgba(0,255,135,0.28)] bg-white/[0.03] px-7 py-3 text-[16px] font-semibold tracking-tight text-white transition-[background-color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-[rgba(0,255,135,0.5)] hover:bg-white/[0.07]"
        >
          <Mail className="size-4 text-[#00FF87]" aria-hidden />
          {EMAIL}
        </a>
      </div>
    </SectionReveal>
  )
}

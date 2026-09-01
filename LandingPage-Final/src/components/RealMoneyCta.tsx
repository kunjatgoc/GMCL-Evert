import { Mail } from 'lucide-react'
import { SectionReveal } from './ui/SectionReveal'

const EMAIL = 'support@playgml.com'

/**
 * Wide, short companion to the registration card: the one path for entrants
 * who want a live balance rather than demo capital. Deliberately landscape and
 * a size wider than the form, so it reads as an aside to the offer above it
 * rather than a second competing form.
 */
export function RealMoneyCta() {
  return (
    <SectionReveal className="mx-auto mt-10 max-w-3xl">
      <div className="glass glass-lip relative flex flex-col items-start gap-5 overflow-hidden rounded-3xl px-7 py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-9 sm:py-7">
        <div>
          <p className="text-[1.05rem] font-semibold leading-snug text-white">
            Do you want to start with real money?
          </p>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-[#E4EAE7]/75">
            Ask for a MetaID with a real balance. Email us and we will
            facilitate the same.
          </p>
        </div>

        <a
          href={`mailto:${EMAIL}`}
          className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-[rgba(0,255,135,0.28)] bg-white/[0.03] px-6 py-3 text-[15px] font-semibold tracking-tight text-white transition-[background-color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-[rgba(0,255,135,0.5)] hover:bg-white/[0.07]"
        >
          <Mail className="size-4 text-[#00FF87]" aria-hidden />
          {EMAIL}
        </a>
      </div>
    </SectionReveal>
  )
}

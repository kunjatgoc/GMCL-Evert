import { Mail } from 'lucide-react'

/**
 * The one address, written once.
 *
 * It appears on the landing page, the League screen and the dashboard, and
 * three copies of a mailto is how one of them ends up pointing at an address
 * nobody reads any more.
 */
export const SUPPORT_EMAIL = 'support@playgml.com'

const HREF = `mailto:${SUPPORT_EMAIL}`

/**
 * A card, for the top of a screen. Wide enough to be seen without being the
 * thing you see first: the dashboard's job is to say what to do next, and this
 * sits under that as the answer to "and if I cannot".
 */
export function SupportCard({ className = '' }: { className?: string }) {
  return (
    <a
      href={HREF}
      className={`glass glass-lip group flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[15px] transition-colors duration-300 hover:border-[rgba(62,230,138,0.35)] hover:bg-[rgba(62,230,138,0.06)] ${className}`}
    >
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-xl border border-[rgba(62,230,138,0.3)] bg-[rgba(62,230,138,0.1)] text-[#3EE68A]"
      >
        <Mail className="size-4" />
      </span>
      <span className="text-[#E4EAE7]/75">Need help? Write to</span>
      {/* The address is the point of the card, so it is the one thing in it
          that reads as a link rather than as a sentence. */}
      <span className="font-semibold text-[#3EE68A] underline decoration-[rgba(62,230,138,0.4)] underline-offset-4 group-hover:decoration-[#3EE68A]">
        {SUPPORT_EMAIL}
      </span>
    </a>
  )
}

/**
 * A line, for the foot of a page, where a card would be a second call to
 * action under the real one. Same address, same green, no box.
 */
export function SupportLine({ className = '' }: { className?: string }) {
  return (
    <p className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[14px] ${className}`}>
      <Mail aria-hidden className="size-4 shrink-0 text-[#3EE68A]" />
      <span className="text-[#E4EAE7]/70">Questions? Write to</span>
      <a
        href={HREF}
        className="font-semibold text-[#3EE68A] underline decoration-[rgba(62,230,138,0.4)] underline-offset-4 transition-colors duration-200 hover:decoration-[#3EE68A]"
      >
        {SUPPORT_EMAIL}
      </a>
    </p>
  )
}

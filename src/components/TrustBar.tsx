import { motion } from 'motion/react'
import { BadgeCheck } from 'lucide-react'
import { IconArt } from './ui/IconArt'
import { fadeIn, viewportOnce } from '../lib/motion'

export function TrustBar() {
  return (
    <motion.section
      aria-label="What entering the league costs"
      variants={fadeIn}
      initial="hidden"
      whileInView="show"
      viewport={viewportOnce}
      className="relative border-y border-[rgba(0,255,135,0.14)] bg-[#0d0f0e]/80 backdrop-blur-sm"
    >
      {/* Hairline light bleeding along the top edge. */}
      <div
        aria-hidden
        className="absolute inset-x-0 -top-px h-px bg-[linear-gradient(90deg,transparent,rgba(0,255,135,0.6),transparent)]"
      />

      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-5 text-center sm:flex-row sm:text-left">
        <p className="text-[15px] text-[#E4EAE7]">
          Free to enter. A{' '}
          <span className="font-medium text-white">$10,000 demo account</span>,
          no deposit, and no risk to money you already have.
        </p>

        {/* A credit, not the offer: smaller, unlit and second in the row, so
            the bar leads with what the visitor gets. The supplied logo is a
            wordmark and carries the brand name itself, so setting "newera
            Broker" beside it would print the name twice; IconArt renders its
            image aria-hidden, hence the sr-only name so the line still reads
            correctly aloud. */}
        <p className="inline-flex shrink-0 items-center gap-2 text-[13px] text-[#E4EAE7]/60">
          Associated with
          <IconArt
            src="/img/newera-mark.webp"
            fallback={BadgeCheck}
            className="h-4 w-auto shrink-0 opacity-80"
          />
          <span className="sr-only">newera Broker</span>
        </p>
      </div>
    </motion.section>
  )
}

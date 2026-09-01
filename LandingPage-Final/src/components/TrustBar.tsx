import { motion } from 'motion/react'
import { BadgeCheck } from 'lucide-react'
import { IconArt } from './ui/IconArt'
import { fadeIn, viewportOnce } from '../lib/motion'

export function TrustBar() {
  return (
    <motion.section
      aria-label="Powered by NewEra Broker"
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
        <p className="inline-flex items-center gap-2.5 text-[15px] font-medium tracking-tight text-white">
          <IconArt
            src="/img/newera-mark.webp"
            fallback={BadgeCheck}
            className="h-7 w-auto shrink-0 drop-shadow-[0_0_12px_rgba(0,255,135,0.5)]"
          />
          Powered by <span className="text-[#00FF87]">NewEra Broker</span>
        </p>

        <p className="text-[15px] text-[#E4EAE7]">
          Trade a <span className="font-medium text-white">demo</span> account,
          a <span className="font-medium text-white">real</span> one or both.
          You choose when you register below.
        </p>
      </div>
    </motion.section>
  )
}

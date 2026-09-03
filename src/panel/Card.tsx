import { motion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import { Counter } from '../components/ui/Counter'
import { depthIn } from '../lib/motion'
import { TEXT } from './type'

/**
 * One measured number. Here rather than in the admin dashboard that happened
 * to need the first one: three panels count things now, and a GML staffer
 * should not download the admin's charts to see a tile.
 */
export function Card({
  label,
  value,
  sub,
  icon: Icon,
  index,
  accent = false,
  href,
}: {
  label: string
  value: number
  sub: string
  icon: LucideIcon
  index: number
  /** The one card whose number is green. Rule 2: one green accent per view --
   *  four identical green numbers is four accents, which is none. */
  accent?: boolean
  /** Given, the whole card becomes the link to the rows it counted. A plain
   *  anchor: the destination is a different screen with its own filters, and
   *  it reads them from the URL on mount. */
  href?: string
}) {
  const Root = href ? motion.a : motion.div
  return (
    <Root
      {...(href ? { href } : {})}
      className={`glass glass-lip group relative block overflow-hidden rounded-2xl bg-[var(--admin-card)] p-5 ${
        href
          ? 'cursor-pointer transition-colors duration-300 hover:border-[rgba(62,230,138,0.3)]'
          : ''
      }`}
      variants={depthIn}
      custom={index}
      initial="hidden"
      animate="show"
      // Lifts toward the cursor. A spring rather than a duration, so it
      // settles on the way up and follows the pointer back down.
      whileHover={{ y: -5, transition: { type: 'spring', stiffness: 380, damping: 24 } }}
    >
      {/* Engraved instrument grid, not the prize cards' carbon weave: this
          card holds a measurement, and the surface should say so. */}
      <img
        src="/img/data-texture.webp"
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.22] mix-blend-screen"
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />
      {/* Deep Forest, not Signal Green: the card needs depth in its corner,
          not a second thing glowing next to the number. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-[radial-gradient(circle,rgba(31,92,65,0.55),transparent_70%)] opacity-70 transition-opacity duration-500 group-hover:opacity-100"
      />

      <span className="relative flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04]">
          <Icon className="size-4 text-[var(--admin-muted)]" />
        </span>
        <span className={`${TEXT.label} font-semibold uppercase tracking-[0.1em] text-[var(--admin-muted)]`}>
          {label}
        </span>
      </span>

      <Counter
        to={value}
        className={`${TEXT.display} relative mt-5 block font-bold leading-none ${
          accent ? 'text-[var(--admin-primary)]' : 'text-white'
        }`}
      />
      <p className={`${TEXT.label} relative mt-2.5 text-[var(--admin-muted)]`}>{sub}</p>
    </Root>
  )
}

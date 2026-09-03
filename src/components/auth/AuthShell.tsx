import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { ArrowLeft } from 'lucide-react'
import { Eyebrow } from '../ui/Eyebrow'
import { EASE, depthIn } from '../../lib/motion'

/**
 * The frame every account screen wears -- sign in, sign up, and the
 * dashboard's header borrow its pieces. The hero's backdrop, so the screens
 * read as part of the event rather than a bolted-on auth page; nothing new was
 * generated for them.
 */

/** One shaft of light landing in a dark pool. Deliberately still -- the hero
 *  drifts because it is selling motion, and a door should not. */
export function AuthBackdrop() {
  return (
    <>
      <div aria-hidden className="absolute inset-0 -z-20">
        <img
          src="/img/login-plate.webp"
          alt=""
          fetchPriority="high"
          className="h-full w-full object-cover object-bottom opacity-95"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] [animation:horizon-glow_9s_ease-in-out_infinite] [background:radial-gradient(60%_55%_at_50%_95%,rgba(0,255,135,0.16),transparent_70%)]" />
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-[#0a0a0a] to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-[#0a0a0a] to-transparent"
      />
    </>
  )
}

/** Pill in the top-left corner that grows a label on hover. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <motion.a
      href={href}
      aria-label={label}
      className="group absolute left-5 top-5 z-20 inline-flex h-12 cursor-pointer items-center rounded-full border border-white/10 bg-white/[0.04] px-3.5 text-[#E4EAE7] backdrop-blur-md transition-colors duration-300 hover:border-[rgba(0,255,135,0.4)] hover:bg-white/[0.07] hover:text-white sm:left-8 sm:top-8 sm:h-14 sm:px-4"
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
        {label}
      </span>
    </motion.a>
  )
}

/** Lockup, not a link: wherever it appears, something else already owns the
 *  trip home, and two routes to the same place is one too many. */
export function Lockup() {
  return (
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
        <span className="mt-1.5 block text-[10px] uppercase tracking-[0.2em] text-[#E4EAE7]/75">
          Associated with newera
        </span>
      </span>
    </motion.div>
  )
}

type Props = {
  eyebrow: string
  /** The headline. Wrap the lit word in `text-[#00FF87] text-glow`. */
  title: ReactNode
  children: ReactNode
  /** The quiet line under the card. */
  footer?: ReactNode
  /** The signup form has more fields and wants the extra room. */
  wide?: boolean
}

export function AuthShell({ eyebrow, title, children, footer, wide }: Props) {
  return (
    <main className="grain relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-16">
      <AuthBackdrop />
      <BackLink href="/" label="Event page" />

      {/* depthIn rotates on X, which is inert without a perspective ancestor. */}
      <div
        className={`relative z-10 w-full ${wide ? 'max-w-lg' : 'max-w-md'} [perspective:1200px]`}
      >
        {/* Legibility scrim anchored to the content, not to the frame. The
            plate's brightest ripple lands around a third of the way down, which
            is exactly where the lockup and eyebrow sit -- a frame-centred
            gradient darkens the middle and leaves that header on lit water.
            Pinned to this column, it travels with the type at every height.

            Full-bleed rather than column-width: the ripple runs the whole way
            across, so a scrim that stops at the card's edge leaves a lit band
            either side of the lockup and the header still reads as floating on
            water. It stays soft-edged and lets the pool below the card through,
            which is the part of the plate worth keeping. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[calc(100%+16rem)] w-screen -translate-x-1/2 -translate-y-1/2 [background:radial-gradient(46%_50%_at_50%_50%,rgba(6,9,8,0.97)_0%,rgba(6,9,8,0.93)_42%,rgba(6,9,8,0.7)_70%,transparent_100%)]"
        />

        <header className="text-center">
          <Lockup />

          <motion.div
            className="mt-6"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
          >
            <Eyebrow>{eyebrow}</Eyebrow>
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
                {title}
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
          {children}
        </motion.div>

        {footer && (
          <motion.p
            className="mt-8 text-center text-[13.5px] leading-relaxed text-[#E4EAE7]/75 [text-shadow:0_1px_10px_rgba(0,0,0,0.9)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.9 }}
          >
            {footer}
          </motion.p>
        )}
      </div>
    </main>
  )
}

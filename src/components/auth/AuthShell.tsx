import type { ReactNode } from 'react'
import { motion } from 'motion/react'
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
        className="grid size-12 shrink-0 place-items-center rounded-2xl border border-[rgba(0,255,135,0.45)] bg-[rgba(0,255,135,0.1)] text-[15px] font-extrabold tracking-tight text-[#00FF87] shadow-[0_0_44px_-8px_rgba(0,255,135,0.9),inset_0_1px_0_0_rgba(255,255,255,0.12)]"
      >
        GML
      </span>
      <span className="font-[family-name:var(--font-display)] text-[19px] font-bold leading-none tracking-tight text-white">
        Global Market League
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

      {/* The brand alone, linking home. Every card below already offers the
          other screen in its own copy -- "Already have an account? Sign in" --
          so a second link up here was the same offer twice. */}
      <motion.nav
        className="absolute inset-x-0 top-0 z-20 flex items-center px-5 py-5 sm:px-8"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        <a
          href="/"
          aria-label="Global Market League home"
          className="rounded-2xl outline-none transition-opacity duration-300 hover:opacity-85 focus-visible:ring-2 focus-visible:ring-[#00FF87]/60"
        >
          <Lockup />
        </a>
      </motion.nav>

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
          <motion.div
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

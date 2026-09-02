import { useLayoutEffect, useRef } from 'react'
import { motion } from 'motion/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ArrowDown, ShieldCheck } from 'lucide-react'
import { GlowButton } from './ui/GlowButton'
import { Eyebrow } from './ui/Eyebrow'
import { EASE } from '../lib/motion'
import { prefersReducedMotion } from '../lib/motionPreference'
import { scrollToId } from '../lib/scroll'

gsap.registerPlugin(ScrollTrigger)

const HEADLINE = [
  { text: 'Global Market', accent: false },
  { text: 'League', accent: true },
]

/** Each line rises out from behind a hard mask, one after the other. */
function MaskedLine({
  children,
  delay,
}: {
  children: React.ReactNode
  delay: number
}) {
  return (
    <span className="block overflow-hidden pb-[0.12em]">
      <motion.span
        className="block"
        initial={{ y: '110%' }}
        animate={{ y: '0%' }}
        transition={{ duration: 1.05, ease: EASE, delay }}
      >
        {children}
      </motion.span>
    </span>
  )
}

export function Hero() {
  const root = useRef<HTMLElement>(null)
  const plate = useRef<HTMLDivElement>(null)

  const scrollToForm = () => scrollToId('register')

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return

    const ctx = gsap.context(() => {
      // The plate leaves at roughly two-thirds page speed, so the skyline
      // reads as sitting behind the copy rather than taped to it. The drift
      // animation owns the transform on the <picture> inside, which is why
      // the parallax is applied to the wrapper and not the image.
      gsap.to(plate.current, {
        yPercent: 18,
        ease: 'none',
        scrollTrigger: {
          trigger: root.current,
          start: 'top top',
          end: 'bottom top',
          scrub: 0.5,
        },
      })
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <section
      ref={root}
      id="top"
      className="grain relative isolate flex min-h-[100svh] flex-col justify-center overflow-hidden px-6 pb-28 pt-[calc(var(--nav-h)+7rem)] xl:px-20 2xl:px-28"
      aria-label="Global Market League"
    >
      {/* The skyline plate is the whole backdrop. The portrait crop is a
          separate file rather than an object-position tweak: the towers sit on
          the lower third, and cover-cropping the landscape frame on a phone
          pushes them off the canvas entirely. */}
      <div ref={plate} className="absolute inset-0 -z-20">
        <picture className="block h-full w-full [animation:hero-drift_30s_ease-in-out_infinite_alternate]">
          <source
            media="(max-width: 768px)"
            srcSet="/img/hero-plate-mobile.webp"
          />
          <img
            src="/img/hero-plate.webp"
            alt=""
            aria-hidden
            fetchPriority="high"
            className="h-full w-full object-cover object-right-bottom opacity-90"
          />
        </picture>

        {/* Bloom sitting on the skyline's horizon, breathing independently. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] [animation:horizon-glow_9s_ease-in-out_infinite] [background:radial-gradient(70%_60%_at_72%_92%,rgba(0,255,135,0.22),transparent_68%)]"
        />
      </div>

      {/* Legibility scrim. Anchored left with the copy rather than centred, so
          the skyline stays readable on the right where the towers actually
          are. Capped well below opaque  a full-strength wash would bury the
          image that is now carrying the section. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [background:linear-gradient(100deg,rgba(10,10,10,0.95)_0%,rgba(10,10,10,0.86)_34%,rgba(10,10,10,0.45)_62%,rgba(10,10,10,0.18)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-[#0a0a0a] to-transparent"
      />
      {/* Blend the plate into the TrustBar below. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-[#0a0a0a] to-transparent"
      />

      <div className="shell relative z-10 flex w-full flex-col items-start text-left">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
        >
          <Eyebrow>7 – 18 September · Registration open</Eyebrow>
        </motion.div>

        <h1 className="mt-8 max-w-[16ch] text-[clamp(2.6rem,8.2vw,6.5rem)] font-bold leading-[0.94]">
          {HEADLINE.map((line, i) => (
            <MaskedLine key={line.text} delay={0.25 + i * 0.13}>
              <span
                className={line.accent ? 'text-[#00FF87] text-glow' : 'text-white'}
              >
                {line.text}
              </span>
            </MaskedLine>
          ))}
        </h1>

        <motion.p
          className="mt-8 max-w-2xl text-[clamp(1rem,1.9vw,1.2rem)] leading-relaxed text-[#E4EAE7]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.62 }}
        >
          Join our Global Trading Challenge and experience how global markets
          work. Start with a{' '}
          <span className="font-semibold text-white">$10,000 demo account</span>
          , learn, experiment with different strategies, and compete with other
          traders. Climb the leaderboard and stand a chance to win up to{' '}
          <span className="font-semibold text-white">$1,000</span>, all without
          risking your real money.
        </motion.p>

        <motion.div
          className="mt-11 flex flex-col items-start gap-5 sm:flex-row sm:items-center"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.78 }}
        >
          <GlowButton
            onClick={scrollToForm}
            className="animate-[breathe_3.4s_ease-in-out_infinite]"
          >
            Join the League
            <ArrowDown className="size-4 transition-transform duration-300 group-hover:translate-y-0.5" />
          </GlowButton>

          <span className="inline-flex items-center gap-2 text-[15px] text-[#E4EAE7] [text-shadow:0_1px_10px_rgba(0,0,0,0.9)]">
            <ShieldCheck className="size-4 text-[#00FF87]" />
            Free to enter · Demo capital only
          </span>
        </motion.div>
      </div>

      <motion.div
        aria-hidden
        className="absolute bottom-8 left-6 xl:left-20 2xl:left-28"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
      >
        <div className="h-14 w-[1px] bg-gradient-to-b from-transparent via-[#00FF87]/70 to-transparent [animation:rail-pulse_2.4s_ease-in-out_infinite]" />
      </motion.div>
    </section>
  )
}

import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowDown, ShieldCheck } from 'lucide-react'
import { LumenCta } from '../threeui/LumenCta'
import { startArticleHeadingDecode } from '../threeui/articleHeadingDecode'
import { usePerfTier } from '../lib/usePerfTier'
import { EASE } from '../lib/motion'
import { scrollToId } from '../lib/scroll'
import { parallax, scrollScene } from '../lib/scrollScene'

// ThreeUI's Laser renderer is raw WebGL against one full-screen quad  no
// scene graph, no `three`. Still lazy: the shader source is a chunk the
// static-plate path never has to download.
const LaserVariants = lazy(() =>
  import('../threeui/LaserVariants').then((m) => ({ default: m.LaserVariants }))
)

const HEADLINE = [
  { text: 'Global Market', accent: false },
  { text: 'Champion League', accent: false },
] as const

const HEADLINE_TEXT = HEADLINE.map((line) => line.text).join(' ')

/** Two footnotes above the headline. Each one has to give a reason, not a
 *  date: the deadline is only interesting because something shuts, and the
 *  demo account is only interesting because it means nobody outspends you. */
const NOTES = [
  {
    title: 'The gate shuts 6 September',
    body: 'Entries close at 23:59. Twelve days later the board locks, and whoever is on top gets paid.',
  },
  {
    title: 'Nobody starts ahead',
    body: 'Same $10,000, same feed, same twelve days. No deposit buys an edge, and none is needed to take one.',
  },
] as const

/** ThreeUI's article-heading decode, tuned down from its editorial defaults:
 *  a shorter scramble window and a low tail chance, so the headline resolves
 *  rather than churns. The characters are hidden from assistive tech while
 *  they are still noise  the <h1> carries the real string as its label. */
const DECODE = {
  duration: 900,
  stagger: 140,
  scrambleLength: 6,
  preserveChance: 0.28,
  tailChance: 0.5,
}

/** Static plate shown on low-power devices, reduced motion, or context loss.
 *  This is what most phone traffic sees, so it carries the section on its own.
 *  When a generated plate is present it takes over; the CSS layers are the
 *  stand-in, not an overlay, or the two grids fight each other. */
function StaticPlate() {
  const [plate, setPlate] = useState<'pending' | 'loaded' | 'missing'>('pending')

  // Deterministic silhouette echoing the candle field.
  const candles = Array.from({ length: 34 }, (_, i) => {
    const n = Math.sin(i * 12.9898) * 43758.5453
    const r = n - Math.floor(n)
    return { h: 8 + r * 62, lit: r > 0.62, delay: r * 3 }
  })

  return (
    <div className="absolute inset-0 overflow-hidden">
      <picture>
        <source media="(max-width: 768px)" srcSet="/img/hero-plate-mobile.webp" />
        <img
          src="/img/hero-plate.webp"
          alt=""
          aria-hidden
          fetchPriority="high"
          className="h-full w-full object-cover"
          onLoad={() => setPlate('loaded')}
          onError={() => setPlate('missing')}
          style={{ display: plate === 'missing' ? 'none' : undefined }}
        />
      </picture>

      {plate === 'missing' && (
        <>
          {/* Candle silhouette standing on the horizon. */}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-[26vh] flex items-end justify-center gap-[0.9vw] px-[4vw] opacity-70"
          >
            {candles.map((c, i) => (
              <span
                key={i}
                className="w-[0.7vw] max-w-[10px] rounded-[2px]"
                style={{
                  height: `${c.h}px`,
                  background: c.lit
                    ? 'linear-gradient(180deg,#00FF87,rgba(0,255,135,0.15))'
                    : 'linear-gradient(180deg,#123526,rgba(18,53,38,0.1))',
                  boxShadow: c.lit ? '0 0 14px rgba(0,255,135,0.55)' : 'none',
                  animation: `rail-pulse ${3 + c.delay}s ease-in-out infinite`,
                }}
              />
            ))}
          </div>

          {/* Perspective floor grid. */}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-[46vh] opacity-45 [transform:perspective(380px)_rotateX(64deg)] [transform-origin:bottom] [background-image:linear-gradient(rgba(0,255,135,0.65)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,135,0.65)_1px,transparent_1px)] [background-size:58px_58px] [mask-image:linear-gradient(to_top,#000_2%,transparent_78%)]"
          />

          <div
            aria-hidden
            className="absolute inset-x-0 bottom-[26vh] h-px bg-[linear-gradient(90deg,transparent,rgba(0,255,135,0.7),transparent)]"
          />
        </>
      )}
    </div>
  )
}

export function Hero() {
  const tier = usePerfTier()
  const use3D = tier === 'full'
  const headlineRef = useRef<HTMLHeadingElement>(null)
  const root = useRef<HTMLElement>(null)
  const scene = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)

  // The scene trails the scroll and the type outruns it, so the hero peels
  // apart on the way out instead of sliding off as one flat plate. The scene
  // layer is over-scaled, or drifting it would expose the frame edge.
  useLayoutEffect(
    () =>
      scrollScene(root.current, () => {
        parallax(scene.current, { yPercent: 12 }, root.current!, [
          'top top',
          'bottom top',
        ])
        parallax(content.current, { yPercent: -22, opacity: 0.2 }, root.current!, [
          'top top',
          'bottom top',
        ])
      }),
    []
  )

  useEffect(() => {
    const root = headlineRef.current
    if (!root) return
    // Held back until the entrance fade has started, so the scramble reads as
    // the headline arriving rather than as a glitch on an already-set line.
    const id = window.setTimeout(() => startArticleHeadingDecode(root, DECODE), 220)
    return () => window.clearTimeout(id)
  }, [])

  const scrollToForm = () => scrollToId('register')

  return (
    <section
      ref={root}
      id="top"
      className="grain relative isolate flex min-h-[100svh] flex-col justify-between overflow-hidden px-6 pb-14 pt-24 sm:pb-20 xl:px-20 2xl:px-28"
      aria-label="Global Market Champion League"
    >
      <div ref={scene} className="absolute inset-0 -z-20 scale-[1.14]">
        {/* The plate carries the scene on every device. The shader is an
            additive pass over it, never a replacement: on its own the blade
            is one pale streak on black, which is what the section used to
            look like on a wide screen. */}
        <StaticPlate />

        {use3D && (
          <Suspense fallback={null}>
            <div
              aria-hidden
              className="absolute inset-0 opacity-90 mix-blend-screen"
            >
              <LaserVariants
                variant="atmospheric-blade"
                speed={0.85}
                length={1.2}
                density={1.15}
                style={{ background: '#000' }}
              />
            </div>
          </Suspense>
        )}

        {/* Scan grid drifting up the floor. The travel is exactly one 8px
            period, so the loop closes on itself — motion with nothing moving
            at random. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-[70%] overflow-hidden [mask-image:linear-gradient(to_top,#000_10%,transparent_85%)]"
        >
          <div className="absolute inset-x-0 -top-8 bottom-[-2rem] [animation:scan-drift_5.5s_linear_infinite] [background-image:repeating-linear-gradient(0deg,rgba(0,255,135,0.075)_0px,rgba(0,255,135,0.075)_1px,transparent_1px,transparent_8px)]" />
        </div>

        {/* Horizon bloom sits over whichever path is showing  and is the one
            thing still standing if the canvas never gets a context, so the
            section never bottoms out into flat black. */}
        <div
          aria-hidden
          className="absolute inset-0 [background:radial-gradient(88%_58%_at_50%_104%,rgba(0,255,135,0.30),rgba(0,200,83,0.08)_42%,transparent_66%)]"
        />
      </div>

      {/* Legibility scrim. Deliberately elliptical and capped well below
          opaque  a full-strength vignette buries the beam, which is the
          whole reason the scene is there. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [background:radial-gradient(76%_56%_at_40%_46%,rgba(10,10,10,0.86)_0%,rgba(10,10,10,0.58)_44%,rgba(10,10,10,0.18)_72%,transparent_90%)]"
      />
      {/* Edge falloff only  corners and top, never the centre-bottom. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [background:radial-gradient(140%_105%_at_50%_45%,transparent_62%,rgba(10,10,10,0.72)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-[#0a0a0a] to-transparent"
      />
      {/* Blend the scene into the ticker below, and give the foot band a
          floor to sit on — the plate is at full strength down there. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-56 [background:linear-gradient(to_top,rgba(10,10,10,0.94)_0%,rgba(10,10,10,0.72)_38%,transparent_100%)]"
      />

      <div ref={content} className="shell relative z-10 flex flex-1 flex-col justify-between gap-16">
        {/* Footnote row. Smallest type on the page, set against the largest
            directly below it  the size gap is what makes both read. */}
        <motion.div
          className="grid gap-x-10 gap-y-6 border-b border-white/8 pb-7 md:grid-cols-12"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
        >
          <p className="flex items-center gap-2 font-mono text-nano uppercase text-white md:col-span-2">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00FF87] opacity-70" />
              <span className="relative inline-flex size-1.5 rounded-full bg-[#00FF87]" />
            </span>
            GMCL
          </p>

          {NOTES.map((n) => (
            <div key={n.title} className="md:col-span-5">
              <p className="text-small font-semibold text-white">{n.title}</p>
              <p className="mt-1.5 text-small text-muted">{n.body}</p>
            </div>
          ))}
        </motion.div>

        <div>
          <motion.h1
            ref={headlineRef}
            aria-label={HEADLINE_TEXT}
            className="text-display text-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.15 }}
          >
            {HEADLINE.map((line) => (
              <span key={line.text} aria-hidden data-article-heading className="block">
                {line.text}
              </span>
            ))}
          </motion.h1>

        </div>

        {/* Foot band: the action on the left, the one lead paragraph on the
            right. Keeping them on one line means the headline owns the full
            measure without the copy stacking under it. */}
        <motion.div
          className="grid items-end gap-x-10 gap-y-8 md:grid-cols-12"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.62 }}
        >
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6 md:col-span-6">
            <LumenCta
              onClick={scrollToForm}
              buttonClassName="animate-[breathe_3.4s_ease-in-out_infinite]"
              label={
                <>
                  Join the League
                  <ArrowDown className="size-4" />
                </>
              }
            />

            <span className="inline-flex items-center gap-2 text-small text-[#B7BEBB] [text-shadow:0_1px_2px_#0a0a0a,0_2px_18px_#0a0a0a]">
              <ShieldCheck className="size-4 text-[#00FF87]" />
              Free to enter · Demo capital only
            </span>
          </div>

          <p className="text-lead text-[#B7BEBB] [text-shadow:0_1px_2px_#0a0a0a,0_2px_22px_#0a0a0a] md:col-span-5 md:col-start-8">
            Twelve days to turn $10,000 into the biggest number on the board.
            Three traders leave with a share of{' '}
            <span className="font-semibold text-white">$175,000</span>. Entry
            costs nothing but the nerve to start.
          </p>
        </motion.div>
      </div>
    </section>
  )
}

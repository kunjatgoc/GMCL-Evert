import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { CalendarRange, TrendingUp, Wallet } from 'lucide-react'
import { GlassCard } from './ui/GlassCard'
import { Eyebrow } from './ui/Eyebrow'
import { Counter } from './ui/Counter'
import { IconArt } from './ui/IconArt'
import { prefersReducedMotion } from '../lib/motionPreference'

gsap.registerPlugin(ScrollTrigger)

const FACTS = [
  {
    icon: CalendarRange,
    label: 'League window',
    value: '7 – 18 Sept',
    body: 'Twelve trading days. The board opens at 00:00 on the 7th and locks at 23:59 on the 18th.',
    img: '/img/icon-dates.webp',
  },
  {
    icon: Wallet,
    label: 'Starting capital',
    value: '$10,000',
    counter: 10000,
    body: 'Every participant is funded with the same $10,000 USD demo account. No deposits, no advantage bought.',
    img: '/img/icon-capital.webp',
  },
  {
    icon: TrendingUp,
    label: 'Win condition',
    value: 'Biggest gain',
    body: 'The trader who grows their balance the most by the close of the 18th takes first place.',
    img: '/img/icon-win.webp',
  },
] as const

export function AboutLeague() {
  const root = useRef<HTMLElement>(null)
  const rail = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return

    const ctx = gsap.context(() => {
      // The rail draws itself down the section as you scroll through it.
      gsap.fromTo(
        rail.current,
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: root.current,
            start: 'top 70%',
            end: 'bottom 65%',
            scrub: 0.6,
          },
        }
      )

      gsap.fromTo(
        card.current,
        { y: 60, rotate: -3 },
        {
          y: -60,
          rotate: 3,
          ease: 'none',
          scrollTrigger: {
            trigger: root.current,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 1,
          },
        }
      )

      // Cards arrive along z, staggered, each tied to its own scroll position
      // so they land as the rail passes them rather than all at once.
      gsap.utils.toArray<HTMLElement>('[data-fact]').forEach((card, i) => {
        gsap.fromTo(
          card,
          { y: 70, z: -180, rotateX: 10, autoAlpha: 0 },
          {
            y: 0,
            z: 0,
            rotateX: 0,
            autoAlpha: 1,
            duration: 1,
            ease: 'expo.out',
            delay: i * 0.06,
            scrollTrigger: { trigger: card, start: 'top 88%', once: true },
          }
        )
      })
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <section
      ref={root}
      id="about"
      className="relative overflow-hidden px-6 py-28 sm:py-36"
      aria-labelledby="about-heading"
    >
      {/* Backdrop: generated art if present, otherwise a green bloom. */}
      <img
        src="/img/about-backdrop.webp"
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25 [mask-image:radial-gradient(70%_70%_at_20%_50%,#000,transparent)]"
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-1/3 -z-10 size-[36rem] rounded-full bg-[#00FF87] opacity-[0.07] blur-[140px]"
      />

      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
          <header>
            <Eyebrow>How it works</Eyebrow>
            <h2
              id="about-heading"
              className="mt-6 text-[clamp(2.1rem,5.2vw,3.6rem)] font-bold leading-[1.05]"
            >
              About the <span className="text-[#00FF87]">League</span>
            </h2>
            <p className="mt-5 max-w-xl text-[1.05rem] leading-relaxed text-[#E4EAE7]">
              One rule set, one starting balance, one winner. Twelve days of
              live market conditions on a demo account, so the only thing you
              can lose is the lead.
            </p>
          </header>

          {/* Drifts against the scroll direction  the parallax is what sells
              it as floating in front of the backdrop rather than pasted on. */}
          <div ref={card} className="relative hidden lg:block">
            <div
              aria-hidden
              className="absolute inset-8 rounded-full bg-[#00FF87] opacity-20 blur-[90px]"
            />
            <IconArt
              src="/img/hero-card.webp"
              fallback={TrendingUp}
              className="relative w-full drop-shadow-[0_40px_80px_rgba(0,0,0,0.8)]"
            />
          </div>
        </div>

        <div className="relative mt-16 grid gap-6 md:grid-cols-3">
          {/* Progress rail  vertical on mobile, horizontal on desktop. */}
          <div
            aria-hidden
            className="absolute -left-4 top-0 hidden h-full w-px origin-top bg-[linear-gradient(180deg,#00FF87,rgba(0,255,135,0.05))] md:block"
            ref={rail}
          />

          {FACTS.map((f) => {
            const Icon = f.icon
            return (
              <GlassCard
                key={f.label}
                className="group p-7 [transform-style:preserve-3d]"
              >
                <div data-fact>
                  <div className="flex size-16 items-center justify-center rounded-2xl border border-[rgba(0,255,135,0.22)] bg-[rgba(0,255,135,0.07)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110">
                    <IconArt src={f.img} fallback={Icon} className="h-11 w-auto max-w-11" />
                  </div>

                  <p className="mt-6 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#E4EAE7]">
                    {f.label}
                  </p>

                  <p className="mt-2 text-[1.9rem] font-bold leading-none tracking-tight text-white">
                    {'counter' in f && f.counter ? (
                      <Counter to={f.counter} prefix="$" />
                    ) : (
                      f.value
                    )}
                  </p>

                  <p className="mt-4 text-[1rem] leading-relaxed text-[#E4EAE7]">
                    {f.body}
                  </p>
                </div>
              </GlassCard>
            )
          })}
        </div>
      </div>
    </section>
  )
}

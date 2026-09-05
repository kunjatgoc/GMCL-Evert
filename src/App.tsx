import { useEffect } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Nav } from './components/Nav'
import { Hero } from './components/Hero'
import { TrustBar } from './components/TrustBar'
import { AboutLeague } from './components/AboutLeague'
import { Prizes } from './components/Prizes'
import { JoinCta } from './components/JoinCta'
import { prefersReducedMotion } from './lib/motionPreference'
import { setScroller } from './lib/scroll'

export default function App() {
  useEffect(() => {
    // Native scrolling is correct for reduced motion  smoothing is exactly
    // the kind of motion the preference is asking us to drop.
    if (prefersReducedMotion()) return

    const lenis = new Lenis({ duration: 1.05, smoothWheel: true })
    setScroller(lenis)

    // Drive both from one RAF loop, and let ScrollTrigger read Lenis's
    // position rather than the browser's, or pinned scenes drift.
    lenis.on('scroll', ScrollTrigger.update)
    const tick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    // Anchor clicks and scrollIntoView must go through Lenis too.
    const onAnchor = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest?.('a[href^="#"]')
      if (!a) return
      const id = a.getAttribute('href')!.slice(1)
      const el = document.getElementById(id)
      if (!el) return
      e.preventDefault()
      lenis.scrollTo(el, { offset: -8 })
    }
    document.addEventListener('click', onAnchor)

    return () => {
      document.removeEventListener('click', onAnchor)
      gsap.ticker.remove(tick)
      setScroller(null)
      lenis.destroy()
    }
  }, [])

  return (
    <>
      <Nav />

      <main>
        <Hero />
        <TrustBar />
        <AboutLeague />
        <Prizes />
        <JoinCta />
      </main>

      <footer className="border-t border-white/5 px-6 py-8 text-center text-[13.5px] text-[#E4EAE7]/70">
        <p>
          Global Market League · Associated with newera Broker. Demo accounts
          only &mdash; no real capital is traded and no deposit is required.
        </p>

        {/* Sits last and reads quieter than the credit above it, which is
            where a disclaimer belongs: present on every page, never
            competing with the offer. The support address is not down here --
            it is a section of its own above, where it gets read. */}
        <p className="mx-auto mt-3 max-w-2xl text-[12.5px] text-[#E4EAE7]/55">
          This site is provided for educational purposes only and does not
          constitute financial or investment advice.
        </p>
      </footer>
    </>
  )
}

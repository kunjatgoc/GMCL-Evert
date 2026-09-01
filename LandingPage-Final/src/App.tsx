import { lazy, Suspense, useEffect } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Nav } from './components/Nav'
import { Hero } from './components/Hero'
import { TrustBar } from './components/TrustBar'
import { AboutLeague } from './components/AboutLeague'
import { Prizes } from './components/Prizes'
import { prefersReducedMotion } from './lib/motionPreference'
import { setScroller } from './lib/scroll'

// The form drags in zod, react-hook-form and libphonenumber's metadata 
// none of which the hero needs to paint. Split it out, then warm it during
// the first idle window so it is already cached by the time anyone scrolls.
const RegistrationForm = lazy(() =>
  import('./components/RegistrationForm').then((m) => ({
    default: m.RegistrationForm,
  }))
)

function prefetchForm() {
  import('./components/RegistrationForm')
}

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

  useEffect(() => {
    const ric = window.requestIdleCallback
    if (ric) {
      const id = ric(prefetchForm, { timeout: 3000 })
      return () => window.cancelIdleCallback?.(id)
    }
    const t = setTimeout(prefetchForm, 2000)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      <Nav />

      <main>
        <Hero />
        <TrustBar />
        <AboutLeague />
        <Prizes />
        <Suspense
          fallback={<div id="register" className="min-h-[70vh] scroll-mt-8" />}
        >
          <RegistrationForm />
        </Suspense>
      </main>

      <footer className="border-t border-white/5 px-6 py-8 text-center text-[13.5px] text-[#E4EAE7]/70">
        Global Market League · Powered by NewEra Broker. Demo accounts
        only &mdash; no real capital is traded and no deposit is required.
      </footer>
    </>
  )
}

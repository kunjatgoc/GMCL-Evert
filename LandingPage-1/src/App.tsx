import { lazy, Suspense, useEffect } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Frame } from './components/Frame'
import { Hero } from './components/Hero'
import { Ticker } from './components/Ticker'
import { TrustBar } from './components/TrustBar'
import { AboutLeague } from './components/AboutLeague'
import { Prizes } from './components/Prizes'
import { prefersReducedMotion } from './lib/usePerfTier'
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
      <Frame />
      <main>
        <Hero />
        <Ticker />
        <TrustBar />
        <AboutLeague />
        <Prizes />
        <Suspense
          fallback={<div id="register" className="min-h-[70vh] scroll-mt-8" />}
        >
          <RegistrationForm />
        </Suspense>
      </main>

      <footer className="border-t border-white/5 px-6 py-12 xl:px-20 2xl:px-28">
        <div className="shell flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-body font-semibold text-white">
              Global Market Champion League
            </p>
            <p className="mt-1.5 font-mono text-nano uppercase text-muted">
              Season 01 · 7 – 18 September
            </p>
          </div>

          <nav className="flex gap-6 text-small text-muted">
            <a className="transition-colors hover:text-white" href="#about">
              How it works
            </a>
            <a className="transition-colors hover:text-white" href="#prizes">
              Prizes
            </a>
            <a className="transition-colors hover:text-white" href="#register">
              Register
            </a>
          </nav>

          <p className="max-w-xs text-small text-muted/70">
            Powered by NewEra Broker. Demo accounts only  no real capital is
            traded and no deposit is required.
          </p>
        </div>
      </footer>
    </>
  )
}

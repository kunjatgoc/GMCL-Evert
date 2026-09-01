import { useEffect, useState } from 'react'
import { scrollToId } from '../lib/scroll'

/** Fraction of the viewport the hero must clear before the bar takes over. */
const REVEAL_AT = 0.7

/**
 * Page chrome: a bar that arrives once the hero is behind you, and two edge
 * rails carrying the season marker and the read position. Lenis writes to the
 * native scroll position, so a passive window listener is enough.
 */
export function Frame() {
  const [scrolled, setScrolled] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let raf = 0
    const measure = () => {
      raf = 0
      const max = document.documentElement.scrollHeight - window.innerHeight
      setScrolled(window.scrollY > window.innerHeight * REVEAL_AT)
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          scrolled ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
        }`}
      >
        <div className="shell flex items-center gap-4 px-6 py-3 xl:px-20 2xl:px-28">
          <a
            href="#top"
            className="text-small font-semibold text-white"
          >
            GMCL<span className="text-[#00FF87]">.</span>
          </a>

          <nav className="ml-6 hidden gap-6 text-small text-muted md:flex">
            <a className="transition-colors hover:text-white" href="#about">
              How it works
            </a>
            <a className="transition-colors hover:text-white" href="#prizes">
              Prizes
            </a>
          </nav>

          <button
            type="button"
            onClick={() => scrollToId('register')}
            className="ml-auto rounded-full bg-[#00FF87] px-4 py-2 text-small font-semibold text-black transition-transform duration-300 hover:scale-[1.04]"
          >
            Enter
          </button>
        </div>
      </header>

      {/* Edge rails. They exist to give the wide margins a job  a season
          marker on one side, how far through you are on the other. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-y-0 left-0 z-40 hidden w-14 xl:flex xl:flex-col xl:items-center xl:justify-between xl:py-8"
      >
        <span className="font-mono text-nano uppercase text-muted/50 [writing-mode:vertical-rl]">
          Season 01
        </span>
        <span className="font-mono text-nano uppercase text-muted/50 [writing-mode:vertical-rl]">
          NewEra Broker
        </span>
      </div>

      <div
        aria-hidden
        className="pointer-events-none fixed inset-y-0 right-0 z-40 hidden w-14 xl:flex xl:flex-col xl:items-center xl:justify-center xl:gap-5"
      >
        <span className="tabular font-mono text-nano text-[#00FF87]/70">
          {String(Math.round(progress * 100)).padStart(2, '0')}
        </span>
        <span className="relative h-40 w-px bg-white/10">
          <span
            className="absolute inset-x-0 top-0 origin-top bg-[#00FF87]"
            style={{ height: `${progress * 100}%` }}
          />
        </span>
        <span className="font-mono text-nano uppercase text-muted/50 [writing-mode:vertical-rl]">
          $175,000 pool
        </span>
      </div>
    </>
  )
}

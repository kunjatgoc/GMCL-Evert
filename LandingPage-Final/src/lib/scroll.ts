import type Lenis from 'lenis'

// Module singleton so components can request a scroll without prop-drilling
// the Lenis instance, and without it becoming a global on `window`.
let instance: Lenis | null = null

export function setScroller(l: Lenis | null) {
  instance = l
}

/**
 * Scrolls to an element by id. Routes through Lenis when smooth scrolling is
 * active, and falls back to the native call when it is not  which is also
 * the correct behaviour under prefers-reduced-motion.
 */
export function scrollToId(id: string) {
  const el = document.getElementById(id)
  if (!el) return

  if (instance) {
    instance.scrollTo(el, { offset: -8 })
  } else {
    el.scrollIntoView({ behavior: 'auto', block: 'start' })
  }
}

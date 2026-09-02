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
export function scrollToId(id: string, offset = -8) {
  const el = document.getElementById(id)
  if (!el) return

  if (instance) {
    instance.scrollTo(el, { offset })
  } else {
    el.scrollIntoView({ behavior: 'auto', block: 'start' })
    // The native path lands the element at the top edge; shift it by the same
    // amount Lenis would have, so both routes stop in the same place.
    if (offset) window.scrollBy(0, offset)
  }
}

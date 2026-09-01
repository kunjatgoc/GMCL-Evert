/**
 * Single source of truth for the reduced-motion preference.
 *
 * Pessimistic on the server and in any environment without matchMedia: an
 * animation that fails to start is a smaller problem than one that ignores
 * the preference.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

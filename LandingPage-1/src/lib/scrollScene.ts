import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { prefersReducedMotion } from './usePerfTier'

gsap.registerPlugin(ScrollTrigger)

/**
 * Wires a section's scroll behaviour and returns the cleanup a layout effect
 * wants back.
 *
 * Every `[data-reveal]` inside `scope` wipes in as it crosses the fold — the
 * attribute's value, if present, is a delay in seconds. Anything scroll-linked
 * beyond that goes in `build`, which runs inside the same gsap context, so one
 * `revert()` unwinds the lot.
 *
 * Under `prefers-reduced-motion` nothing is created at all. That matters more
 * than it looks: `fromTo` writes its from-state the moment the tween is built,
 * so bailing before that is what keeps the page readable rather than leaving
 * every heading parked at `opacity: 0`.
 */
export function scrollScene(scope: Element | null, build?: () => void) {
  if (!scope || prefersReducedMotion()) return () => {}

  const ctx = gsap.context(() => {
    gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
      gsap.fromTo(
        el,
        { y: 32, opacity: 0, clipPath: 'inset(0 0 45% 0)' },
        {
          y: 0,
          opacity: 1,
          clipPath: 'inset(0 0 0% 0)',
          duration: 1.05,
          ease: 'expo.out',
          delay: Number(el.dataset.reveal) || 0,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        }
      )
    })

    build?.()
  }, scope)

  return () => ctx.revert()
}

/** Scrub tween. Defaults cover the common case: element enters, element leaves. */
export function parallax(
  target: gsap.TweenTarget,
  vars: gsap.TweenVars,
  trigger: Element,
  range: [string, string] = ['top bottom', 'bottom top']
) {
  return gsap.to(target, {
    ...vars,
    ease: 'none',
    scrollTrigger: { trigger, start: range[0], end: range[1], scrub: 0.8 },
  })
}

import type { Variants } from 'motion/react'

export const EASE = [0.16, 1, 0.3, 1] as const

export const riseIn: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: EASE, delay: i * 0.08 },
  }),
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: (i = 0) => ({
    opacity: 1,
    transition: { duration: 0.9, ease: EASE, delay: i * 0.08 },
  }),
}

/** Cards enter along z as well as y, so the depth reads before the position. */
export const depthIn: Variants = {
  hidden: { opacity: 0, y: 40, scale: 0.94, rotateX: 8 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    rotateX: 0,
    transition: { duration: 0.95, ease: EASE, delay: i * 0.12 },
  }),
}

export const viewportOnce = { once: true, amount: 0.3 } as const

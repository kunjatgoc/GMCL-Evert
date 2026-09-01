import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../../lib/motionPreference'

type Props = {
  to: number
  prefix?: string
  duration?: number
  className?: string
}

/**
 * Rolls 0 → `to` once the element scrolls into view.
 * Reduced motion jumps straight to the final value.
 */
export function Counter({ to, prefix = '', duration = 1600, className = '' }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const [value, setValue] = useState(prefersReducedMotion() ? to : 0)

  useEffect(() => {
    if (prefersReducedMotion()) return
    const el = ref.current
    if (!el) return

    let raf = 0
    let start = 0

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        io.disconnect()

        const tick = (t: number) => {
          if (!start) start = t
          const p = Math.min((t - start) / duration, 1)
          // easeOutExpo  fast commit, long settle. Reads as a mechanical
          // counter landing rather than a linear ramp.
          const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p)
          setValue(Math.round(to * eased))
          if (p < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      },
      { threshold: 0.5 }
    )

    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [to, duration])

  return (
    <span ref={ref} className={`tabular ${className}`}>
      {prefix}
      {value.toLocaleString('en-US')}
    </span>
  )
}

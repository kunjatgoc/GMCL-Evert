import { useRef, type ReactNode } from 'react'
import { prefersReducedMotion } from '../../lib/usePerfTier'

type Props = {
  children: ReactNode
  className?: string
  /** Peak rotation in degrees at the card's corners. */
  tilt?: number
  /** Adds a cursor-tracked green sheen across the surface. */
  sheen?: boolean
}

export function GlassCard({
  children,
  className = '',
  tilt = 7,
  sheen = true,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion() || tilt === 0) return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    el.style.transform = `perspective(1100px) rotateY(${(px - 0.5) * tilt * 2}deg) rotateX(${(0.5 - py) * tilt * 2}deg) translateZ(0)`
    el.style.setProperty('--mx', `${px * 100}%`)
    el.style.setProperty('--my', `${py * 100}%`)
  }

  const reset = () => {
    const el = ref.current
    if (!el) return
    el.style.transform = ''
    el.style.setProperty('--mx', '50%')
    el.style.setProperty('--my', '0%')
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      className={[
        'glass glass-lip relative overflow-hidden rounded-3xl',
        'transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
        'will-change-transform',
        className,
      ].join(' ')}
      style={{ ['--mx' as string]: '50%', ['--my' as string]: '0%' }}
    >
      {sheen && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 [background:radial-gradient(420px_circle_at_var(--mx)_var(--my),rgba(0,255,135,0.14),transparent_65%)] group-hover:opacity-100 hover:opacity-100"
        />
      )}
      {children}
    </div>
  )
}

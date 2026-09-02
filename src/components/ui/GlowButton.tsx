import {
  useRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { prefersReducedMotion } from '../../lib/motionPreference'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  /** Cursor pulls the button toward it within this radius, in px. */
  magnetic?: boolean
  variant?: 'solid' | 'ghost'
  /**
   * Renders an <a> instead of a <button>. A control that changes the URL is a
   * link, and a link is what gives it middle-click, open-in-new-tab and the
   * right role read aloud -- none of which an onClick handler brings back.
   */
  href?: string
}

export function GlowButton({
  children,
  magnetic = true,
  variant = 'solid',
  className = '',
  href,
  ...rest
}: Props) {
  const ref = useRef<HTMLElement>(null)

  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!magnetic || prefersReducedMotion()) return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    el.style.transform = `translate3d(${dx * 0.18}px, ${dy * 0.28}px, 0) scale(1.03)`
  }

  const reset = () => {
    const el = ref.current
    if (el) el.style.transform = ''
  }

  const solid =
    'text-black bg-[linear-gradient(180deg,#5cffb4_0%,#00ff87_38%,#00c853_100%)] ' +
    'shadow-[0_10px_40px_-8px_rgba(0,255,135,0.45),inset_0_1px_0_0_rgba(255,255,255,0.55)] ' +
    'hover:brightness-110'

  const ghost =
    'text-white bg-white/[0.03] border border-[rgba(0,255,135,0.28)] ' +
    'hover:bg-white/[0.07] hover:border-[rgba(0,255,135,0.5)]'

  const shared = {
    onMouseMove: onMove,
    onMouseLeave: reset,
    onBlur: reset,
    className: [
      'group relative isolate inline-flex items-center justify-center gap-2',
      'rounded-full px-8 py-4 text-[16px] font-semibold tracking-tight',
      'transition-[transform,filter,background-color,border-color] duration-300',
      'will-change-transform disabled:pointer-events-none disabled:opacity-55',
      variant === 'solid' ? solid : ghost,
      className,
    ].join(' '),
    style: { transitionTimingFunction: 'cubic-bezier(0.16,1,0.3,1)' },
  }

  const face = (
    <>
      {/* Specular sweep that crosses the face on hover. */}
      {variant === 'solid' && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-full"
        >
          <span className="absolute -inset-y-8 -left-1/3 w-1/3 rotate-12 bg-white/40 blur-md opacity-0 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:left-[110%] group-hover:opacity-100" />
        </span>
      )}
      {children}
    </>
  )

  // The props are typed for a button because that is what almost every caller
  // wants; the cast is the price of one component covering both, and it is
  // cheaper than a second component that would drift from this one.
  if (href) {
    return (
      <a
        href={href}
        ref={ref as React.Ref<HTMLAnchorElement>}
        {...shared}
        {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {face}
      </a>
    )
  }

  return (
    <button ref={ref as React.Ref<HTMLButtonElement>} {...shared} {...rest}>
      {face}
    </button>
  )
}

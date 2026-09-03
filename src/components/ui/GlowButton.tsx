import {
  useLayoutEffect,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { Check } from 'lucide-react'
import { prefersReducedMotion } from '../../lib/motionPreference'

export type ButtonState = 'idle' | 'busy' | 'done'

/** How long a `done` button holds its tick before the caller moves on. Long
 *  enough to read, short enough that nobody is kept waiting for it. */
export const DONE_HOLD_MS = 550

/** Mirrors `glyph-depart` in index.css: a link's glyph leaves first and the
 *  page follows it. */
const DEPART_MS = 260

export const holdDone = () =>
  new Promise<void>((resolve) =>
    setTimeout(resolve, prefersReducedMotion() ? 0 : DONE_HOLD_MS)
  )

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
  /**
   * The glyph after the label. While `busy` it rides out through the right
   * edge and back in from the left until the work is done -- the loader is
   * the glyph itself, not a spinner beside it. On a link it departs on click
   * and the page follows. `done` swaps it for a tick.
   */
  icon?: ReactNode
  state?: ButtonState
  /** Read in place of the label while `done`. */
  doneLabel?: ReactNode
}

export function GlowButton({
  children,
  magnetic = true,
  variant = 'solid',
  className = '',
  href,
  icon,
  state = 'idle',
  doneLabel,
  onClick,
  ...rest
}: Props) {
  const ref = useRef<HTMLElement>(null)
  const glyphRef = useRef<HTMLSpanElement>(null)
  const [departing, setDeparting] = useState(false)
  const [reach, setReach] = useState<{ exit: number; enter: number } | null>(null)

  const riding = state === 'busy' || departing

  // The ride has to clear the right edge and come back through the left, and
  // how far that is depends on the label beside it. Measured once per ride
  // and handed to the keyframes, so the motion itself stays on the
  // compositor.
  useLayoutEffect(() => {
    if (!riding) return
    const root = ref.current
    const glyph = glyphRef.current
    if (!root || !glyph) return
    const r = root.getBoundingClientRect()
    const g = glyph.getBoundingClientRect()
    setReach({ exit: r.right - g.left + 8, enter: -(g.right - r.left) - 8 })
  }, [riding])

  const onMove = (e: MouseEvent<HTMLElement>) => {
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

  // A plain left click on a link with a glyph: the glyph goes first and the
  // page follows a beat later. Anything else -- a modifier key, a middle
  // click, a hash link the page scrolls to itself, reduced motion -- is left
  // to the browser, which already does the right thing.
  const onLinkClick = (e: MouseEvent<HTMLAnchorElement>) => {
    ;(onClick as unknown as ((e: MouseEvent<HTMLAnchorElement>) => void) | undefined)?.(e)
    if (e.defaultPrevented || !href || !icon || departing) return
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if (href.startsWith('#') || prefersReducedMotion()) return
    e.preventDefault()
    setDeparting(true)
    setTimeout(() => window.location.assign(href), DEPART_MS)
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
    'data-state': state,
    'data-departing': departing || undefined,
    className: [
      'group relative isolate inline-flex items-center justify-center gap-2 overflow-hidden',
      'rounded-full px-8 py-4 text-[16px] font-semibold tracking-tight',
      'transition-[transform,filter,background-color,border-color] duration-300',
      // The press: a touch smaller for exactly as long as the finger is down.
      'active:scale-[0.97] active:duration-100',
      // Disabled dims, but not while busy or done: the ride says the button
      // is working and the tick is the reward, and neither should read as a
      // control that stopped working.
      'will-change-transform disabled:pointer-events-none disabled:opacity-55',
      'data-[state=busy]:opacity-100 data-[state=done]:opacity-100',
      'aria-disabled:pointer-events-none',
      variant === 'solid' ? solid : ghost,
      className,
    ].join(' '),
    style: { transitionTimingFunction: 'cubic-bezier(0.16,1,0.3,1)' },
  }

  const vars = reach
    ? ({ '--to-exit': `${reach.exit}px`, '--from-left': `${reach.enter}px` } as CSSProperties)
    : undefined

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
      <span data-label className="inline-flex items-center gap-2">
        {state === 'done' ? (doneLabel ?? children) : children}
      </span>
      {icon && (
        <span
          ref={glyphRef}
          data-glyph
          aria-hidden
          className="inline-flex shrink-0 will-change-transform"
          style={vars}
        >
          {state === 'done' ? <Check className="size-4" strokeWidth={2.5} /> : icon}
        </span>
      )}
      {state === 'busy' && <span className="sr-only">Working…</span>}
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
        aria-disabled={departing || undefined}
        {...shared}
        {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}
        onClick={onLinkClick}
      >
        {face}
      </a>
    )
  }

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      aria-busy={state === 'busy' || undefined}
      {...shared}
      {...rest}
      disabled={rest.disabled || state !== 'idle'}
      onClick={onClick}
    >
      {face}
    </button>
  )
}

import { useRef, useState, useId } from 'react'
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'motion/react'
import { EASE } from '../lib/motion'
import { TEXT } from '../panel/type'

export type DayPoint = { day: string; demo: number; real_requests: number }

const W = 720
const H = 200

/** Gridlines, and the values written beside them. */
const TICKS = [1, 0.75, 0.5, 0.25, 0] as const

type Series = { key: 'demo' | 'real_requests'; label: string; color: string }

// Rule 5: the primary green and Ledger Gold, never two greens. Two greens is
// exactly what this was, and on a green canvas the second one read as the
// first one faded rather than as its own series. Gold sits opposite green on
// the wheel, so it separates at a glance and at any size.
const SIGNAL = '#3EE68A'
const GOLD = '#D9B45F'

const SERIES: Series[] = [
  { key: 'demo', label: 'Demo ID', color: SIGNAL },
  { key: 'real_requests', label: 'Real ID', color: GOLD },
]

/**
 * Points to a smooth path, via a quadratic through the midpoint of each pair.
 *
 * Deliberately not a Catmull-Rom spline: these are daily counts, and a spline
 * overshoots on a spike, which would draw the line below zero on the day after
 * a launch. A midpoint quadratic stays inside the hull of its own points.
 */
function smooth(points: [number, number][]): string {
  if (points.length < 2) return ''
  let d = `M ${points[0][0]} ${points[0][1]}`
  for (let i = 1; i < points.length - 1; i++) {
    const [cx, cy] = points[i]
    const [nx, ny] = points[i + 1]
    d += ` Q ${cx} ${cy} ${(cx + nx) / 2} ${(cy + ny) / 2}`
  }
  const [lx, ly] = points[points.length - 1]
  return `${d} T ${lx} ${ly}`
}

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

export function TrendChart({ data }: { data: DayPoint[] }) {
  const id = useId()
  const frame = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  // The readout switches the instant the cursor crosses into a new day, but
  // the marks travel there. Snapping them was correct about the numbers and
  // wrong about the feel -- the value is already right before the line
  // arrives, so nothing is ever misread.
  const SPRING = { stiffness: 520, damping: 38, mass: 0.55 }
  const rawX = useMotionValue(0)
  const rawDemoY = useMotionValue(0)
  const rawRealY = useMotionValue(0)
  const x = useSpring(rawX, SPRING)
  const demoY = useSpring(rawDemoY, SPRING)
  const realY = useSpring(rawRealY, SPRING)
  const tipLeft = useTransform(
    x,
    (v) => `clamp(4.5rem, ${(v / W) * 100}%, calc(100% - 4.5rem))`
  )

  // A flat run of zeros before launch would divide by nothing, so the floor is
  // 1 -- the line sits on the baseline instead of vanishing.
  const peak = Math.max(1, ...data.flatMap((d) => [d.demo, d.real_requests]))
  const last = Math.max(1, data.length - 1)
  const step = W / last
  const y = (v: number) => (1 - v / peak) * H

  // Roughly five labels, counted back from the last day rather than forward
  // from the first. Counting forward and then bolting the last day on lands it
  // next to a regular tick whenever the length is not a multiple of the step,
  // and the two labels overlap.
  const tickEvery = Math.max(1, Math.ceil(data.length / 5))
  const xTicks: number[] = []
  for (let i = last; i >= 0; i -= tickEvery) xTicks.unshift(i)

  /** The chart is drawn in viewBox units but hit-tested in CSS pixels, so the
   *  cursor is converted to a ratio first and only then to an index. */
  const track = (e: React.PointerEvent) => {
    const box = frame.current?.getBoundingClientRect()
    if (!box) return
    const ratio = clamp((e.clientX - box.left) / box.width, 0, 1)
    const i = Math.round(ratio * last)
    if (i === hover) return

    // Entering the plate places the marks; moving within it slides them.
    // Without the jump the first hover would sweep in from wherever the
    // springs were left, which reads as a glitch rather than a response.
    const target = [i * step, y(data[i].demo), y(data[i].real_requests)]
    const values = [rawX, rawDemoY, rawRealY]
    values.forEach((v, n) => {
      if (hover === null) [x, demoY, realY][n].jump(target[n])
      v.set(target[n])
    })
    setHover(i)
  }

  const active = hover === null ? null : data[hover]

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        {SERIES.map((s) => (
          <span key={s.key} className={`${TEXT.label} flex items-center gap-2`}>
            <span
              aria-hidden
              className="size-2.5 rounded-full"
              style={{ background: s.color, boxShadow: `0 0 12px ${s.color}66` }}
            />
            <span className="text-[#E4EAE7]">{s.label}</span>
          </span>
        ))}
        <span className={`${TEXT.label} tabular ml-auto text-[var(--admin-muted)]`}>
          Peak {peak} / day
        </span>
      </div>

      <div className="flex gap-3">
        {/* Y axis. DOM text, not SVG text: the viewBox is stretched
            non-uniformly to fill the card, and anything inside it stretches
            with it. */}
        <div className="relative h-56 w-11 shrink-0">
          {TICKS.map((t) => (
            <span
              key={t}
              className={`${TEXT.label} tabular absolute right-0 -translate-y-1/2 text-[var(--admin-muted)]`}
              style={{ top: `${(1 - t) * 100}%` }}
            >
              {Math.round(peak * t).toLocaleString('en-US')}
            </span>
          ))}
        </div>

        <div
          ref={frame}
          className="relative flex-1 cursor-crosshair"
          onPointerMove={track}
          onPointerLeave={() => setHover(null)}
        >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-56 w-full overflow-visible"
          role="img"
          aria-label={`Signups per day over the last ${data.length} days`}
        >
          <defs>
            {SERIES.map((s) => (
              <linearGradient
                key={s.key}
                id={`${id}-${s.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={s.color} stopOpacity="0.3" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {/* Four gridlines, not graph paper: enough to read a height against,
              not enough to compete with the lines themselves. */}
          {TICKS.map((t) => (
            <line
              key={t}
              x1="0"
              x2={W}
              y1={y(peak * t)}
              y2={y(peak * t)}
              // The baseline is the axis, so it is drawn brighter than the
              // gridlines above it.
              stroke={t === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)'}
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {hover !== null && (
            <motion.g
              style={{ x }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <line
                x1={0}
                x2={0}
                y1={0}
                y2={H}
                stroke="rgba(255,255,255,0.28)"
                strokeWidth="1"
                strokeDasharray="3 4"
                vectorEffect="non-scaling-stroke"
              />
            </motion.g>
          )}

          {SERIES.map((s, si) => {
            const pts = data.map(
              (d, i) => [i * step, y(d[s.key])] as [number, number]
            )
            const line = smooth(pts)
            const area = `${line} L ${W} ${y(0)} L 0 ${y(0)} Z`

            return (
              <g key={s.key}>
                <motion.path
                  d={area}
                  fill={`url(#${id}-${s.key})`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.9, ease: EASE, delay: 0.55 + si * 0.15 }}
                />
                {/* The line draws itself left to right. pathLength normalises
                    the dash units, so this needs no path measurement. */}
                <motion.path
                  d={line}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{
                    duration: 1.35,
                    ease: [0.22, 1, 0.36, 1],
                    delay: si * 0.18,
                  }}
                />

                {hover !== null && (
                  <motion.circle
                    cx={0}
                    cy={0}
                    r="4"
                    fill="var(--admin-bg)"
                    stroke={s.color}
                    strokeWidth="2.5"
                    vectorEffect="non-scaling-stroke"
                    style={{ x, y: s.key === 'demo' ? demoY : realY }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.18 }}
                  />
                )}
              </g>
            )
          })}
        </svg>

        {/* Tooltip lives in the DOM, not the SVG: text in a stretched viewBox
            would be squashed with it. */}
        <AnimatePresence>
          {active && (
            <motion.div
              key="tip"
              className="glass pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-xl bg-[var(--admin-card)] px-3.5 py-2.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.9)]"
              style={{ left: tipLeft }}
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.18, ease: EASE }}
            >
              <p className={`${TEXT.label} whitespace-nowrap text-[var(--admin-muted)]`}>
                {dayLabel(active.day)}
              </p>
              {SERIES.map((s) => (
                <p
                  key={s.key}
                  className={`${TEXT.label} mt-1 flex items-center gap-2 whitespace-nowrap`}
                >
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: s.color }}
                  />
                  <span className="tabular font-semibold text-white">
                    {active[s.key]}
                  </span>
                  <span className="text-[var(--admin-muted)]">{s.label}</span>
                </p>
              ))}
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>

      {/* X axis, offset by the y-axis gutter so the ticks line up with their
          own columns rather than with the card edge. */}
      <div className="flex gap-3">
        <span aria-hidden className="w-11 shrink-0" />
        <div className="relative h-5 flex-1">
          {xTicks.map((i) => (
            <span
              key={i}
              className={`${TEXT.label} absolute top-1 whitespace-nowrap text-[var(--admin-muted)]`}
              style={{
                left: `${(i / last) * 100}%`,
                // The first and last ticks hug their ends instead of hanging
                // off the plot.
                transform:
                  i === 0
                    ? 'none'
                    : i === last
                      ? 'translateX(-100%)'
                      : 'translateX(-50%)',
              }}
            >
              {dayLabel(data[i].day)}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

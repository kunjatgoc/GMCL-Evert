import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import gsap from 'gsap'
import { prefersReducedMotion } from '../../lib/usePerfTier'
import { scrollScene } from '../../lib/scrollScene'

/** Seconds one pulse takes to cross one segment. Segments fire on a fixed
 *  offset from this, so the train of pulses is periodic, never random. */
const SEGMENT_SECONDS = 2.2

type Props = {
  /** Box to draw inside. Every `[data-node]` under it becomes a stop on the
   *  chain, in DOM order. */
  containerRef: RefObject<HTMLElement | null>
}

/**
 * Draws an elbowed trace from each node to the next, the way a board traces
 * between components. Geometry is measured, not guessed, so it survives a
 * reflow, a font swap and a breakpoint change: side-by-side nodes get a
 * horizontal elbow, stacked ones a vertical one.
 */
export function CircuitRail({ containerRef }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [paths, setPaths] = useState<string[]>([])
  const [pads, setPads] = useState<{ x: number; y: number }[]>([])

  useLayoutEffect(() => {
    const root = containerRef.current
    if (!root) return

    const measure = () => {
      const rb = root.getBoundingClientRect()
      const nodes = Array.from(
        root.querySelectorAll<HTMLElement>('[data-node]'),
      ).map((el) => {
        const r = el.getBoundingClientRect()
        return {
          x: r.left - rb.left,
          y: r.top - rb.top,
          w: r.width,
          h: r.height,
        }
      })

      const next: string[] = []
      const ends: { x: number; y: number }[] = []

      // How far the run reaches past the content measure. Wide screens leave
      // the section's margins empty; carrying the trace out to the section
      // edge makes them read as part of the board.
      const BLEED = 900
      for (let i = 0; i < nodes.length - 1; i++) {
        const a = nodes[i]
        const b = nodes[i + 1]

        // A node that starts past the previous node's right edge is beside
        // it; anything else has wrapped underneath.
        if (b.x > a.x + a.w - 1) {
          const x1 = a.x + a.w
          const y1 = a.y + a.h / 2
          const x2 = b.x
          const y2 = b.y + b.h / 2
          const mx = (x1 + x2) / 2
          next.push(`M${x1} ${y1} H${mx} V${y2} H${x2}`)
          ends.push({ x: x1, y: y1 }, { x: x2, y: y2 })
        } else {
          const x1 = a.x + a.w / 2
          const y1 = a.y + a.h
          const x2 = b.x + b.w / 2
          const y2 = b.y
          const my = (y1 + y2) / 2
          next.push(`M${x1} ${y1} V${my} H${x2} V${y2}`)
          ends.push({ x: x1, y: y1 }, { x: x2, y: y2 })
        }
      }
      // Lead-in and lead-out along the horizontal run at the head of the
      // chain, so the row is wired to the page edges rather than floating.
      let lastAcross = 0
      while (
        lastAcross + 1 < nodes.length &&
        nodes[lastAcross + 1].x > nodes[lastAcross].x + nodes[lastAcross].w - 1
      ) {
        lastAcross++
      }

      if (lastAcross > 0) {
        const first = nodes[0]
        const last = nodes[lastAcross]
        next.unshift(`M${-BLEED} ${first.y + first.h / 2} H${first.x}`)
        ends.push({ x: first.x, y: first.y + first.h / 2 })
        next.push(
          `M${last.x + last.w} ${last.y + last.h / 2} H${rb.width + BLEED}`,
        )
        ends.push({ x: last.x + last.w, y: last.y + last.h / 2 })
      }

      setPaths(next)
      setPads(ends)
    }

    measure()
    // Type reflows after the display face swaps in, which moves every node.
    document.fonts?.ready.then(measure).catch(() => {})

    const ro = new ResizeObserver(measure)
    ro.observe(root)
    root.querySelectorAll('[data-node]').forEach((n) => ro.observe(n))
    return () => ro.disconnect()
  }, [containerRef])

  // The board wires itself up as you scroll through it. Scrubbed, so the
  // trace tracks the reader rather than playing on its own clock -- the pulse
  // is the part that has its own clock.
  useLayoutEffect(() => {
    if (paths.length === 0) return
    return scrollScene(svgRef.current, () => {
      gsap.fromTo(
        '[data-trace]',
        { strokeDashoffset: 100 },
        {
          strokeDashoffset: 0,
          ease: 'none',
          stagger: 0.2,
          scrollTrigger: {
            trigger: svgRef.current,
            start: 'top 88%',
            end: 'bottom 65%',
            scrub: 0.7,
          },
        }
      )
    })
  }, [paths])

  if (paths.length === 0) return null

  const still = prefersReducedMotion()

  return (
    <svg
      ref={svgRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full overflow-visible"
    >
      {paths.map((d, i) => (
        <g key={d}>
          <path
            data-trace
            d={d}
            fill="none"
            stroke="rgba(0,255,135,0.34)"
            strokeWidth="1"
            strokeLinecap="square"
            pathLength={100}
            strokeDasharray="100"
          />
          {!still && (
            <path
              d={d}
              fill="none"
              stroke="#00FF87"
              strokeWidth="1.5"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray="7 93"
              style={{
                animation: `trace-pulse ${SEGMENT_SECONDS}s linear infinite`,
                animationDelay: `${i * SEGMENT_SECONDS}s`,
                filter: 'drop-shadow(0 0 5px rgba(0,255,135,0.9))',
              }}
            />
          )}
        </g>
      ))}

      {/* Solder pads where a trace meets a card. Without them the elbow in a
          40px gutter reads as a stray tick rather than a join. */}
      {pads.map((p) => (
        <rect
          key={`${p.x}:${p.y}`}
          x={p.x - 2}
          y={p.y - 2}
          width="4"
          height="4"
          fill="#00FF87"
          opacity="0.75"
        />
      ))}
    </svg>
  )
}

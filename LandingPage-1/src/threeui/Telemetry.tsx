/* Ported from threeui  the three isometric canvases inside
   src/shaders/neuform-isolated/sources/diagnostics-panel.html (MIT).

   The upstream file is a standalone document that pulls Tailwind, Iconify and
   GSAP off three CDNs and renders inside a sandboxed iframe. Only the drawing
   code is worth having, so the renderers are lifted verbatim in shape and the
   surrounding page is rebuilt in this project's own markup.

   Three fixes on the way across, all of which the iframe could get away with
   and a long-lived page cannot:
   - `ctx.scale(dpr, dpr)` compounds on every resize upstream. setTransform.
   - the RAF loops are never cancelled. They are here, on unmount.
   - the canvases run forever, off-screen and under reduced motion. They now
     stop when out of view or hidden, and paint one still frame when the user
     has asked for less motion. */

import { useEffect, useRef } from 'react'

type Point = { x: number; y: number }
type RenderFn = (ctx: CanvasRenderingContext2D, time: number) => void

/** Upstream's projection: 30° isometric, y stays vertical. */
const projectIso = (x: number, y: number, z: number): Point => {
  const angle = Math.PI / 6
  return { x: (x - z) * Math.cos(angle), y: y + (x + z) * Math.sin(angle) }
}

const ACCENT = '0,255,135'
const VOID = '#050b07'

/** Time the still frame lands on for reduced motion  past the settle, so the
 *  shape reads as designed rather than as its t=0 degenerate case. */
const STILL_FRAME_TIME = 2.4

function useIsoCanvas(render: RenderFn) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderRef = useRef(render)
  renderRef.current = render

  useEffect(() => {
    const canvas = canvasRef.current
    const host = canvas?.parentElement
    if (!canvas || !host) return

    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reduced = motionQuery.matches
    let visible = true
    let frame = 0
    let time = 0
    let width = 0
    let height = 0

    const paint = () => {
      // setTransform, not scale  scale multiplies into whatever is already
      // on the matrix, so a second resize would double the device ratio.
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.save()
      ctx.translate(width / 2, height / 2 + 5)
      renderRef.current(ctx, reduced ? STILL_FRAME_TIME : time)
      ctx.restore()
    }

    const resize = () => {
      const rect = host.getBoundingClientRect()
      width = rect.width
      height = rect.height
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      paint()
    }

    const loop = () => {
      frame = 0
      time += 0.015
      paint()
      schedule()
    }

    function schedule() {
      if (reduced || !visible || document.hidden || frame) return
      frame = window.requestAnimationFrame(loop)
    }

    const sync = () => {
      if (reduced || !visible || document.hidden) {
        if (frame) window.cancelAnimationFrame(frame)
        frame = 0
        paint()
        return
      }
      schedule()
    }

    const onMotionChange = (event: MediaQueryListEvent) => {
      reduced = event.matches
      sync()
    }

    const resizeObserver = new ResizeObserver(resize)
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true
      sync()
    })

    resizeObserver.observe(host)
    intersectionObserver.observe(host)
    document.addEventListener('visibilitychange', sync)
    motionQuery.addEventListener('change', onMotionChange)
    resize()
    sync()

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      document.removeEventListener('visibilitychange', sync)
      motionQuery.removeEventListener('change', onMotionChange)
    }
  }, [])

  return canvasRef
}

/* ---------- the three renderers, upstream's geometry ---------------------- */

/** Stacked planes with a hatched read-out on the top face. */
const drawLayers: RenderFn = (ctx, t) => {
  const size = 42
  const layers = 5
  const gap = 20
  ctx.lineWidth = 1

  for (let i = layers - 1; i >= 0; i -= 1) {
    const yOff = i * gap - (layers * gap) / 2 + Math.sin(t + i * 0.4) * 4
    const p1 = projectIso(-size, yOff, -size)
    const p2 = projectIso(size, yOff, -size)
    const p3 = projectIso(size, yOff, size)
    const p4 = projectIso(-size, yOff, size)

    ctx.beginPath()
    ctx.moveTo(p1.x, p1.y)
    ctx.lineTo(p2.x, p2.y)
    ctx.lineTo(p3.x, p3.y)
    ctx.lineTo(p4.x, p4.y)
    ctx.closePath()
    ctx.fillStyle = VOID
    ctx.fill()
    ctx.strokeStyle = i === 0 ? `rgba(${ACCENT},0.8)` : `rgba(${ACCENT},0.15)`
    ctx.stroke()

    if (i === 0) {
      ctx.save()
      const center = projectIso(0, yOff, 0)
      ctx.translate(center.x, center.y)
      ctx.scale(1, 0.5)
      const inner = size * 0.55
      ctx.beginPath()
      ctx.rect(-inner, -inner, inner * 2, inner * 2)
      ctx.strokeStyle = `rgba(${ACCENT},0.4)`
      ctx.stroke()
      ctx.clip()
      for (let j = -inner; j < inner; j += 4) {
        ctx.beginPath()
        ctx.moveTo(-inner, j)
        ctx.lineTo(inner, j)
        ctx.strokeStyle = `rgba(${ACCENT},0.2)`
        ctx.stroke()
      }
      ctx.restore()
    }

    if (i < layers - 1) {
      const nextY = (i + 1) * gap - (layers * gap) / 2 + Math.sin(t + (i + 1) * 0.4) * 4
      const p1Next = projectIso(-size, nextY, -size)
      const p3Next = projectIso(size, nextY, size)
      ctx.beginPath()
      ctx.setLineDash([2, 2])
      ctx.moveTo(p1.x, p1.y)
      ctx.lineTo(p1Next.x, p1Next.y)
      ctx.moveTo(p3.x, p3.y)
      ctx.lineTo(p3Next.x, p3Next.y)
      ctx.strokeStyle = `rgba(${ACCENT},0.1)`
      ctx.stroke()
      ctx.setLineDash([])
    }
  }
}

const drawCube = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  z: number,
  s: number,
  color: string
) => {
  const pts = [
    projectIso(x - s, y - s, z - s),
    projectIso(x + s, y - s, z - s),
    projectIso(x + s, y - s, z + s),
    projectIso(x - s, y - s, z + s),
    projectIso(x - s, y + s, z - s),
    projectIso(x + s, y + s, z - s),
    projectIso(x + s, y + s, z + s),
    projectIso(x - s, y + s, z + s),
  ]
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  ctx.lineTo(pts[1].x, pts[1].y)
  ctx.lineTo(pts[2].x, pts[2].y)
  ctx.lineTo(pts[3].x, pts[3].y)
  ctx.closePath()
  ctx.moveTo(pts[4].x, pts[4].y)
  ctx.lineTo(pts[5].x, pts[5].y)
  ctx.lineTo(pts[6].x, pts[6].y)
  ctx.lineTo(pts[7].x, pts[7].y)
  ctx.closePath()
  for (let i = 0; i < 4; i += 1) {
    ctx.moveTo(pts[i].x, pts[i].y)
    ctx.lineTo(pts[i + 4].x, pts[i + 4].y)
  }
  ctx.stroke()
}

/** Four outer wireframe cells orbiting one lit core. */
const drawNodes: RenderFn = (ctx, t) => {
  const s = 22
  const float = Math.sin(t) * 4
  const dim = `rgba(${ACCENT},0.15)`
  drawCube(ctx, -35, -float, -35, s, dim)
  drawCube(ctx, 35, float, -35, s, dim)
  drawCube(ctx, -35, float, 35, s, dim)
  drawCube(ctx, 35, -float, 35, s, dim)
  drawCube(ctx, 0, Math.cos(t) * 6 - 15, 0, s * 0.9, `rgba(${ACCENT},0.6)`)
}

/** A displaced grid  a peak at the centre with a travelling ripple. */
const drawFlow: RenderFn = (ctx, t) => {
  const size = 65
  const segments = 22
  const step = (size * 2) / segments
  ctx.lineWidth = 1

  const heightAt = (x: number, z: number) => {
    const dist = Math.sqrt(x * x + z * z)
    const peak = Math.max(0, 45 - dist * 1.1)
    const wave = Math.sin(x * 0.2 + t * 1.5) * Math.cos(z * 0.2 + t * 1.5) * 5
    return -peak - wave + 15
  }

  for (let z = -size; z < size; z += step) {
    for (let x = -size; x < size; x += step) {
      const p1 = projectIso(x, heightAt(x, z), z)
      const p2 = projectIso(x + step, heightAt(x + step, z), z)
      const p3 = projectIso(x + step, heightAt(x + step, z + step), z + step)
      const p4 = projectIso(x, heightAt(x, z + step), z + step)

      ctx.beginPath()
      ctx.moveTo(p1.x, p1.y)
      ctx.lineTo(p2.x, p2.y)
      ctx.lineTo(p3.x, p3.y)
      ctx.lineTo(p4.x, p4.y)
      ctx.closePath()
      ctx.fillStyle = VOID
      ctx.fill()

      const ratio = Math.max(0, -heightAt(x, z) / 30)
      const alpha = 0.05 + ratio * 0.4
      ctx.strokeStyle =
        ratio > 0.6 ? `rgba(${ACCENT},${alpha + 0.3})` : `rgba(${ACCENT},${alpha + 0.05})`
      ctx.stroke()
    }
  }
}

/* ---------- the panel ----------------------------------------------------- */

const PANELS = [
  {
    id: 'depth',
    render: drawLayers,
    title: 'Order book depth',
    body: 'Every entrant trades the same instruments on the same feed. No private liquidity, no side pockets.',
  },
  {
    id: 'nodes',
    render: drawNodes,
    title: 'Account isolation',
    body: 'One $10,000 demo account per trader, sealed from the rest. Your book is yours alone.',
  },
  {
    id: 'surface',
    render: drawFlow,
    title: 'Volatility surface',
    body: 'Live market conditions for the full twelve days. The board moves because the market does.',
  },
] as const

function Panel({ render, title, body }: (typeof PANELS)[number]) {
  const canvasRef = useIsoCanvas(render)

  return (
    <article className="relative flex flex-col bg-[#080a09]/60 p-7">
      {/* Hairline that fades out downward  the detail that makes the three
          cells read as one instrument rather than three boxes. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(0,255,135,0.35),transparent)]"
      />

      <header className="flex items-center gap-3 font-mono text-nano uppercase text-muted">
        <span className="size-1.5 rounded-full bg-[#00FF87] [animation:rail-pulse_2.4s_ease-in-out_infinite]" />
        {title}
      </header>

      <div className="relative mt-8 h-44 w-full">
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
      </div>

      <p className="mt-8 text-body text-muted">{body}</p>
    </article>
  )
}

export function Telemetry({ className = '' }: { className?: string }) {
  return (
    <div
      className={`grid gap-px overflow-hidden rounded-2xl border border-[rgba(0,255,135,0.14)] bg-[rgba(0,255,135,0.10)] md:grid-cols-3 ${className}`}
    >
      {PANELS.map((panel) => (
        <Panel key={panel.id} {...panel} />
      ))}
    </div>
  )
}

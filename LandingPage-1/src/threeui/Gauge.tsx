/* Ported from threeui  the dial engine inside
   src/shaders/neuform-isolated/sources/performance-gauges.html (MIT).

   Upstream builds four automotive instruments by hand-rolling DOM inside a
   sandboxed iframe. The geometry is spec-driven and worth keeping, so the
   polar helpers (`angleFor`, ticks, numerals, the conic zone band) and the
   self-test sweep sequence come across as they are, and the DOM building
   becomes JSX. The instrument reads balance growth instead of engine speed. */

import { useEffect, useRef, useState } from 'react'

import './gauge.css'

type Zone = { from: number; to: number; color: string }

type GaugeSpec = {
  start: number
  sweep: number
  min: number
  max: number
  majorStep: number
  minorPerMajor: number
  zones: readonly Zone[]
  tickColor: (value: number) => string
  /** Colour of the arc that fills behind the needle as it sweeps. */
  progress: string
  /** Where the needle rests before the reading arrives. */
  idle: number
  /** The live reading it settles on. */
  value: number
  readout: (value: number) => string
}

/** A twelve-day league read as an instrument: percent balance growth,
 *  redline replaced by a green band where the leaderboard actually starts. */
const GROWTH: GaugeSpec = {
  start: -135,
  sweep: 270,
  min: 0,
  max: 200,
  majorStep: 25,
  minorPerMajor: 5,
  zones: [
    { from: 0, to: 150, color: 'rgba(255,255,255,.09)' },
    { from: 150, to: 200, color: 'rgba(0,255,135,.55)' },
  ],
  tickColor: (value) => (value >= 150 ? 'rgba(0,255,135,.95)' : 'rgba(255,255,255,.6)'),
  progress: '#00FF87',
  idle: 0,
  value: 142,
  readout: (value) => String(Math.round(value)),
}

/* ---------- polar helpers, upstream's ------------------------------------ */

const angleFor = (spec: Pick<GaugeSpec, 'start' | 'sweep' | 'min' | 'max'>, value: number) =>
  spec.start + ((value - spec.min) / (spec.max - spec.min)) * spec.sweep

const arcGradient = (spec: GaugeSpec, segments: readonly Zone[]) =>
  segments
    .map((segment) => {
      const from = angleFor(spec, segment.from)
      const span = ((segment.to - segment.from) / (spec.max - spec.min)) * spec.sweep
      return `conic-gradient(from ${from}deg, ${segment.color} 0deg, ${segment.color} ${span}deg, transparent ${span}deg)`
    })
    .join(', ')

/** The band and the progress arc are both rings cut out of a full-bleed
 *  conic gradient  this is the cut. */
const RING_MASK =
  'radial-gradient(closest-side, transparent 88%, #000 89%, #000 95.5%, transparent 96.5%)'

function ticksFor(spec: GaugeSpec) {
  const step = spec.majorStep / spec.minorPerMajor
  const count = Math.round((spec.max - spec.min) / step)
  return Array.from({ length: count + 1 }, (_, index) => {
    const value = spec.min + index * step
    return { value, angle: angleFor(spec, value), major: index % spec.minorPerMajor === 0 }
  })
}

function numeralsFor(spec: GaugeSpec) {
  const count = Math.round((spec.max - spec.min) / spec.majorStep)
  return Array.from({ length: count + 1 }, (_, index) => {
    const value = Math.round((spec.min + index * spec.majorStep) * 1000) / 1000
    return { value, angle: angleFor(spec, value) }
  })
}

/* ---------- the self-test sequence --------------------------------------- */

/** Upstream's instrument sequence: full-scale sweep, fall back to rest, then
 *  settle on the live reading  the self-test a real dial runs at power-on. */
const SEQUENCE = [
  { at: 0, to: 'max', duration: 1100 },
  { at: 1350, to: 'idle', duration: 900 },
  { at: 2500, to: 'value', duration: 1200 },
] as const

const FLUTTER_AT = 3900
const CYCLE_MS = 8000

export function Gauge({
  spec = GROWTH,
  label = 'Balance growth',
  unit = 'percent',
  className = '',
}: {
  spec?: GaugeSpec
  label?: string
  unit?: string
  className?: string
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const needleRef = useRef<HTMLDivElement>(null)
  const flutterRef = useRef<HTMLDivElement>(null)
  const arcRef = useRef<HTMLDivElement>(null)
  const [readout, setReadout] = useState(() => spec.readout(spec.idle))

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timers: ReturnType<typeof setTimeout>[] = []
    let interval: ReturnType<typeof setInterval> | undefined
    let frame = 0

    const sweepTo = (value: number, duration: number) => {
      const needle = needleRef.current
      if (needle) {
        needle.style.setProperty('--needle-duration', `${duration}ms`)
        needle.style.setProperty('--angle', `${angleFor(spec, value)}deg`)
      }
      const arc = arcRef.current
      if (arc) {
        arc.style.background = arcGradient(spec, [
          { from: spec.min, to: Math.max(spec.min, value), color: spec.progress },
        ])
      }
    }

    const countTo = (from: number, to: number, duration: number) => {
      if (frame) cancelAnimationFrame(frame)
      if (duration === 0) {
        setReadout(spec.readout(to))
        return
      }
      const started = performance.now()
      const step = (now: number) => {
        const progress = Math.min(1, (now - started) / duration)
        const eased = 1 - Math.pow(1 - progress, 3)
        setReadout(spec.readout(from + (to - from) * eased))
        frame = progress < 1 ? requestAnimationFrame(step) : 0
      }
      frame = requestAnimationFrame(step)
    }

    if (reduced) {
      sweepTo(spec.value, 0)
      countTo(spec.value, spec.value, 0)
      return
    }

    const stops = { max: spec.max, idle: spec.idle, value: spec.value }

    const cycle = () => {
      // Every timer from the previous cycle has fired by now (the last one at
      // FLUTTER_AT, well inside CYCLE_MS), so the list can start clean rather
      // than growing for as long as the page is open.
      timers.length = 0
      flutterRef.current?.removeAttribute('data-live')
      let previous = spec.idle
      for (const stage of SEQUENCE) {
        const target = stops[stage.to]
        const from = previous
        previous = target
        const run = () => {
          sweepTo(target, stage.duration)
          countTo(from, target, stage.duration)
        }
        if (stage.at === 0) run()
        else timers.push(setTimeout(run, stage.at))
      }
      timers.push(
        setTimeout(() => flutterRef.current?.setAttribute('data-live', ''), FLUTTER_AT)
      )
    }

    const stop = () => {
      timers.forEach(clearTimeout)
      timers.length = 0
      if (interval) clearInterval(interval)
      interval = undefined
      if (frame) cancelAnimationFrame(frame)
      frame = 0
    }

    // A self-test nobody is looking at is just a timer. The sequence starts
    // when the dial scrolls into view and stops again when it leaves.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          if (interval) return
          cycle()
          interval = setInterval(cycle, CYCLE_MS)
        } else {
          stop()
        }
      },
      { threshold: 0.25 }
    )
    observer.observe(host)

    return () => {
      observer.disconnect()
      stop()
    }
  }, [spec])

  const ticks = ticksFor(spec)
  const numerals = numeralsFor(spec)

  return (
    <div
      ref={hostRef}
      className={`gauge ${className}`}
      role="img"
      aria-label={`${label}: leaders are running past ${spec.value} ${unit}`}
    >
      <div className="gauge__plate" />

      {/* Four counterbored screws, each turned to its own angle so the heads
          do not read as four copies of one sprite. */}
      {[
        { top: '4.2cqw', left: '4.2cqw', a: '18deg' },
        { top: '4.2cqw', right: '4.2cqw', a: '-34deg' },
        { bottom: '4.2cqw', left: '4.2cqw', a: '61deg' },
        { bottom: '4.2cqw', right: '4.2cqw', a: '-12deg' },
      ].map((screw, index) => {
        const { a, ...position } = screw
        return (
          <i
            key={index}
            aria-hidden
            className="gauge__screw"
            style={{ ...position, ['--a' as string]: a }}
          />
        )
      })}

      <div className="gauge__shell">
        <div className="gauge__bezel">
          <div className="gauge__face">
            {/* Machine-turned guilloché under everything else. */}
            <div
              className="gauge__layer"
              style={{
                background:
                  'repeating-conic-gradient(from 0deg, rgba(255,255,255,.045) 0deg 1.2deg, rgba(0,0,0,.05) 1.2deg 2.4deg)',
                WebkitMaskImage:
                  'radial-gradient(closest-side, #000 0%, #000 58%, transparent 66%)',
                maskImage: 'radial-gradient(closest-side, #000 0%, #000 58%, transparent 66%)',
                opacity: 0.6,
              }}
            />

            {/* Zone band: white up to the qualifying line, green past it. */}
            <div
              className="gauge__layer"
              style={{
                background: arcGradient(spec, spec.zones),
                WebkitMaskImage: RING_MASK,
                maskImage: RING_MASK,
              }}
            />

            {/* Progress arc, filled in behind the needle as it sweeps. */}
            <div
              ref={arcRef}
              className="gauge__layer"
              style={{ WebkitMaskImage: RING_MASK, maskImage: RING_MASK, opacity: 0.85 }}
            />

            <div className="gauge__layer">
              {ticks.map((tick) => (
                <div
                  key={`t${tick.value}`}
                  className="gauge__spoke"
                  style={{ transform: `rotate(${tick.angle}deg)` }}
                >
                  <i
                    className={`gauge__tick gauge__tick--${tick.major ? 'major' : 'minor'}`}
                    style={{ background: spec.tickColor(tick.value) }}
                  />
                </div>
              ))}
            </div>

            <div className="gauge__layer">
              {numerals.map((numeral) => (
                <div
                  key={`n${numeral.value}`}
                  className="gauge__spoke"
                  style={{ transform: `rotate(${numeral.angle}deg)` }}
                >
                  <span
                    className="gauge__numeral"
                    style={{ transform: `translateX(-50%) rotate(${-numeral.angle}deg)` }}
                  >
                    {numeral.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="gauge__stack" style={{ top: '30%' }}>
              <span className="gauge__cap">{label.toUpperCase()}</span>
              <span className="gauge__readout tabular">{readout}</span>
              <span className="gauge__cap gauge__cap--sm">% GAIN</span>
            </div>

            <div
              ref={needleRef}
              className="gauge__needle"
              style={{
                ['--angle' as string]: `${angleFor(spec, spec.idle)}deg`,
                ['--needle-ease' as string]: 'cubic-bezier(.16,1.28,.4,1)',
              }}
            >
              <div ref={flutterRef} className="gauge__flutter">
                <i className="gauge__blade" />
                <i className="gauge__tail" />
              </div>
            </div>

            <div className="gauge__hub" />
            <div className="gauge__grain" />
            <div className="gauge__glass" />
            <div className="gauge__dust" />
          </div>
        </div>
      </div>
    </div>
  )
}

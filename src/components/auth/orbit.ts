/**
 * The confirmation code's answer, told as one turn.
 *
 * The six boxes curl off their row onto a ring, the ring winds up and turns a
 * turn and a quarter while the server is asked, and then it either goes green
 * and screws down into a single verified tile, or unwinds back into the row
 * carrying a red edge.
 *
 * The turn itself is two keyframes and no maths: move the row's
 * `transform-origin` to the hub and a plain `rotate()` draws the circle. The
 * tiles are not counter-rotated, so they tumble with the ring -- that tumble is
 * what stops it reading as a spinner with numbers glued to it.
 *
 * Web Animations rather than CSS keyframes: the turn has to be interrupted at
 * an unknown moment, whenever the server answers, and picked up from whatever
 * angle it had reached by then. A keyframe cannot be asked where it got to.
 */

/** The site's ease-out, matching EASE in lib/motion.ts. */
const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)'

/** Winds up slowly, carries speed, brakes hard -- a flywheel, not a fade. */
const WIND_UP_BRAKE = 'cubic-bezier(0.77, 0, 0.175, 1)'

const CURL_MS = 420
const CURL_STAGGER = 26
const TURN_MS = 800
/** A turn and a quarter, so it lands somewhere other than where it started. */
const TURN_DEG = 450
/** Only reached when the server is slower than the wind-up. */
const HOLD_TURN_MS = 1100
const VERDICT_MS = 240
const COLLAPSE_MS = 360
const LAND_MS = 280
/** How long the verified tile is held before the caller moves the page on. */
const LAND_HOLD_MS = 520
const UNWIND_MS = 340

/** Six tiles need a lot more room on a ring than four do, so they shrink
 *  harder than the reel's four did to keep the ring inside the card. */
const TILE_SCALE = 0.62

/** Gap between tile centres on the ring, as a multiple of a tile. Below about
 *  1.4 the six touch and the ring reads as a blob. */
const SEAT_SPACING = 1.45

export type OrbitPhase = 'idle' | 'turning' | 'ok' | 'fail'

export type OrbitParts = {
  /** The row of boxes. Rotating this is what makes the tiles orbit. */
  grid: HTMLElement
  /** The dotted track. Sized and placed here, not in the markup. */
  ring: SVGSVGElement
  /** The point everything turns around, and collapses into. */
  hub: HTMLElement
  /** The single tile the six become. */
  landed: HTMLElement
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** The angle a running rotation has actually reached, so the next animation
 *  can start from there instead of snapping back to its fill value. */
function currentAngle(el: HTMLElement): number {
  const { transform } = getComputedStyle(el)
  if (!transform || transform === 'none') return 0
  const m = new DOMMatrixReadOnly(transform)
  return (Math.atan2(m.b, m.a) * 180) / Math.PI
}

/**
 * Plays the turn while `answer` is in flight, and resolves once the outcome
 * has been told. `setPhase` drives the colour, which is CSS's job: green is
 * only ever set after the answer is known.
 */
export async function runOrbit(
  parts: OrbitParts,
  answer: Promise<boolean>,
  setPhase: (p: OrbitPhase) => void
): Promise<void> {
  const { grid, ring, hub, landed } = parts
  const tiles = Array.from(grid.children) as HTMLElement[]
  const n = tiles.length
  if (n === 0) {
    await answer
    return
  }

  // Measured before anything moves, so these are the layout positions.
  const box = grid.getBoundingClientRect()
  const first = tiles[0].getBoundingClientRect()
  const hubX = box.width / 2
  const hubY = box.height / 2

  // Radius from the tiles rather than a constant: six boxes on a phone are
  // narrower than six on a laptop, and the ring has to keep them off each
  // other either way.
  const span = Math.max(first.width, first.height) * TILE_SCALE
  const radius = (n * span * SEAT_SPACING) / (2 * Math.PI)

  // Index 0 takes the left of the ring and the rest follow clockwise, so the
  // row keeps its reading order as it curls.
  const seats = tiles.map((tile, i) => {
    const t = tile.getBoundingClientRect()
    const cx = t.left - box.left + t.width / 2
    const cy = t.top - box.top + t.height / 2
    const theta = Math.PI + (i * 2 * Math.PI) / n
    const dx = hubX + radius * Math.cos(theta) - cx
    const dy = hubY + radius * Math.sin(theta) - cy
    return {
      out: `translate(${dx}px, ${dy}px) scale(${TILE_SCALE})`,
      home: `translate(${hubX - cx}px, ${hubY - cy}px) scale(0.5)`,
    }
  })

  // The ring and the hub are placed from the same numbers the seats came from,
  // so the track always passes through the middle of every tile.
  ring.style.width = `${radius * 2}px`
  ring.style.height = `${radius * 2}px`
  ring.style.left = `${hubX - radius}px`
  ring.style.top = `${hubY - radius}px`
  hub.style.left = `${hubX}px`
  hub.style.top = `${hubY}px`
  landed.style.left = `${hubX}px`
  landed.style.top = `${hubY}px`

  setPhase('turning')

  // 1. Curl. Each tile leaves the row a beat after the one before it, so the
  //    row peels onto the ring rather than snapping onto it.
  const curls = tiles.map((tile, i) =>
    tile.animate([{ transform: 'none' }, { transform: seats[i].out }], {
      duration: CURL_MS,
      delay: i * CURL_STAGGER,
      easing: EASE_OUT,
      fill: 'forwards',
    })
  )
  const fadeIn = { duration: CURL_MS, easing: EASE_OUT, fill: 'forwards' } as const
  ring.animate([{ opacity: 0 }, { opacity: 1 }], fadeIn)
  hub.animate([{ opacity: 0 }, { opacity: 1 }], fadeIn)
  await Promise.all(curls.map((a) => a.finished))

  // 2. The turn. One rotation on the parent moves all six, which is what makes
  //    it interruptible: there is a single animation to stop.
  grid.style.transformOrigin = `${hubX}px ${hubY}px`
  const turn = grid.animate(
    [{ transform: 'rotate(0deg)' }, { transform: `rotate(${TURN_DEG}deg)` }],
    { duration: TURN_MS, easing: WIND_UP_BRAKE, fill: 'forwards' }
  )

  // The wind-up always plays out. Racing it against the answer would mean a
  // fast server -- the normal case -- cuts the turn off before it has visibly
  // moved, which is the whole thing gone. The answer only decides whether a
  // hold is needed after it.
  let settled = false
  const outcome = answer.then((v) => {
    settled = true
    return v
  })
  await turn.finished

  let ok: boolean
  if (settled) {
    ok = await outcome
  } else {
    // Slower than the wind-up: keep turning at a constant rate rather than
    // freezing mid-orbit, because a stopped ring reads as a finished request.
    const hold = grid.animate(
      [
        { transform: `rotate(${TURN_DEG}deg)` },
        { transform: `rotate(${TURN_DEG + 360}deg)` },
      ],
      { duration: HOLD_TURN_MS, easing: 'linear', iterations: Infinity }
    )
    ok = await outcome
    // Pin the angle it actually reached before dropping the loop, or the tiles
    // jump back to wherever the wind-up left them.
    const at = currentAngle(grid)
    hold.cancel()
    grid.style.transform = `rotate(${at}deg)`
  }

  // 3. The verdict, and only now. Green is what an answered code earns.
  setPhase(ok ? 'ok' : 'fail')
  await wait(VERDICT_MS)

  if (!ok) {
    // 4a. Unwind: back down the way it came, so the row it returns to is
    //     obviously the row it left.
    const back = tiles.map((tile) =>
      tile.animate([{ transform: 'none' }], {
        duration: UNWIND_MS,
        easing: EASE_OUT,
        fill: 'forwards',
      })
    )
    grid.animate([{ transform: 'rotate(0deg)' }], {
      duration: UNWIND_MS,
      easing: EASE_OUT,
      fill: 'forwards',
    })
    const fadeOut = { duration: UNWIND_MS, fill: 'forwards' } as const
    ring.animate([{ opacity: 0 }], fadeOut)
    hub.animate([{ opacity: 0 }], fadeOut)
    await Promise.all(back.map((a) => a.finished))
    return
  }

  // 4b. Screw down: the six converge on the hub, still carrying the ring's
  //     angle, and go out as the one tile arrives.
  const collapse = tiles.map((tile, i) =>
    tile.animate(
      [
        { transform: seats[i].out, opacity: 1 },
        { transform: seats[i].home, opacity: 0 },
      ],
      { duration: COLLAPSE_MS, easing: WIND_UP_BRAKE, fill: 'forwards' }
    )
  )
  ring.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(0.7)' }], {
    duration: COLLAPSE_MS,
    easing: WIND_UP_BRAKE,
    fill: 'forwards',
  })
  await Promise.all(collapse.map((a) => a.finished))

  // 5. The tile that is left. Never from scale(0): nothing appears out of
  //    nothing, so it arrives small and settles.
  hub.animate([{ opacity: 0 }], { duration: LAND_MS, fill: 'forwards' })
  await landed.animate(
    [
      { opacity: 0, transform: 'translate(-50%, -50%) scale(0.55)' },
      { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
    ],
    { duration: LAND_MS, easing: EASE_OUT, fill: 'forwards' }
  ).finished
  await wait(LAND_HOLD_MS)
}

/** Puts the row back the way it was found. Safe to call at any point, and the
 *  only cleanup a caller needs after a run that did not verify. */
export function resetOrbit(parts: OrbitParts): void {
  const { grid, ring, hub, landed } = parts
  const all = [grid, ring, hub, landed, ...Array.from(grid.children)]
  for (const el of all) {
    for (const a of el.getAnimations()) a.cancel()
  }
  grid.style.transformOrigin = ''
  grid.style.transform = ''
}

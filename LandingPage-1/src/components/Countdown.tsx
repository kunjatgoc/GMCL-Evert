import { useEffect, useState } from 'react'

/** Entries close at the end of 6 September; the board opens on the 7th. */
export const ENTRY_CLOSE = new Date('2026-09-06T23:59:59+05:30')

const UNITS = ['Days', 'Hrs', 'Min', 'Sec'] as const

function remaining(target: Date): [number, number, number, number] {
  const s = Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000))
  return [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60]
}

const pad = (n: number) => String(n).padStart(2, '0')

type Props = {
  className?: string
}

/**
 * Ticking clock to the entry deadline. The digits are aria-hidden and a
 * static sentence carries the deadline for assistive tech  a per-second
 * live region would read the whole page out from under the user.
 */
export function Countdown({ className = '' }: Props) {
  const [parts, setParts] = useState(() => remaining(ENTRY_CLOSE))

  useEffect(() => {
    const id = window.setInterval(() => setParts(remaining(ENTRY_CLOSE)), 1000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className={`grid grid-cols-4 gap-2 ${className}`}>
      <span className="sr-only">Entries close on 6 September.</span>
      {parts.map((v, i) => (
        <div
          key={UNITS[i]}
          aria-hidden
          className="rounded-lg border border-white/8 bg-white/[0.03] px-1 py-2.5 text-center"
        >
          <span className="tabular block font-mono text-h3 font-medium text-white">
            {pad(v)}
          </span>
          <span className="mt-1.5 block text-nano uppercase text-muted">
            {UNITS[i]}
          </span>
        </div>
      ))}
    </div>
  )
}

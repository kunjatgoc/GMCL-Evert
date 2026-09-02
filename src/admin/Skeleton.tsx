import { useEffect, useState } from 'react'
import { motion } from 'motion/react'

/**
 * Loading placeholders.
 *
 * A spinner says "something is happening". A skeleton says "this is what is
 * arriving, and here is where it will sit" -- which is why NN/g reserves
 * spinners for a single module and skeletons for a whole screen whose layout
 * is already known. Every loading state in this panel has a known layout.
 *
 * The shimmer is a motion element rather than a CSS keyframe on purpose: the
 * stylesheet is shared with the marketing page, and this belongs to the admin
 * chunk alone.
 */

/** Nothing renders for the first `ms`. A placeholder that flashes for 200ms
 *  makes a fast panel feel broken, so a quick response shows no loader at
 *  all. */
export function useDelayed(ms = 400): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), ms)
    return () => clearTimeout(t)
  }, [ms])
  return ready
}

export function Shimmer({ className = '' }: { className?: string }) {
  return (
    <span
      className={`relative block overflow-hidden rounded-lg bg-white/[0.045] ${className}`}
    >
      <motion.span
        aria-hidden
        className="absolute inset-y-0 -left-full block w-full bg-[linear-gradient(90deg,transparent,rgba(0,255,135,0.16),transparent)]"
        animate={{ x: ['0%', '300%'] }}
        transition={{ duration: 1.5, ease: 'linear', repeat: Infinity }}
      />
    </span>
  )
}

/** Four stat cards and the ranking panel under them, at the real sizes so
 *  nothing shifts when the numbers land. */
export function StatsSkeleton() {
  return (
    <section aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading dashboard</span>

      <Shimmer className="h-[3.1rem] w-[19rem] max-w-full rounded-xl" />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="glass glass-lip relative overflow-hidden rounded-2xl bg-[var(--admin-card)] p-5"
          >
            <div className="flex items-center gap-2.5">
              <Shimmer className="size-8 rounded-lg" />
              <Shimmer className="h-3.5 w-28" />
            </div>
            <Shimmer className="mt-5 h-11 w-32 rounded-xl" />
            <Shimmer className="mt-3 h-3.5 w-40" />
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <div className="glass glass-lip relative overflow-hidden rounded-2xl bg-[var(--admin-card)] p-6">
          <Shimmer className="h-5 w-40" />
          <Shimmer className="mt-9 h-56 w-full rounded-xl" />
          <div className="mt-2 flex justify-between">
            <Shimmer className="h-3 w-16" />
            <Shimmer className="h-3 w-16" />
          </div>
        </div>

        <div className="glass glass-lip relative overflow-hidden rounded-2xl bg-[var(--admin-card)] p-6">
          <Shimmer className="h-5 w-52" />
          <ul className="mt-5 space-y-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <li key={i}>
                <Shimmer className="h-4 w-full" />
                <Shimmer className="mt-2 h-2.5 w-full rounded-full" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

/** Table rows at the real row height, so the table does not jump when the
 *  page arrives. */
export function RowsSkeleton({
  columns,
  rows = 8,
}: {
  columns: { header: string; skeleton?: string }[]
  rows?: number
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} className="border-t border-white/[0.06]">
          {columns.map((c) => (
            <td key={c.header} className="px-4 py-4">
              <Shimmer className={`h-4 ${c.skeleton ?? 'w-32'}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

/** The whole panel, for the moment before /me answers and there is not even
 *  a shell to hang a spinner in. */
export function PanelSkeleton() {
  return (
    <div className="relative isolate min-h-dvh md:flex" aria-busy="true">
      <span className="sr-only">Signing you in</span>

      <div className="glass border-b border-white/8 bg-[var(--admin-card)] p-4 md:h-dvh md:w-[19.5rem] md:shrink-0 md:border-b-0 md:border-r md:p-6">
        <div className="flex items-center gap-2.5">
          <Shimmer className="size-11 rounded-xl" />
          <div className="flex-1">
            <Shimmer className="h-4 w-40" />
            <Shimmer className="mt-2 h-3 w-24" />
          </div>
        </div>

        <ul className="mt-9 space-y-1.5">
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <Shimmer className="h-11 w-full rounded-xl" />
            </li>
          ))}
        </ul>
      </div>

      <main className="min-w-0 flex-1 p-5 sm:p-8 xl:p-12">
        <StatsSkeleton />
      </main>
    </div>
  )
}

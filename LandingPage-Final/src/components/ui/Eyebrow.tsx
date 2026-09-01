import type { ReactNode } from 'react'

/**
 * Section label pill.
 *
 * The marker is a candlestick rather than a status dot: a wick with a solid
 * body. It reads as this page's own mark instead of the generic "live" light,
 * and it rhymes with the tower silhouettes in the hero plate and the bars in
 * the nav ticker. Deliberately static -- four of these sit on the page, and the
 * nav already owns the moving version.
 */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 whitespace-nowrap rounded-full border border-[rgba(0,255,135,0.22)] bg-[rgba(0,255,135,0.05)] px-3.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#00FF87] sm:gap-2.5 sm:px-4 sm:text-[12px] sm:tracking-[0.22em]">
      <span
        aria-hidden
        className="relative flex h-2.5 w-[3px] shrink-0 items-center justify-center"
      >
        <span className="absolute h-full w-px bg-[#00FF87]/45" />
        <span className="relative h-1.5 w-full rounded-[1px] bg-[#00FF87]" />
      </span>
      {children}
    </span>
  )
}

import type { ReactNode } from 'react'

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 whitespace-nowrap rounded-full border border-[rgba(0,255,135,0.22)] bg-[rgba(0,255,135,0.05)] px-3.5 py-1.5 text-micro font-semibold uppercase text-[#00FF87] sm:gap-2.5 sm:px-4">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00FF87] opacity-70" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#00FF87]" />
      </span>
      {children}
    </span>
  )
}

import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'

type Props = {
  /** Generated 3D asset. Falls back to the lucide icon if absent. */
  src: string
  fallback: LucideIcon
  className?: string
}

export function IconArt({ src, fallback: Fallback, className = 'size-7' }: Props) {
  const [failed, setFailed] = useState(false)

  if (failed) return <Fallback className={`${className} text-[#00FF87]`} aria-hidden />

  return (
    <img
      src={src}
      alt=""
      aria-hidden
      loading="lazy"
      decoding="async"
      className={`${className} object-contain`}
      onError={() => setFailed(true)}
    />
  )
}

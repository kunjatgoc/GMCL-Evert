import { useState, type ComponentType } from 'react'

/** Anything that renders an SVG from a className: a lucide icon or a `~icons` import. */
export type IconComponent = ComponentType<{ className?: string }>

type Props = {
  /** Generated 3D asset. Falls back to the icon if absent. */
  src: string
  fallback: IconComponent
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

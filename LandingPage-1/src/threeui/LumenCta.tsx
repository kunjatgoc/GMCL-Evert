/* Vendored from threeui  src/shaders/lumen-cta/LumenCta.tsx (MIT).
   GMCL: the light mode is dropped (this page is dark only), the label can
   carry an icon so the hero CTA keeps its arrow, and upstream's decorative
   ring dot is dropped. The hue/saturation/brightness filter contract is
   upstream's. */

import type { CSSProperties, MouseEventHandler, ReactNode } from 'react'

import './lumen-cta.css'

export type LumenCtaVariant = 'primary' | 'ghost'

export type LumenCtaProps = {
  variant?: LumenCtaVariant
  label?: ReactNode
  hue?: number
  saturation?: number
  brightness?: number
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  onClick?: MouseEventHandler<HTMLButtonElement>
  className?: string
  buttonClassName?: string
  style?: CSSProperties
}

export const LUMEN_CTA_DEFAULTS = {
  variant: 'primary',
  hue: 0,
  saturation: 1,
  brightness: 1,
} as const

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function LumenCta({
  variant = LUMEN_CTA_DEFAULTS.variant,
  label,
  hue = LUMEN_CTA_DEFAULTS.hue,
  saturation = LUMEN_CTA_DEFAULTS.saturation,
  brightness = LUMEN_CTA_DEFAULTS.brightness,
  disabled = false,
  type = 'button',
  onClick,
  className = '',
  buttonClassName = '',
  style,
}: LumenCtaProps) {
  const safeVariant: LumenCtaVariant = variant === 'ghost' ? 'ghost' : 'primary'

  return (
    <div
      className={`lumen-cta${className ? ` ${className}` : ''}`}
      data-variant={safeVariant}
      style={
        {
          '--lumen-cta-hue': `${clamp(hue, -180, 180)}deg`,
          '--lumen-cta-saturation': clamp(saturation, 0, 2),
          '--lumen-cta-brightness': clamp(brightness, 0.35, 1.65),
          ...style,
        } as CSSProperties
      }
    >
      <button
        className={[
          'lumen-cta__button',
          safeVariant === 'ghost' ? 'lumen-cta__button--ghost' : '',
          buttonClassName,
        ]
          .filter(Boolean)
          .join(' ')}
        type={type}
        disabled={disabled}
        onClick={onClick}
      >
        {label}
      </button>
    </div>
  )
}

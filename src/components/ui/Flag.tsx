import type { ComponentType, SVGProps } from 'react'
import AE from '~icons/circle-flags/ae'
import AU from '~icons/circle-flags/au'
import BD from '~icons/circle-flags/bd'
import BR from '~icons/circle-flags/br'
import DE from '~icons/circle-flags/de'
import EG from '~icons/circle-flags/eg'
import ES from '~icons/circle-flags/es'
import FR from '~icons/circle-flags/fr'
import GB from '~icons/circle-flags/gb'
import ID from '~icons/circle-flags/id'
import IN from '~icons/circle-flags/in'
import IT from '~icons/circle-flags/it'
import MY from '~icons/circle-flags/my'
import NG from '~icons/circle-flags/ng'
import PH from '~icons/circle-flags/ph'
import PK from '~icons/circle-flags/pk'
import SG from '~icons/circle-flags/sg'
import TR from '~icons/circle-flags/tr'
import US from '~icons/circle-flags/us'
import VN from '~icons/circle-flags/vn'
import ZA from '~icons/circle-flags/za'

/**
 * Round SVG flag for an ISO country code. Emoji flags render as two capital
 * letters on Windows, so anywhere we control the markup uses these instead.
 * The native <select> in Signup keeps the emoji: an <option> cannot hold SVG.
 *
 * One import per country in COUNTRIES. Add a line here when that list grows.
 */
const FLAGS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  AE, AU, BD, BR, DE, EG, ES, FR, GB, ID, IN, IT, MY, NG, PH, PK, SG, TR, US, VN, ZA,
}

type Props = { code: string; className?: string }

export function Flag({ code, className = 'size-4' }: Props) {
  const Svg = FLAGS[code]
  if (!Svg) return null
  return <Svg className={`${className} shrink-0`} aria-hidden />
}

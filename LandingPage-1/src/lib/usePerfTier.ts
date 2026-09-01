import { useEffect, useState } from 'react'

export type PerfTier = 'full' | 'lite'

/**
 * Decides whether this device gets the WebGL hero or the static plate.
 *
 * Deliberately pessimistic: anything we cannot positively confirm as capable
 * falls back to 'lite'. A missed opportunity to show the 3D scene is cheap;
 * a janky 8fps hero on a mid-range phone is not.
 */
function detect(): PerfTier {
  if (typeof window === 'undefined') return 'lite'

  // ?scene=on|off forces either path. Lets the static fallback be reviewed on
  // a capable machine, and the WebGL scene be captured in headless CI where
  // the software renderer would otherwise disqualify itself below.
  const forced = new URLSearchParams(window.location.search).get('scene')
  if (forced === 'on') return 'full'
  if (forced === 'off') return 'lite'

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'lite'

  // Coarse pointer + narrow viewport is a phone. Even capable phones burn
  // battery on a persistent canvas for a page this short.
  const isPhone =
    window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 900
  if (isPhone) return 'lite'

  const nav = navigator as Navigator & { deviceMemory?: number }
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory < 4) return 'lite'
  if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency < 4)
    return 'lite'

  // Confirm a real WebGL2 context exists before promising a scene.
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    if (!gl) return 'lite'
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    if (info) {
      const renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))
      // SwiftShader / llvmpipe mean the GPU is being emulated on the CPU.
      if (/swiftshader|llvmpipe|software/i.test(renderer)) return 'lite'
    }
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    return 'lite'
  }

  return 'full'
}

export function usePerfTier(): PerfTier {
  // Start 'lite' so first paint never blocks on the canvas, then upgrade.
  const [tier, setTier] = useState<PerfTier>('lite')

  useEffect(() => {
    setTier(detect())

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setTier(detect())
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return tier
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

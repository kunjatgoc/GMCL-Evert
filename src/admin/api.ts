/** The one seam between the admin screens and /api/admin/*. */

export type Me = { email: string; role: string }

export type DayPoint = { day: string; demo: number; real_requests: number }

export type Stats = {
  demo_total: number
  demo_today: number
  demo_week: number
  real_total: number
  real_today: number
  real_week: number
  countries: number
  top_countries: { country: string; entries: number }[]
  daily: DayPoint[]
}

export type DemoUser = {
  id: number
  full_name: string
  email: string
  mobile: string
  country: string
  created_at: string
}

export type RealUser = { id: number; email: string; created_at: string }

export type Page<T> = {
  rows: T[]
  total: number
  page: number
  per_page: number
}

/** Thrown on 401 so a caller can bounce to the login screen without parsing
 *  a message. Every other failure is a plain Error with something readable. */
export class Unauthorized extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api/admin${path}`, {
      credentials: 'same-origin',
      ...init,
    })
  } catch {
    throw new Error('Could not reach the server.')
  }

  if (res.status === 401) throw new Unauthorized('Not signed in.')
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.detail ?? `Request failed (${res.status}).`)
  }
  return res.json()
}

export const getMe = () => request<Me>('/me')
export const getStats = () => request<Stats>('/stats')
export const logout = () => request<{ ok: true }>('/logout', { method: 'POST' })

/** Drops empty values so the URL carries only the filters actually set. */
export function query(params: Record<string, string | number>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== '' && v !== undefined && v !== null) qs.set(k, String(v))
  }
  return qs.toString()
}

export const listDemoUsers = (qs: string) =>
  request<Page<DemoUser>>(`/registrations?${qs}`)

export const listRealUsers = (qs: string) =>
  request<Page<RealUser>>(`/real-accounts?${qs}`)

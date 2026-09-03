/** The one seam between the admin screens and /api/admin/*. */

import { postJson, request } from '../lib/api'

export { getMe, logout, Unauthorized, type Me } from '../lib/api'

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

const admin = <T>(path: string) => request<T>(`/api/admin${path}`)

export const getStats = () => admin<Stats>('/stats')

/** Drops empty values so the URL carries only the filters actually set. */
export function query(params: Record<string, string | number>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== '' && v !== undefined && v !== null) qs.set(k, String(v))
  }
  return qs.toString()
}

export const listDemoUsers = (qs: string) =>
  admin<Page<DemoUser>>(`/registrations?${qs}`)

export const listRealUsers = (qs: string) =>
  admin<Page<RealUser>>(`/real-accounts?${qs}`)

export type MetaidStatus = 'pending' | 'approved' | 'rejected'

/** One row of the queue: the request, plus the account it belongs to. */
export type MetaidRow = {
  id: number
  user_id: number
  /** Null on staff accounts, which are seeded without one. */
  full_name: string | null
  phone: string
  /** ISO code read off the number above, not a stored field. */
  country: string | null
  /** The address on the account, which is not necessarily the one below. */
  account_email: string
  /** The address the MetaID is to be issued against. */
  email: string
  type: 'demo' | 'real'
  status: MetaidStatus
  decision_note: string | null
  created_at: string
  decided_at: string | null
}

export const listMetaidQueue = (qs: string) => admin<Page<MetaidRow>>(`/metaid?${qs}`)

/** The note is the reason a refusal gives; the entrant reads it on their
 *  dashboard. An approval has nothing to explain, so it sends none. */
export const decideMetaid = (
  id: number,
  status: 'approved' | 'rejected',
  note?: string
) =>
  postJson<{ id: number; status: MetaidStatus }>(`/api/admin/metaid/${id}`, {
    status,
    note: note?.trim() || null,
  })

/** The queue in five numbers -- the newera staff dashboard. */
export type MetaidStats = {
  pending: number
  approved: number
  rejected: number
  today: number
  total: number
}

export const getMetaidStats = () => admin<MetaidStats>('/metaid/stats')

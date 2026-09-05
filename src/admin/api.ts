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

/** The three states a MetaID request moves between, spelled as the CHECK on
 *  metaid_request.status spells them. */
export type MetaidStatus = 'pending' | 'approved' | 'rejected'

/** One row of the list: one ask from one account.
 *
 *  Name, phone and the account address are joined from `users` rather than
 *  stored on the request, so a corrected number reads corrected on every
 *  request the person ever made. They are nullable only because `users`
 *  shipped as the admin table, whose row has neither a name nor a number. */
export type MetaidRow = {
  id: number
  user_id: number
  full_name: string | null
  phone: string | null
  /** ISO code read off the number above, not a stored field. */
  country: string | null
  /** The address on the account, which a Real request's is never. Searchable,
   *  not shown: the User, Name and Phone columns already say who asked. */
  account_email: string | null
  /** The address the MetaID is to be issued against. */
  email: string
  type: 'demo' | 'real'
  status: MetaidStatus
  decision_note: string | null
  created_at: string
  decided_at: string | null
}

export const listMetaidQueue = (qs: string) => admin<Page<MetaidRow>>(`/metaid?${qs}`)

/** Decides one request. The note is the reason a refusal gives; the entrant
 *  reads it on their dashboard, and an approval has nothing to explain, so it
 *  sends none. */
export const decideMetaid = (id: number, status: 'approved' | 'rejected') =>
  postJson<{ id: number; status: MetaidStatus }>(`/api/admin/metaid/${id}`, {
    status,
    note: null,
  })

/** Puts a decided request back to pending. Refused when the person has opened
 *  a newer request of the same type since -- that one keeps the place. */
export const undoMetaid = (id: number) =>
  postJson<{ id: number; status: MetaidStatus }>(
    `/api/admin/metaid/${id}/undo`,
    {}
  )

/** The queue in five numbers -- the newera staff dashboard. */
export type MetaidStats = {
  pending: number
  approved: number
  rejected: number
  today: number
  total: number
}

export const getMetaidStats = () => admin<MetaidStats>('/metaid/stats')

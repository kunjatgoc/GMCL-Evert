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

/**
 * Where a row came from. `request` is the signed-in dashboard's own
 * metaid_request; `demo` and `real` are the landing form's two tables, which
 * still take rows and have no status of their own -- only is_id_given, read
 * off the platform's account-created export.
 */
export type Source = 'request' | 'demo' | 'real'

/** One vocabulary for all three tables. A landing-form row has no status
 *  column, so the API reads `is_id_given` as one: YES is approved, NO is
 *  pending, REJECTED is rejected. */
export type MetaidStatus = 'pending' | 'approved' | 'rejected'

/** The same three, as the landing-form tables spell them. */
export const ID_GIVEN: Record<MetaidStatus, 'YES' | 'NO' | 'REJECTED'> = {
  approved: 'YES',
  pending: 'NO',
  rejected: 'REJECTED',
}

/** One row of the list. Everything a landing-form row has no column for
 *  arrives null, so the screen decides what to draw rather than the query. */
export type MetaidRow = {
  source: Source
  id: number
  user_id: number | null
  /** Null on staff accounts and on real_account_request, which stores none. */
  full_name: string | null
  phone: string | null
  /** ISO code read off the number above, not a stored field. */
  country: string | null
  /** The address on the account, which is not necessarily the one below.
   *  Null on a landing-form row: there was no account to be on. */
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

/** Moves a landing-form row to one of the three states by writing the one
 *  column it has.
 *
 *  Neither NO nor REJECTED is a revocation the platform honours: the next run
 *  of the backfill turns either back to YES if the export still lists the
 *  address. It is what an admin knows before that export arrives. */
export const setIdGiven = (
  source: 'demo' | 'real',
  id: number,
  status: MetaidStatus
) =>
  postJson<{ source: string; id: number; is_id_given: string }>(
    '/api/admin/id-given',
    { source, id, value: ID_GIVEN[status] }
  )

/** Decides one dashboard request. The note is the reason a refusal gives; the
 *  entrant reads it on their dashboard, and an approval has nothing to
 *  explain, so it sends none. */
export const decideMetaid = (id: number, status: 'approved' | 'rejected') =>
  postJson<{ id: number; status: MetaidStatus }>(`/api/admin/metaid/${id}`, {
    status,
    note: null,
  })

/** Puts a decided request back to pending, which is what Undo does to a
 *  landing-form row's column. Refused when the person has opened a newer
 *  request of the same type since -- that one keeps the place. */
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

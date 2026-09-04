/** The seam between the dashboard and /api/metaid. */

import { postJson, request } from '../lib/api'

export type MetaidType = 'demo' | 'real'
export type MetaidStatus = 'pending' | 'approved' | 'rejected'

export type MetaidRequest = {
  /** The row's own id -- what the admin queue will decide against. */
  id: number
  user_id: number
  /** Joined from the account, never copied onto the row. */
  phone: string
  type: MetaidType
  email: string
  status: MetaidStatus
  decision_note: string | null
  created_at: string
  decided_at: string | null
}

export const listMetaid = () =>
  request<{ rows: MetaidRequest[] }>('/api/metaid').then((r) => r.rows)

export const requestMetaid = (type: MetaidType, email: string) =>
  postJson<{ id: number }>('/api/metaid', { type, email })

/** Whether Gspice already holds an account against this address. Real only --
 *  a Demo MetaID is issued against the account's own address and asks nothing. */
export const checkMetaidEmail = (email: string) =>
  postJson<{ available: boolean }>('/api/metaid/check', { email })

/** One row of `league_entry`: who joined, under which MetaID, and when. */
export type LeagueEntry = {
  metaid: string
  /** The address the MetaID was approved against, as it stood on joining. */
  email: string
  created_at: string
}

export const getLeagueEntry = () =>
  request<{ entry: LeagueEntry | null }>('/api/league').then((r) => r.entry)

export const joinLeague = (metaid: string) =>
  postJson<{ id: number }>('/api/league', { metaid })

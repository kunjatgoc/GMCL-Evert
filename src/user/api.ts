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

/** Which of the two identifiers newera already holds an account against.
 *
 *  Two flags rather than one verdict, because the dialog names the one that
 *  matched. The phone is not sent from here: it is the account's own, read on
 *  the server, so a caller cannot choose what gets checked.
 *
 *  Real only -- a Demo MetaID is issued against the account's own address and
 *  asks nothing. */
export type MetaidDuplicates = { phone_taken: boolean; email_taken: boolean }

export const checkMetaidDuplicates = (email: string) =>
  postJson<MetaidDuplicates>('/api/metaid/check', { email })

/** One row of `league_entry`: which MetaID was entered, against which address,
 *  and when. One person may hold several -- newera issues a number per
 *  account, and a demo and a real one are two of them. */
export type LeagueEntry = {
  /** Needed to edit the row, and the only reason the id leaves the server. */
  id: number
  metaid: string
  /** The address the MetaID was approved against, as it stood on joining. */
  email: string
  created_at: string
}

/** The League screen's whole state: the entry if there is one, and whether
 *  this account is allowed one at all.
 *
 *  `can_join` is the server's answer, not a sum the screen does for itself --
 *  newera has to have approved an account before there is a number to type,
 *  and the endpoint that writes the row asks the same question. */
export type LeagueStatus = { entries: LeagueEntry[]; can_join: boolean }

export const getLeagueStatus = () => request<LeagueStatus>('/api/league')

export const joinLeague = (metaid: string) =>
  postJson<{ id: number }>('/api/league', { metaid })

/** Corrects the number on an entry already made. The row keeps its address and
 *  its joined date, which is what separates a correction from a new entry. */
export const editLeagueEntry = (id: number, metaid: string) =>
  request<{ id: number }>(`/api/league/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ metaid }),
  })

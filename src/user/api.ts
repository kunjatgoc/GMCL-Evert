/** The seam between the dashboard and /api/metaid. */

import { postJson, request } from '../lib/api'

export type MetaidType = 'demo' | 'real'
export type MetaidStatus = 'pending' | 'approved' | 'rejected'

export type MetaidRequest = {
  id: number
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

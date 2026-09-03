/**
 * The fetch seam for anything behind a session: /api/me, /api/logout, and the
 * screens that build on them. Same-origin, so the cookie rides along on its
 * own and nothing about it is kept in JS.
 */

export type Me = {
  email: string
  role: string
  full_name: string | null
  phone: string
}

/** Thrown on 401 so a caller can bounce to the login screen without parsing
 *  a message. Every other failure is a plain Error with something readable. */
export class Unauthorized extends Error {}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, { credentials: 'same-origin', ...init })
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

export const postJson = <T>(path: string, body: unknown) =>
  request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

export const getMe = () => request<Me>('/api/me')

/** The name is the only field its owner can change unaided. Email and phone
 *  are identifiers other people are told about; moving either is a support
 *  job with its own confirmation. */
export const updateName = (full_name: string) =>
  request<{ full_name: string }>('/api/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name }),
  })

export const changePassword = (current_password: string, new_password: string) =>
  request<{ ok: true }>('/api/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ current_password, new_password }),
  })
export const logout = () => request<{ ok: true }>('/api/logout', { method: 'POST' })

/** Where a signed-in account lands. One place, so the login screen, the
 *  confirmation step and the guards on both panels cannot disagree. */
const HOME: Record<string, string> = {
  admin: '/admin',
  newera_staff: '/admin',
  gml_staff: '/gml',
}

export const homeFor = (role: string) => HOME[role] ?? '/dashboard'

/**
 * The fetch seam for anything behind a session: /api/me, /api/logout, and the
 * screens that build on them. Same-origin, so the cookie rides along on its
 * own and nothing about it is kept in JS.
 */

export type Me = { email: string; role: string; full_name: string | null }

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
export const logout = () => request<{ ok: true }>('/api/logout', { method: 'POST' })

/** Where a signed-in account lands. One place, so the login screen, the
 *  confirmation step and the guards on both panels cannot disagree. */
export const homeFor = (role: string) => (role === 'admin' ? '/admin' : '/dashboard')

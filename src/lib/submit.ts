import type { Registration } from './schema'

export type SubmitResult = { ok: true } | { ok: false; error: string }

// Same-origin by default, which the dev proxy in vite.config.ts satisfies.
// Set VITE_REGISTER_URL when the API is deployed somewhere else.
const ENDPOINT = import.meta.env.VITE_REGISTER_URL ?? '/api/register'

/** The single seam between the form and the API. */
export async function submitRegistration(
  data: Registration
): Promise<SubmitResult> {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (res.ok) return { ok: true }
    if (res.status === 409)
      return { ok: false, error: 'You have already applied for the demo. Sit back and relax, you will get an email from our side.' }

    return { ok: false, error: 'Registration failed. Please try again.' }
  } catch {
    // Offline, DNS, CORS, server down. Worth distinguishing from a rejection:
    // one is worth retrying immediately, the other is not.
    return {
      ok: false,
      error: 'Could not reach the server. Check your connection and try again.',
    }
  }
}

const REAL_ACCOUNT_ENDPOINT =
  import.meta.env.VITE_REAL_ACCOUNT_URL ?? '/api/real-account'

/** The seam for the real-balance request card. Same contract as above. */
export async function submitRealAccount(email: string): Promise<SubmitResult> {
  try {
    const res = await fetch(REAL_ACCOUNT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    if (res.ok) return { ok: true }
    if (res.status === 409)
      return {
        ok: false,
        error: 'You have already asked. Our team will email you shortly.',
      }

    return { ok: false, error: 'Request failed. Please try again.' }
  } catch {
    return {
      ok: false,
      error: 'Could not reach the server. Check your connection and try again.',
    }
  }
}

const LOGIN_ENDPOINT = import.meta.env.VITE_LOGIN_URL ?? '/api/admin/login'

/**
 * The seam for the admin login screen. Same contract as the two above.
 *
 * The server replies with a Set-Cookie; nothing about the session is kept in
 * JS, so there is nothing to return but success.
 */
export async function submitLogin(
  email: string,
  password: string
): Promise<SubmitResult> {
  try {
    const res = await fetch(LOGIN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Same-origin, so the session cookie the server sets comes back on its
      // own. Nothing is kept in JS.
      credentials: 'same-origin',
      body: JSON.stringify({ email, password }),
    })

    if (res.ok) return { ok: true }

    // One message for both, deliberately: telling a stranger which half was
    // wrong tells them which addresses are registered.
    if (res.status === 401 || res.status === 400)
      return { ok: false, error: 'That email and password do not match.' }

    if (res.status === 429)
      return { ok: false, error: 'Too many attempts. Try again in a minute.' }

    return { ok: false, error: 'Sign in failed. Please try again.' }
  } catch {
    return {
      ok: false,
      error: 'Could not reach the server. Check your connection and try again.',
    }
  }
}

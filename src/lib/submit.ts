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
 * Admin sign-in. Same contract as the two above.
 *
 * Usually this is the whole of it and the server replies with a session
 * cookie. An address that has never been confirmed gets a code in the inbox
 * and a short-lived pending cookie instead, which is not a session. Nothing
 * about either cookie is kept in JS.
 */
/**
 * `done` is the usual answer: the password was enough and the session is set.
 *
 * `otp` happens once per account, while the address has never been confirmed.
 * `sent` is false when a code went out moments ago and is still live -- the
 * screen still advances, it just does not claim to have mailed anything.
 */
export type LoginResult =
  | { ok: true; stage: 'done' }
  | { ok: true; stage: 'otp'; sent: boolean }
  | { ok: false; error: string }

export async function submitLogin(
  email: string,
  password: string
): Promise<LoginResult> {
  try {
    const res = await fetch(LOGIN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Same-origin, so the session cookie the server sets comes back on its
      // own. Nothing is kept in JS.
      credentials: 'same-origin',
      body: JSON.stringify({ email, password }),
    })

    if (res.ok) {
      const body = await res.json().catch(() => null)
      return body?.stage === 'otp'
        ? { ok: true, stage: 'otp', sent: body?.sent !== false }
        : { ok: true, stage: 'done' }
    }

    // One message for both, deliberately: telling a stranger which half was
    // wrong tells them which addresses are registered.
    if (res.status === 401 || res.status === 400)
      return { ok: false, error: 'That email and password do not match.' }

    if (res.status === 502)
      return {
        ok: false,
        error: 'We could not send the code. Please try again.',
      }

    if (res.status === 503)
      return { ok: false, error: 'Sign-in is unavailable right now.' }

    return { ok: false, error: 'Sign in failed. Please try again.' }
  } catch {
    return {
      ok: false,
      error: 'Could not reach the server. Check your connection and try again.',
    }
  }
}

/**
 * The confirmation step, and the resend beside it.
 *
 * `expired` is the one distinction worth making: the pending cookie has run
 * out, so the screen has to go back and ask for the password again rather than
 * offer another code nobody can use.
 */
export type OtpResult = { ok: true } | { ok: false; error: string; expired?: boolean }

const VERIFY_OTP_ENDPOINT = '/api/admin/verify-otp'
const RESEND_OTP_ENDPOINT = '/api/admin/resend-otp'

async function postOtp(url: string, body?: unknown): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body ?? {}),
  })
}

export async function submitOtp(code: string): Promise<OtpResult> {
  try {
    const res = await postOtp(VERIFY_OTP_ENDPOINT, { code })

    if (res.ok) return { ok: true }

    // 401 covers both a wrong code and a lapsed pending cookie, and the server
    // says which in its detail -- deliberately, because the two need different
    // screens, and neither leaks anything a stranger could use.
    if (res.status === 401) {
      const detail = await res.json().catch(() => null)
      const expired = String(detail?.detail ?? '').includes('expired. Start again')
      return {
        ok: false,
        expired,
        error: expired
          ? 'That sign-in expired. Enter your password again.'
          : 'That code is wrong or has expired.',
      }
    }

    if (res.status === 422)
      return { ok: false, error: 'Enter the six digits from the email.' }

    return { ok: false, error: 'Could not check that code. Please try again.' }
  } catch {
    return {
      ok: false,
      error: 'Could not reach the server. Check your connection and try again.',
    }
  }
}

export async function resendOtp(): Promise<OtpResult> {
  try {
    const res = await postOtp(RESEND_OTP_ENDPOINT)

    if (res.ok) return { ok: true }
    if (res.status === 401)
      return {
        ok: false,
        expired: true,
        error: 'That sign-in expired. Enter your password again.',
      }
    if (res.status === 429)
      return {
        ok: false,
        error: 'A code was just sent. Wait a moment before asking for another.',
      }

    return { ok: false, error: 'Could not send another code. Please try again.' }
  } catch {
    return {
      ok: false,
      error: 'Could not reach the server. Check your connection and try again.',
    }
  }
}

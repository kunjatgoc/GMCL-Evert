import type { Registration, Signup } from './schema'

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
        error: 'You have already asked. Your request is with our team.',
      }

    return { ok: false, error: 'Request failed. Please try again.' }
  } catch {
    return {
      ok: false,
      error: 'Could not reach the server. Check your connection and try again.',
    }
  }
}

const LOGIN_ENDPOINT = import.meta.env.VITE_LOGIN_URL ?? '/api/login'

/**
 * Sign-in. Same contract as the two above.
 *
 * Two ways to succeed, and `stage` says which. A confirmed address gets the
 * session cookie set and a `role` saying which panel to open. An address that
 * never answered its signup code gets a fresh one and the pending cookie
 * instead, and finishes at the confirmation step -- otherwise a lapsed pending
 * cookie would leave the account unreachable. Nothing about either cookie is
 * kept in JS.
 */
export type LoginResult =
  | { ok: true; stage: 'session'; role: string }
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
      if (body?.stage === 'otp')
        return { ok: true, stage: 'otp', sent: body.sent !== false }
      return { ok: true, stage: 'session', role: String(body?.role ?? '') }
    }

    // One message for both, deliberately: telling a stranger which half was
    // wrong tells them which addresses are registered.
    if (res.status === 401 || res.status === 400)
      return { ok: false, error: 'Wrong email or password.' }

    if (res.status === 503)
      return { ok: false, error: 'Sign in is not available right now. Try again later.' }

    return { ok: false, error: 'Sign in failed. Please try again.' }
  } catch {
    return {
      ok: false,
      error: 'Could not reach the server. Check your connection and try again.',
    }
  }
}

/**
 * Account creation. Always ends in the confirmation step, so a success here
 * means "a code is in the inbox and the pending cookie is set", never a
 * session. The server says which of email and phone is taken, because the two
 * need different fixes.
 */
export async function submitSignup(data: Signup): Promise<SubmitResult> {
  try {
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(data),
    })

    if (res.ok) return { ok: true }

    if (res.status === 409) {
      const detail = await res.json().catch(() => null)
      return {
        ok: false,
        error: String(detail?.detail ?? 'This email already has an account.'),
      }
    }
    if (res.status === 422)
      return { ok: false, error: 'Some details are not right. Check the form and try again.' }
    if (res.status === 502)
      return { ok: false, error: 'We could not send the code. Please try again.' }
    if (res.status === 503)
      return { ok: false, error: 'Sign up is not available right now. Try again later.' }

    return { ok: false, error: 'Sign-up failed. Please try again.' }
  } catch {
    return {
      ok: false,
      error: 'Could not reach the server. Check your connection and try again.',
    }
  }
}

/**
 * Forgetting the password, and the link that undoes it.
 *
 * The ask always reports success. The server will not say whether the address
 * has an account, so neither can this -- the screen says "if that address has
 * an account" and means it.
 */
export async function submitForgotPassword(email: string): Promise<SubmitResult> {
  try {
    const res = await fetch('/api/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    if (res.ok) return { ok: true }
    if (res.status === 502)
      return { ok: false, error: 'We could not send that email. Please try again.' }
    if (res.status === 503)
      return { ok: false, error: 'Password reset is not available right now. Try again later.' }

    return { ok: false, error: 'Could not send the link. Please try again.' }
  } catch {
    return {
      ok: false,
      error: 'Could not reach the server. Check your connection and try again.',
    }
  }
}

/** Spends the link. 401 is the only failure worth its own wording: the link is
 *  old, already used, or was never real, and all three end the same way. */
export async function submitResetPassword(
  uid: string,
  token: string,
  password: string
): Promise<SubmitResult> {
  try {
    const res = await fetch('/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, token, password }),
    })

    if (res.ok) return { ok: true }
    if (res.status === 401)
      return {
        ok: false,
        error: 'This link has expired or was already used. Ask for a new one.',
      }
    if (res.status === 422)
      return { ok: false, error: 'Your password must be at least 8 characters.' }
    if (res.status === 503)
      return { ok: false, error: 'Password reset is not available right now. Try again later.' }

    return { ok: false, error: 'Could not change your password. Please try again.' }
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
type OtpFailure = { ok: false; error: string; expired?: boolean }
export type OtpResult = { ok: true } | OtpFailure
/** A verified code is a sign-in, so it also says where to go. */
export type VerifyResult = { ok: true; role: string } | OtpFailure

const VERIFY_OTP_ENDPOINT = '/api/verify-otp'
const RESEND_OTP_ENDPOINT = '/api/resend-otp'

async function postOtp(url: string, body?: unknown): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body ?? {}),
  })
}

export async function submitOtp(code: string): Promise<VerifyResult> {
  try {
    const res = await postOtp(VERIFY_OTP_ENDPOINT, { code })

    if (res.ok) {
      const body = await res.json().catch(() => null)
      return { ok: true, role: String(body?.role ?? '') }
    }

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
          ? 'Your session expired. Sign in again.'
          : 'This code is wrong or has expired.',
      }
    }

    if (res.status === 422)
      return { ok: false, error: 'Enter the 6-digit code from your email.' }

    return { ok: false, error: 'Could not check the code. Please try again.' }
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
        error: 'Your session expired. Sign in again.',
      }
    if (res.status === 429)
      return {
        ok: false,
        error: 'We just sent a code. Wait a moment before asking for another.',
      }

    return { ok: false, error: 'Could not send a new code. Please try again.' }
  } catch {
    return {
      ok: false,
      error: 'Could not reach the server. Check your connection and try again.',
    }
  }
}

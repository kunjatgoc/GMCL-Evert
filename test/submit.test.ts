import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  resendOtp,
  submitForgotPassword,
  submitLogin,
  submitOtp,
  submitResetPassword,
  submitSignup,
} from '../src/lib/submit'

const respondWith = (status: number, body?: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(body === undefined ? null : JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })
    )
  )

const throwsOnFetch = () =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
  )

afterEach(() => vi.unstubAllGlobals())

describe('submitLogin', () => {
  it('signs a confirmed address straight in', async () => {
    respondWith(200, { stage: 'session', email: 'a@b.com', role: 'admin' })
    expect(await submitLogin('a@b.com', 'pw')).toEqual({
      ok: true,
      stage: 'session',
      role: 'admin',
    })
  })

  it('carries the role, so an entrant lands on the dashboard', async () => {
    respondWith(200, { stage: 'session', email: 'a@b.com', role: 'end_user' })
    expect(await submitLogin('a@b.com', 'pw')).toMatchObject({ role: 'end_user' })
  })

  // The account is otherwise unreachable: the ten-minute pending cookie from
  // signup has lapsed, signup answers 409, and resend has no cookie to read.
  it('sends an unconfirmed address to the confirmation step', async () => {
    respondWith(200, { stage: 'otp', sent: true })
    expect(await submitLogin('a@b.com', 'pw')).toEqual({
      ok: true,
      stage: 'otp',
      sent: true,
    })
  })

  it('passes on that no fresh code went out inside the resend window', async () => {
    respondWith(200, { stage: 'otp', sent: false })
    expect(await submitLogin('a@b.com', 'pw')).toMatchObject({ sent: false })
  })

  it('separates an unconfirmed address from a wrong password', async () => {
    respondWith(200, { stage: 'otp', sent: true })
    const unconfirmed = await submitLogin('a@b.com', 'pw')
    respondWith(401)
    const wrong = await submitLogin('a@b.com', 'pw')
    expect(unconfirmed.ok).toBe(true)
    expect(wrong.ok).toBe(false)
  })

  it('gives the same message for 400 and 401, so it leaks no addresses', async () => {
    respondWith(401)
    const unauthorised = await submitLogin('a@b.com', 'pw')
    respondWith(400)
    const bad = await submitLogin('a@b.com', 'pw')

    expect(unauthorised.ok).toBe(false)
    expect(unauthorised).toEqual(bad)
  })

  it('reports a reachability problem when the request throws', async () => {
    throwsOnFetch()
    const res = await submitLogin('a@b.com', 'pw')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/could not reach/i)
  })
})

describe('submitForgotPassword', () => {
  it('reports success, which is all the server will say', async () => {
    respondWith(200, { ok: true })
    expect(await submitForgotPassword('a@b.com')).toEqual({ ok: true })
  })

  it('says the same for an address with no account, so it leaks none', async () => {
    respondWith(200, { ok: true })
    const known = await submitForgotPassword('a@b.com')
    respondWith(200, { ok: true })
    const unknown = await submitForgotPassword('nobody@b.com')
    expect(known).toEqual(unknown)
  })

  it('reports a mail failure as its own thing, not as success', async () => {
    respondWith(502)
    const res = await submitForgotPassword('a@b.com')
    expect(res.ok).toBe(false)
  })
})

describe('submitResetPassword', () => {
  it('reports success on 200', async () => {
    respondWith(200, { ok: true })
    expect(await submitResetPassword('7', 'tok', 'password123')).toEqual({ ok: true })
  })

  // Expired, already spent, or never real. The person can act on all three the
  // same way, so they read the same way.
  it('points a dead link at asking for another', async () => {
    respondWith(401, { detail: 'That link is no longer valid.' })
    const res = await submitResetPassword('7', 'tok', 'password123')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/ask for a new one/i)
  })

  it('separates a rejected password from a dead link', async () => {
    respondWith(422)
    const short = await submitResetPassword('7', 'tok', 'abc')
    respondWith(401)
    const dead = await submitResetPassword('7', 'tok', 'password123')
    expect(short).not.toEqual(dead)
  })

  it('reports a reachability problem when the request throws', async () => {
    throwsOnFetch()
    const res = await submitResetPassword('7', 'tok', 'password123')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/could not reach/i)
  })
})

describe('submitOtp', () => {
  it('reports success on 200, with the role to route on', async () => {
    respondWith(200, { email: 'a@b.com', role: 'end_user' })
    expect(await submitOtp('123456')).toEqual({ ok: true, role: 'end_user' })
  })

  it('treats a wrong code as retryable, not expired', async () => {
    respondWith(401, { detail: 'That code is wrong or has expired.' })
    const res = await submitOtp('123456')
    expect(res).toMatchObject({ ok: false, expired: false })
  })

  it('flags a lapsed sign-in so the screen can ask for the password again', async () => {
    respondWith(401, { detail: 'That sign-in expired. Start again.' })
    const res = await submitOtp('123456')
    expect(res).toMatchObject({ ok: false, expired: true })
  })

  it('reports a reachability problem when the request throws', async () => {
    throwsOnFetch()
    const res = await submitOtp('123456')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/could not reach/i)
  })
})

describe('resendOtp', () => {
  it('reports success on 200', async () => {
    respondWith(200, { ok: true })
    expect(await resendOtp()).toEqual({ ok: true })
  })

  it('explains the wait on 429 without treating it as expired', async () => {
    respondWith(429)
    const res = await resendOtp()
    expect(res).toMatchObject({ ok: false })
    if (!res.ok) {
      expect(res.expired).toBeUndefined()
      expect(res.error).toMatch(/wait a moment/i)
    }
  })

  it('flags a lapsed sign-in on 401', async () => {
    respondWith(401)
    expect(await resendOtp()).toMatchObject({ ok: false, expired: true })
  })
})

const entrant = {
  fullName: 'Alex Mercer',
  email: 'alex@example.com',
  country: 'IN',
  phone: '9876543210',
  password: 'correct-horse',
}

describe('submitSignup', () => {
  it('carries the session back when the server signs the account straight in', async () => {
    respondWith(201, { stage: 'session', email: 'alex@example.com', role: 'end_user' })
    expect(await submitSignup(entrant)).toEqual({
      ok: true,
      stage: 'session',
      role: 'end_user',
    })
  })

  it('defaults the role rather than routing on an empty string', async () => {
    respondWith(201, { stage: 'session' })
    expect(await submitSignup(entrant)).toEqual({
      ok: true,
      stage: 'session',
      role: 'end_user',
    })
  })

  it('still reports the code stage, which is what OTP_REQUIRED turns back on', async () => {
    respondWith(201, { stage: 'otp', sent: true })
    expect(await submitSignup(entrant)).toEqual({ ok: true, stage: 'otp', sent: true })
  })

  it('posts the form as-is, password included, with the cookie jar open', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ stage: 'otp' }), { status: 201 })
    )
    vi.stubGlobal('fetch', fetchMock)
    await submitSignup(entrant)
    const [url, init] = fetchMock.mock.calls[0]
    if (!init) throw new Error('fetch was called without options')
    expect(url).toBe('/api/signup')
    expect(init.credentials).toBe('same-origin')
    expect(JSON.parse(String(init.body))).toEqual(entrant)
  })

  it('passes the server wording for a 409, since email and phone need different fixes', async () => {
    respondWith(409, { detail: 'That phone number already has an account.' })
    const res = await submitSignup(entrant)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/phone number/i)
  })

  it('separates a mail failure from a rejected form', async () => {
    respondWith(502)
    const mail = await submitSignup(entrant)
    respondWith(422)
    const form = await submitSignup(entrant)
    expect(mail.ok).toBe(false)
    expect(form.ok).toBe(false)
    if (!mail.ok && !form.ok) {
      expect(mail.error).toMatch(/could not send/i)
      expect(form.error).not.toMatch(/could not send/i)
    }
  })

  it('reports a reachability problem when the request throws', async () => {
    throwsOnFetch()
    const res = await submitSignup(entrant)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/could not reach/i)
  })
})

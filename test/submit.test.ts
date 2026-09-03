import { afterEach, describe, expect, it, vi } from 'vitest'
import { resendOtp, submitLogin, submitOtp, submitSignup } from '../src/lib/submit'

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
    respondWith(200, { stage: 'done', email: 'a@b.com', role: 'admin' })
    expect(await submitLogin('a@b.com', 'pw')).toEqual({
      ok: true,
      stage: 'done',
      role: 'admin',
    })
  })

  it('carries the role, so an entrant lands on the dashboard', async () => {
    respondWith(200, { stage: 'done', email: 'a@b.com', role: 'end_user' })
    expect(await submitLogin('a@b.com', 'pw')).toMatchObject({ role: 'end_user' })
  })

  it('asks for a code while the address is unconfirmed', async () => {
    respondWith(200, { stage: 'otp', sent: true })
    expect(await submitLogin('a@b.com', 'pw')).toEqual({
      ok: true,
      stage: 'otp',
      sent: true,
    })
  })

  it('still advances when a code went out moments ago', async () => {
    respondWith(200, { stage: 'otp', sent: false })
    expect(await submitLogin('a@b.com', 'pw')).toEqual({
      ok: true,
      stage: 'otp',
      sent: false,
    })
  })

  it('gives the same message for 400 and 401, so it leaks no addresses', async () => {
    respondWith(401)
    const unauthorised = await submitLogin('a@b.com', 'pw')
    respondWith(400)
    const bad = await submitLogin('a@b.com', 'pw')

    expect(unauthorised.ok).toBe(false)
    expect(unauthorised).toEqual(bad)
  })

  it('separates a mail failure from a wrong password', async () => {
    respondWith(502)
    const res = await submitLogin('a@b.com', 'pw')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/could not send/i)
  })

  it('reports a reachability problem when the request throws', async () => {
    throwsOnFetch()
    const res = await submitLogin('a@b.com', 'pw')
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
  it('reports success on 201 without pretending to be a session', async () => {
    respondWith(201, { stage: 'otp', sent: true })
    expect(await submitSignup(entrant)).toEqual({ ok: true })
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

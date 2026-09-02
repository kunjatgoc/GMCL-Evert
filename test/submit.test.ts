import { afterEach, describe, expect, it, vi } from 'vitest'
import { resendOtp, submitLogin, submitOtp } from '../src/lib/submit'

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
    expect(await submitLogin('a@b.com', 'pw')).toEqual({ ok: true, stage: 'done' })
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
  it('reports success on 200', async () => {
    respondWith(200, { email: 'a@b.com', role: 'admin' })
    expect(await submitOtp('123456')).toEqual({ ok: true })
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

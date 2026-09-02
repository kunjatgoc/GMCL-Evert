import { afterEach, describe, expect, it, vi } from 'vitest'
import { submitLogin } from '../src/lib/submit'

const respondWith = (status: number) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status }))
  )

afterEach(() => vi.unstubAllGlobals())

describe('submitLogin', () => {
  it('reports success on 200', async () => {
    respondWith(200)
    expect(await submitLogin('a@b.com', 'pw')).toEqual({ ok: true })
  })

  it('gives the same message for 400 and 401, so it leaks no addresses', async () => {
    respondWith(401)
    const unauthorised = await submitLogin('a@b.com', 'pw')
    respondWith(400)
    const bad = await submitLogin('a@b.com', 'pw')

    expect(unauthorised.ok).toBe(false)
    expect(unauthorised).toEqual(bad)
  })

  it('distinguishes rate limiting from a bad password', async () => {
    respondWith(429)
    const res = await submitLogin('a@b.com', 'pw')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/too many/i)
  })

  it('reports a reachability problem when the request throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      })
    )
    const res = await submitLogin('a@b.com', 'pw')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/could not reach/i)
  })
})

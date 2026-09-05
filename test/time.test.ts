import { describe, expect, test } from 'vitest'
import { formatIst, istDate, istDay, istDaysBetween } from '../src/lib/time'

/**
 * These have to hold whatever zone the machine running them is set to, which
 * is the whole point of the module. Every input carries an explicit offset so
 * nothing here depends on the local clock.
 */
describe('istDate', () => {
  test('is midnight in Delhi, not midnight where the reader is', () => {
    expect(istDate('2026-09-07').toISOString()).toBe('2026-09-06T18:30:00.000Z')
  })
})

describe('istDay', () => {
  test('one minute either side of IST midnight is two different days', () => {
    const before = istDay(new Date('2026-09-06T18:29:00Z'))
    const after = istDay(new Date('2026-09-06T18:30:00Z'))
    expect(after - before).toBe(1)
  })

  test('a whole IST day is one number', () => {
    const open = istDay(new Date('2026-09-07T00:00:00+05:30'))
    const close = istDay(new Date('2026-09-07T23:59:59+05:30'))
    expect(close).toBe(open)
  })

  test('an evening in New York is already the next day in Delhi', () => {
    const ny = istDay(new Date('2026-09-06T22:00:00-04:00'))
    expect(ny).toBe(istDay(istDate('2026-09-07')))
  })
})

describe('istDaysBetween', () => {
  test('counts calendar days, and signs them', () => {
    expect(istDaysBetween(istDate('2026-09-07'), istDate('2026-09-18'))).toBe(11)
    expect(istDaysBetween(istDate('2026-09-18'), istDate('2026-09-07'))).toBe(-11)
    expect(istDaysBetween(istDate('2026-09-07'), istDate('2026-09-07'))).toBe(0)
  })

  test('crosses a month and a year without drifting', () => {
    expect(istDaysBetween(istDate('2026-09-30'), istDate('2026-10-01'))).toBe(1)
    expect(istDaysBetween(istDate('2026-12-31'), istDate('2027-01-01'))).toBe(1)
  })
})

describe('formatIst', () => {
  test('renders the IST date, not the local one', () => {
    // 19:00 UTC on 6 September is 00:30 on the 7th in Delhi. A formatter left
    // on the reader's zone would print "6 September" here, which is the bug
    // this module exists to close.
    const at = new Date('2026-09-06T19:00:00Z')
    expect(formatIst(at, { day: 'numeric', month: 'long' })).toBe('7 September')
  })

  test('takes an ISO string as readily as a Date, because rows arrive as strings', () => {
    // Asserted against the Date form rather than against a spelling: how a
    // locale abbreviates a month is its business, and pinning it here would
    // fail on a wording change that is not this module's.
    const iso = '2026-09-06T19:00:00Z'
    const options = { day: 'numeric', month: 'short' } as const
    expect(formatIst(iso, options)).toBe(formatIst(new Date(iso), options))
    expect(formatIst(iso, options)).toContain('7')
  })

  test('the locale is the caller’s, the zone never is', () => {
    const at = new Date('2026-09-06T19:00:00Z')
    // Both render the same IST instant; only the wording differs.
    expect(formatIst(at, { day: '2-digit', month: '2-digit' }, 'en-IN')).toContain(
      '07'
    )
  })
})

import { describe, expect, test } from 'vitest'
import {
  LEAGUE_DAYS,
  METAID_RE,
  PRIZES,
  PRIZE_PLACES,
  PRIZE_POOL,
  leaguePhase,
  phaseLabel,
  takenMetaids,
} from '../src/user/League'
import type { LeagueEntry } from '../src/user/api'

/**
 * The League screen is static except for one thing: where today sits against
 * the window. That is the only place it can quietly go stale, so it is the
 * only place worth a test.
 */
describe('leaguePhase', () => {
  /**
   * Midday IST on the given September day.
   *
   * Written with an explicit offset rather than `new Date(2026, 8, day)`,
   * which is midnight in whatever zone the machine running the test is set
   * to. That is the same IST date for most of the world and the day before
   * for anyone east of Delhi, so the old helper made these tests pass in
   * Mumbai and fail in Auckland.
   */
  const on = (day: number) =>
    new Date(`2026-09-${String(day).padStart(2, '0')}T12:00:00+05:30`)

  test('counts the days remaining before the league opens', () => {
    expect(leaguePhase(on(4))).toEqual({ name: 'before', days: 3 })
    expect(leaguePhase(on(6))).toEqual({ name: 'before', days: 1 })
  })

  test('the first and last days are both inside the window', () => {
    expect(leaguePhase(on(7))).toEqual({ name: 'running', day: 1 })
    expect(leaguePhase(on(18))).toEqual({ name: 'running', day: LEAGUE_DAYS })
  })

  test('the day after the last day is over, not one past the end', () => {
    expect(leaguePhase(on(19))).toEqual({ name: 'after' })
    expect(leaguePhase(new Date(2027, 0, 1))).toEqual({ name: 'after' })
  })

  test('the window is 7 to 18 September inclusive', () => {
    expect(LEAGUE_DAYS).toBe(12)
  })

  test('one day out reads as tomorrow rather than "in 1 days"', () => {
    expect(phaseLabel(leaguePhase(on(6)))).toBe('Starts tomorrow')
    expect(phaseLabel(leaguePhase(on(4)))).toBe('Starts in 3 days')
    expect(phaseLabel(leaguePhase(on(9)))).toBe('Day 3 of 12, trading now')
  })

  test('a time of day never moves the count', () => {
    const early = new Date('2026-09-04T00:01:00+05:30')
    const late = new Date('2026-09-04T23:59:00+05:30')
    expect(leaguePhase(early)).toEqual(leaguePhase(late))
  })

  /**
   * The window is an IST window, because that is what the database counts in.
   * These pin the two edges to the minute: one minute either side of IST
   * midnight has to fall on opposite sides of the phase, whatever zone the
   * reader -- or the machine running this -- happens to be in.
   */
  describe('the boundary is IST midnight, not the reader midnight', () => {
    test('opens at 00:00 IST on 7 September', () => {
      expect(leaguePhase(new Date('2026-09-06T18:29:00Z'))).toEqual({
        name: 'before',
        days: 1,
      })
      expect(leaguePhase(new Date('2026-09-06T18:30:00Z'))).toEqual({
        name: 'running',
        day: 1,
      })
    })

    test('closes at the end of 18 September IST', () => {
      expect(leaguePhase(new Date('2026-09-18T18:29:00Z'))).toEqual({
        name: 'running',
        day: LEAGUE_DAYS,
      })
      expect(leaguePhase(new Date('2026-09-18T18:30:00Z'))).toEqual({
        name: 'after',
      })
    })

    test('a reader in New York on the evening of the 6th is already in day 1', () => {
      // 22:00 on 6 September in New York is 07:30 on the 7th in Delhi. Under
      // the old local-midnight arithmetic this read "Starts tomorrow" while
      // the league was running.
      expect(leaguePhase(new Date('2026-09-06T22:00:00-04:00'))).toEqual({
        name: 'running',
        day: 1,
      })
    })
  })
})

/**
 * One person may hold several entries, and may not enter the same account
 * twice. The screen answers that as it is typed; the unique index on
 * (user_id, metaid) is what actually enforces it.
 */
describe('takenMetaids', () => {
  const entry = (id: number, metaid: string): LeagueEntry => ({
    id,
    metaid,
    email: 'alex@example.com',
    created_at: '2026-09-01T00:00:00+05:30',
  })

  const entries = [entry(1, '43563'), entry(2, '9012')]

  test('lists every number already entered', () => {
    expect(takenMetaids(entries)).toEqual(['43563', '9012'])
  })

  test('excludes the row being corrected, so an unchanged number can be saved', () => {
    expect(takenMetaids(entries, 1)).toEqual(['9012'])
    expect(takenMetaids(entries, 1)).not.toContain('43563')
  })

  test('an id that matches nothing excludes nothing', () => {
    expect(takenMetaids(entries, 99)).toEqual(['43563', '9012'])
  })

  test('no entries, nothing taken', () => {
    expect(takenMetaids([])).toEqual([])
  })
})

describe('METAID_RE', () => {
  test('accepts four to six digits', () => {
    for (const ok of ['4356', '43563', '435631']) {
      expect(METAID_RE.test(ok)).toBe(true)
    }
  })

  test('rejects anything shorter, longer, or not a digit', () => {
    for (const bad of ['435', '4356312', '', '43a63', 'NW-4356', '4356.1', '-4356', ' 43563 ']) {
      expect(METAID_RE.test(bad)).toBe(false)
    }
  })
})

describe('prize totals', () => {
  test('the pool is the sum of the tiers, not a number typed twice', () => {
    expect(PRIZE_POOL).toBe(1000 + 500 + 250 + 47 * 50)
    expect(PRIZE_POOL).toBe(4100)
  })

  test('the places add up to the fiftieth', () => {
    expect(PRIZE_PLACES).toBe(50)
    expect(PRIZES.at(-1)?.places).toBe(47)
  })
})

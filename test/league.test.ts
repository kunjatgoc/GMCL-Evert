import { describe, expect, test } from 'vitest'
import {
  LEAGUE_DAYS,
  METAID_RE,
  PRIZES,
  PRIZE_PLACES,
  PRIZE_POOL,
  leaguePhase,
  phaseLabel,
} from '../src/user/League'

/**
 * The League screen is static except for one thing: where today sits against
 * the window. That is the only place it can quietly go stale, so it is the
 * only place worth a test.
 */
describe('leaguePhase', () => {
  const on = (day: number) => new Date(2026, 8, day)

  test('counts the days remaining before the league opens', () => {
    expect(leaguePhase(on(4))).toEqual({ name: 'before', days: 3 })
    expect(leaguePhase(on(6))).toEqual({ name: 'before', days: 1 })
  })

  test('the first and last days are both inside the window', () => {
    expect(leaguePhase(on(7))).toEqual({ name: 'running', day: 1 })
    expect(leaguePhase(on(13))).toEqual({ name: 'running', day: LEAGUE_DAYS })
  })

  test('the day after the last day is over, not day eight', () => {
    expect(leaguePhase(on(14))).toEqual({ name: 'after' })
    expect(leaguePhase(new Date(2027, 0, 1))).toEqual({ name: 'after' })
  })

  test('the window is the seven days the screen announces', () => {
    expect(LEAGUE_DAYS).toBe(7)
  })

  test('one day out reads as tomorrow rather than "in 1 days"', () => {
    expect(phaseLabel(leaguePhase(on(6)))).toBe('Starts tomorrow')
    expect(phaseLabel(leaguePhase(on(4)))).toBe('Starts in 3 days')
    expect(phaseLabel(leaguePhase(on(9)))).toBe('Day 3 of 7, trading now')
  })

  test('a time of day never moves the count', () => {
    const early = new Date(2026, 8, 4, 0, 1)
    const late = new Date(2026, 8, 4, 23, 59)
    expect(leaguePhase(early)).toEqual(leaguePhase(late))
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

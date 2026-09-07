import { describe, expect, test } from 'vitest'
import { ENTRANT_PATHS, ENTRANT_PATH_SET } from '../src/user/paths'

/**
 * The rail and the URL check have to agree about what a panel path is.
 *
 * Not a test of React, and it does not render anything -- importing
 * UserDashboard would drag in motion, lucide and the whole panel. What is
 * worth guarding is the list itself, because the failure it prevents is the
 * quiet one: a path in the rail and not in the set still navigates from
 * inside the panel and serves the marketing page on a refresh.
 *
 * ROUTES is checked against this list by shape rather than by import for that
 * reason -- see the note in src/user/paths.ts.
 */
describe('entrant paths', () => {
  test('every declared path reaches the URL check', () => {
    // Arrange
    const declared = Object.values(ENTRANT_PATHS)

    // Act
    const missing = declared.filter((p) => !ENTRANT_PATH_SET.has(p))

    // Assert
    expect(missing).toEqual([])
  })

  test('the set holds nothing the list does not declare', () => {
    // Arrange
    const declared = new Set<string>(Object.values(ENTRANT_PATHS))

    // Act
    const extra = [...ENTRANT_PATH_SET].filter((p) => !declared.has(p))

    // Assert
    expect(extra).toEqual([])
  })

  test('paths are rooted, and carry no trailing slash', () => {
    // main.tsx normalises the location by stripping trailing slashes before
    // it looks the path up, so a declared '/league/' would never match.
    for (const path of Object.values(ENTRANT_PATHS)) {
      expect(path.startsWith('/')).toBe(true)
      expect(path.endsWith('/')).toBe(false)
    }
  })

  test('no path is declared twice under two names', () => {
    // Arrange
    const declared = Object.values(ENTRANT_PATHS)

    // Assert
    expect(new Set(declared).size).toBe(declared.length)
  })
})

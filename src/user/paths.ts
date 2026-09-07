/**
 * The entrant panel's paths, in one place.
 *
 * This list used to exist twice: once as `ROUTES` in UserDashboard.tsx, which
 * draws the rail, and once as `ENTRANT_PATHS` in main.tsx, which decides
 * whether a URL loads the panel at all. A comment asked the next person to
 * keep them in step, which is not a mechanism.
 *
 * Missing one is quiet and then baffling. The rail link keeps working --
 * PanelShell navigates with pushState and never consults main.tsx -- so the
 * screen looks fine until someone refreshes on it or opens it in a new tab,
 * at which point main.tsx falls through its chain and serves the marketing
 * landing page to a signed-in entrant. README.md records this class of bug
 * biting once already, when /league was in the app and not in vercel.json.
 *
 * Strings only, and no component imports: main.tsx must be able to read this
 * without pulling the lazy panel chunk into the marketing bundle.
 */
export const ENTRANT_PATHS = {
  dashboard: '/dashboard',
  requestMetaid: '/request-metaid',
  league: '/league',
  leaderboard: '/leaderboard',
  profile: '/profile',
} as const

/** The same list as a set, for main.tsx's "is this a panel URL" test. */
export const ENTRANT_PATH_SET: ReadonlySet<string> = new Set(
  Object.values(ENTRANT_PATHS),
)

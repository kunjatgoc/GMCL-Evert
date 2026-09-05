/**
 * Every date this product shows or counts is an IST date.
 *
 * The league runs on Indian time, and the database already agrees: `db/schema.sql`
 * sets the database timezone to Asia/Kolkata, so `current_date` in every
 * admin count and `created_at >= current_date` in every "today" filter means
 * midnight in Delhi. The browser was the half that disagreed -- `new Date()`
 * and `toLocaleDateString` read the reader's own zone, so a reader outside
 * India saw a different day than the one the server had counted them into.
 *
 * `en-IN` is a locale, not a timezone. Writing it without `timeZone` is the
 * trap this module exists to close: it changes the wording and leaves the
 * clock alone.
 *
 * So: nothing in the app calls `toLocaleDateString`, `getFullYear` or
 * `new Date(y, m, d)` directly. It comes through here, and here always says
 * Asia/Kolkata.
 */

export const IST = 'Asia/Kolkata'

/** India has had no daylight saving since 1945 and the offset is a flat
 *  +05:30, so an IST wall clock is arithmetic rather than a lookup. Only used
 *  to build a fixed date below; everything that reads a date goes through
 *  Intl, which would handle a rule change on its own. */
const IST_OFFSET = '+05:30'

/**
 * A date on the IST calendar, as the instant it begins.
 *
 * `istDate('2026-09-07')` is 7 September in Delhi however the machine reading
 * it is set, where `new Date(2026, 8, 7)` was 7 September only for a reader
 * already in India.
 */
export const istDate = (yyyyMmDd: string) =>
  new Date(`${yyyyMmDd}T00:00:00${IST_OFFSET}`)

/** en-CA renders as YYYY-MM-DD, which is the only reason it is used here. */
const ymd = new Intl.DateTimeFormat('en-CA', {
  timeZone: IST,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * Which day an instant falls on in IST, numbered so that subtracting two of
 * them counts days.
 *
 * Built on `Date.UTC`, where every day is exactly 86,400,000ms. The old
 * version subtracted two local midnights and rounded, because a DST boundary
 * makes one of them 23 or 25 hours long. Nothing here needs rounding: these
 * are calendar dates converted to UTC, and UTC has no DST to trip over.
 */
export function istDay(at: Date): number {
  const [y, m, d] = ymd.format(at).split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86_400_000
}

/** Whole days from `a` to `b`, counted on the IST calendar. Negative when
 *  `b` is the earlier of the two. */
export const istDaysBetween = (a: Date, b: Date) => istDay(b) - istDay(a)

/**
 * One instant, formatted in IST.
 *
 * The locale stays the caller's -- `en-GB` and `en-IN` order and word a date
 * differently and the screens have already chosen -- but the zone never does.
 */
export const formatIst = (
  at: Date | string,
  options: Intl.DateTimeFormatOptions,
  locale = 'en-GB'
) =>
  new Intl.DateTimeFormat(locale, { ...options, timeZone: IST }).format(
    typeof at === 'string' ? new Date(at) : at
  )

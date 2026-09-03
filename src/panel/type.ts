/**
 * The panel's whole type scale. Three sizes, no fourth.
 *
 * Ten near-identical sizes is what a design drifts into, not what it is
 * designed as -- 13.5 next to 14 next to 14.5 reads as sloppy, never as
 * hierarchy. Three steps far enough apart to actually separate is hierarchy.
 *
 * Nothing here is below 14px. The smallest thing on the screen still has to
 * be readable by someone doing this job all day.
 */
export const TEXT = {
  /** Column headers, field labels, secondary lines, chips. */
  label: 'text-[14px]',
  /** Everything read to do the work: rows, inputs, nav, notes, buttons. */
  body: 'text-[17px]',
  /** Page headings and the dashboard numbers. */
  display: 'text-[clamp(2.2rem,4vw,3.1rem)]',
} as const

/**
 * The panel's input skin, and the label above it. Here rather than in one
 * screen because two panels wear them now -- the admin filter bar and the
 * entrant's forms -- and a second copy is how the focus ring ends up two
 * different greens.
 */
export const control =
  `${TEXT.body} rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-white ` +
  'placeholder:text-white/30 outline-none transition-all duration-300 ' +
  'focus:border-[rgba(62,230,138,0.5)] focus:bg-white/[0.05] ' +
  'focus:shadow-[0_0_0_3px_rgba(62,230,138,0.1)]'

export const fieldLabel = `${TEXT.label} font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]`

/** The panel's one primary action. Green is for actions and active state. */
export const primaryAction =
  `${TEXT.body} inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl ` +
  'border border-[rgba(62,230,138,0.35)] bg-[rgba(62,230,138,0.12)] px-5 py-3 font-semibold ' +
  'text-[#3EE68A] transition-colors duration-300 hover:bg-[rgba(62,230,138,0.2)] ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

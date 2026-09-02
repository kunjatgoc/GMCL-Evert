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

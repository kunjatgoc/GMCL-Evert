/**
 * The panel's whole type scale. Three sizes, no fourth.
 *
 * Ten near-identical sizes is what a design drifts into, not what it is
 * designed as -- 13.5 next to 14 next to 14.5 reads as sloppy, never as
 * hierarchy. Three steps far enough apart to actually separate is hierarchy.
 *
 * These used to be 14 / 17 / up-to-49.6, and this comment used to say nothing
 * would go below 14px so it stayed readable all day. The floor was the right
 * instinct applied to the wrong scale: 14 next to 17 is the proportion of an
 * article, and none of this is an article. It is a table of account requests
 * being scanned by someone who wants more rows on the screen, not fewer.
 *
 * On a 1280x800 laptop the old scale needed 1384px of table in 902px of room.
 * That is where the horizontal scrollbar came from -- not from too many
 * columns, from prose-sized type doing a spreadsheet's job.
 *
 * 13 is still comfortably readable; it is what the same row in Linear or
 * Stripe is set in. The floor is real, it just sits one step lower.
 */
export const TEXT = {
  /** Column headers, field labels, secondary lines, chips. */
  label: 'text-[13px]',
  /** Everything read to do the work: rows, inputs, nav, notes, buttons. */
  body: 'text-[15px]',
  /**
   * Page headings and the dashboard numbers.
   *
   * The old value was clamp(2.2rem, 4vw, 3.1rem), which sounds responsive and
   * is not: 4vw passes 3.1rem at 1240px, so every laptop and every desktop got
   * the 49.6px ceiling and only phones ever saw the middle term. A clamp whose
   * max is reached by its smallest real viewport is a fixed size with extra
   * steps. This one tops out at 32px and means it.
   */
  display: 'text-[clamp(1.6rem,2.4vw,2rem)]',
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

/**
 * A <select> wearing the same skin. `appearance-none` is the whole point: left
 * on `auto` the browser draws its own control, which came out 44px tall beside
 * 47.5px inputs and with macOS's own arrow box on the end -- two reasons the
 * filter bar did not line up.
 *
 * Losing the native arrow means drawing one, and a <select> cannot hold a
 * pseudo-element, so it is a background image. As an inline style rather than
 * a Tailwind arbitrary value because the SVG is full of spaces and quotes that
 * the class scanner would need escaping for -- and an escaped one-off is
 * harder to read than the style it replaces.
 */
export const selectControl = `${control} cursor-pointer appearance-none pr-10`

export const SELECT_CHEVRON = {
  backgroundImage:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'><path d='M1 1.5 6 6.5 11 1.5' fill='none' stroke='%23A6B3AC' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 0.9rem center',
  backgroundSize: '0.72rem',
} as const

/**
 * The panel's four buttons. Four, not "whatever each screen wrote": the same
 * ghost button had two radii and two text opacities before this existed, and
 * the icon button was a 40px square in one place and a 36px circle in another.
 *
 * Which to reach for:
 *
 *   btnPrimary    the one action a screen exists for. One per view.
 *   btnSecondary  a real action that is not that one -- confirming, dismissing
 *                 a finished state.
 *   btnGhost      cancel, reset, sign out. Anything that undoes or leaves.
 *   btnIcon       a square with only a glyph in it, where the glyph is obvious.
 *
 * Green is for actions and active state, never decoration -- so only the top
 * two are green at all.
 */
const btnBase =
  'inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap ' +
  'rounded-xl transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50'

/**
 * The light sweep is a `before:` pseudo-element rather than a child <span>, so
 * the whole button is a class string and nothing has to remember to nest an
 * extra element to get the shine. Needs `group` on the button itself.
 */
export const btnPrimary =
  `${TEXT.body} ${btnBase} group relative overflow-hidden px-5 py-2.5 font-semibold text-black ` +
  'bg-[linear-gradient(180deg,#7DF7B8_0%,#3EE68A_38%,#22A968_100%)] ' +
  'shadow-[0_8px_28px_-8px_rgba(62,230,138,0.55)] hover:brightness-110 ' +
  "before:pointer-events-none before:absolute before:-inset-y-8 before:-left-1/3 before:w-1/3 " +
  "before:rotate-12 before:bg-white/40 before:opacity-0 before:blur-md before:content-[''] " +
  'before:transition-all before:duration-700 before:ease-[cubic-bezier(0.16,1,0.3,1)] ' +
  'hover:before:left-[110%] hover:before:opacity-100'

export const btnSecondary =
  `${TEXT.body} ${btnBase} border border-[rgba(62,230,138,0.35)] bg-[rgba(62,230,138,0.12)] ` +
  'px-5 py-2.5 font-semibold text-[#3EE68A] hover:bg-[rgba(62,230,138,0.2)]'

/** The one alarm colour, and only for an action that cannot be taken back. */
export const btnDestructive =
  `${TEXT.body} ${btnBase} border border-[rgba(228,85,60,0.4)] bg-[rgba(228,85,60,0.12)] ` +
  'px-5 py-2.5 font-semibold text-[var(--admin-destructive)] hover:bg-[rgba(228,85,60,0.2)]'

export const btnGhost =
  `${TEXT.body} ${btnBase} px-3.5 py-2.5 text-[#E4EAE7]/70 hover:text-white`

/**
 * Not a fifth button -- a size, appended to one of the four.
 *
 * A button in a table row is not the same object as a button at the bottom of
 * a form, however identical it looks. The row one is repeated once per record
 * and is charged for in table width: two of them at page size held the Actions
 * column at 252px, which is a fifth of a laptop's usable width spent on the
 * word "Approve" eleven times.
 *
 * The `!` is doing real work. btnSecondary already carries TEXT.body, and two
 * text utilities of equal specificity are resolved by their order in the
 * generated stylesheet rather than in the class string -- which is not a thing
 * to leave to chance from here.
 */
export const btnRow = '!text-[13px] gap-1.5 px-2.5 py-1'

export const btnIcon =
  `${btnBase} size-10 shrink-0 border border-white/10 bg-white/[0.03] text-[#E4EAE7] ` +
  'hover:border-[rgba(62,230,138,0.4)] hover:text-white ' +
  'disabled:hover:border-white/10'

/**
 * A pop-up, in two parts: the <dialog> itself and the card inside it.
 *
 * Here rather than in the screen that happens to own the first one, so the
 * second and third are the same size and sit at the same place instead of
 * being eyeballed again. Anything modal in either panel wears these.
 *
 * m-auto because Tailwind's preflight zeroes the margin a modal dialog centres
 * itself with -- without it the box sits in the top-left corner.
 *
 * Width is the one thing a modal is allowed to choose, because it follows
 * what is inside: a question fits in 34rem, a record does not. Both are
 * written out in full rather than composed, so Tailwind's scanner reads the
 * class names literally -- a string it has to evaluate is a class it never
 * generates.
 */
const MODAL_CHROME =
  'm-auto rounded-2xl border-0 bg-transparent p-0 ' +
  'text-[#E4EAE7] backdrop:bg-black/70 backdrop:backdrop-blur-sm'

/** A question and its two buttons. */
export const modalShell = `w-[min(34rem,calc(100vw-2rem))] ${MODAL_CHROME}`

/** A question with the record it is about, laid out in two columns. */
export const modalShellWide = `w-[min(40rem,calc(100vw-2rem))] ${MODAL_CHROME}`

export const modalCard =
  'relative rounded-2xl border border-white/8 bg-[var(--admin-card)] p-7 sm:p-8'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Check, ChevronLeft, ChevronRight, Search, Undo2, X } from 'lucide-react'
import { Flag } from '../components/ui/Flag'
import { EASE } from '../lib/motion'
import {
  TEXT,
  SELECT_CHEVRON,
  btnGhost,
  btnRow,
  btnIcon,
  btnPrimary,
  btnSecondary,
  control,
  fieldLabel,
  selectControl,
} from '../panel/type'
import { RowsSkeleton } from '../panel/Skeleton'
import {
  query,
  type Page,
  decideMetaid,
  listMetaidQueue,
  setIdGiven,
  undoMetaid,
  type MetaidRow,
  type MetaidStatus,
} from './api'

const PER_PAGE = 25

/** Rows enter in sequence, but the stagger is capped: 25 rows at 25ms each is
 *  a pleasant cascade, 25 rows at 60ms is a page that takes a second to
 *  finish arriving. */
const ROW_STAGGER = 0.022

type Column<T> = {
  header: string
  cell: (row: T) => ReactNode
  /** Tailwind width for this column's loading placeholder. Without it every
   *  column shimmers at the same width and the skeleton stops being the
   *  shape of the table. */
  skeleton?: string
  /** Columns that only add context are dropped rather than squeezed on phones. */
  hideOnMobile?: boolean
}

/**
 * One control in the filter bar. Each screen says what its own data is worth
 * filtering by, rather than every list wearing the same search box and pair of
 * dates whether they mean anything there or not.
 *
 * `name` is the query parameter, so it has to match what the endpoint reads.
 */
type Filter = {
  name: string
  label: string
  /** A date picker instead of a text box. Ignored when `options` is given. */
  kind?: 'text' | 'date'
  placeholder?: string
  /** Present turns this into a dropdown, with `all` as the empty first row. */
  options?: readonly { value: string; label: string }[]
  all?: string
  /** Tailwind width. Text controls grow to fill the row; the rest do not. */
  width?: string
}

type Draft = Record<string, string>

const emptyDraft = (filters: readonly Filter[]): Draft =>
  Object.fromEntries(filters.map((f) => [f.name, '']))

/** The same shape, filled from `?status=pending` and friends.
 *
 *  Only declared filters are read, so a hand-typed parameter this screen does
 *  not offer cannot reach the endpoint. It is what lets a dashboard tile link
 *  straight to the rows it counted, and it makes a filtered list a URL someone
 *  can send to a colleague. */
const draftFromUrl = (filters: readonly Filter[]): Draft => {
  const params = new URLSearchParams(window.location.search)
  return Object.fromEntries(filters.map((f) => [f.name, params.get(f.name) ?? '']))
}

/** Every list has a created_at, so these two are worth offering on all of
 *  them -- which is not the same as offering them by default to a screen that
 *  never asked. A screen still has to list them. */
export const DATE_RANGE: readonly Filter[] = [
  { name: 'date_from', label: 'From', kind: 'date' },
  { name: 'date_to', label: 'To', kind: 'date' },
]

type Props<T> = {
  title: string
  accent: string
  columns: Column<T>[]
  filters: readonly Filter[]
  fetchPage: (qs: string) => Promise<Page<T>>
  /** Only needed when a list draws its rows from more than one table, where
   *  two rows can honestly share an id. Defaults to the id. */
  rowKey?: (row: T) => string
}

function UserList<T extends { id: number }>({
  title,
  accent,
  columns,
  filters,
  fetchPage,
  rowKey = (row) => String(row.id),
}: Props<T>) {
  // `draft` is what the inputs hold; `applied` is what the last search asked
  // for. Splitting them is what lets the query fire on submit instead of on
  // every keystroke -- no debounce, no request per character.
  const [draft, setDraft] = useState<Draft>(() => draftFromUrl(filters))
  const [applied, setApplied] = useState<Draft>(() => draftFromUrl(filters))
  const [page, setPage] = useState(1)

  const [data, setData] = useState<Page<T> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchPage(query({ ...applied, page, per_page: PER_PAGE })))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the list.')
    } finally {
      setLoading(false)
    }
  }, [applied, page, fetchPage])

  useEffect(() => {
    load()
  }, [load])

  const search = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setApplied(draft)
  }

  const reset = () => {
    setDraft(emptyDraft(filters))
    setApplied(emptyDraft(filters))
    setPage(1)
  }

  const total = data?.total ?? 0
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE))
  const first = total === 0 ? 0 : (page - 1) * PER_PAGE + 1
  const last = Math.min(page * PER_PAGE, total)

  return (
    <section>
      <header>
        {/* The hero's masked reveal, scaled down to a page heading. */}
        <h1
          className={`${TEXT.display} overflow-hidden pb-[0.1em] font-bold leading-[1.05]`}
        >
          <motion.span
            className="block"
            initial={{ y: '110%' }}
            animate={{ y: '0%' }}
            transition={{ duration: 0.9, ease: EASE }}
          >
            {title} {accent}
          </motion.span>
        </h1>

      </header>

      <motion.form
        onSubmit={search}
        className="glass glass-lip relative mt-5 flex flex-wrap items-end gap-2.5 overflow-hidden rounded-2xl bg-[var(--admin-card)] p-3.5 sm:p-4"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.32 }}
      >
        {filters.map((f) => {
          const set = (v: string) => setDraft({ ...draft, [f.name]: v })
          return (
            <label
              key={f.name}
              className={`flex flex-col gap-1 ${
                f.width ?? (f.options || f.kind === 'date' ? '' : 'min-w-[13rem] flex-1')
              }`}
            >
              <span className={fieldLabel}>{f.label}</span>

              {f.options ? (
                <select
                  value={draft[f.name]}
                  onChange={(e) => set(e.target.value)}
                  style={SELECT_CHEVRON}
                  className={`${selectControl} ${f.width ?? 'w-[11.5rem]'}`}
                >
                  <option value="" className="bg-[#121212]">
                    {f.all ?? 'All'}
                  </option>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value} className="bg-[#121212]">
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                // Native date input for dates. A picker library would be three
                // dependencies for something every browser already ships.
                <input
                  type={f.kind === 'date' ? 'date' : 'text'}
                  value={draft[f.name]}
                  onChange={(e) => set(e.target.value)}
                  placeholder={f.placeholder}
                  className={`${control} ${
                    f.kind === 'date' ? 'cursor-pointer [color-scheme:dark]' : ''
                  }`}
                />
              )}
            </label>
          )
        })}

        <div className="flex items-center gap-2">
        <button type="submit" className={btnPrimary}>
          <Search className="relative size-4" />
          <span className="relative">Search</span>
        </button>

        <button
          type="button"
          onClick={reset}
          className={btnGhost}
        >
          Reset
        </button>
        </div>
      </motion.form>

      <motion.div
        className="glass glass-lip relative mt-4 overflow-hidden rounded-2xl bg-[var(--admin-card)]"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.75, ease: EASE, delay: 0.4 }}
      >
        <div className="overflow-x-auto">
          <table className={`${TEXT.body} w-full min-w-[52rem] border-collapse text-left`}>
            <thead>
              <tr className="border-b border-white/8 bg-white/[0.03]">
                {columns.map((c) => (
                  <th
                    key={c.header}
                    className={`${TEXT.label} whitespace-nowrap px-2.5 py-3 font-semibold uppercase tracking-[0.1em] text-[var(--admin-muted)] ${
                      c.hideOnMobile ? 'hidden md:table-cell' : ''
                    }`}
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <RowsSkeleton columns={columns} />}

              {!loading && error && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className={`${TEXT.body} px-5 py-12 text-center text-[var(--admin-destructive)]`}
                  >
                    {error}
                  </td>
                </tr>
              )}

              {!loading && !error && total === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-12 text-center">
                    {/* An unfinished chart with no data on it. The point is to
                        say nothing is broken -- the net just came back empty. */}
                    <img
                      src="/img/empty-state.webp"
                      alt=""
                      aria-hidden
                      className="mx-auto mb-5 w-full max-w-xs opacity-70"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                    <p className={`${TEXT.body} text-[var(--admin-muted)]`}>
                      No results found.
                    </p>
                  </td>
                </tr>
              )}

              {!loading &&
                !error &&
                data?.rows.map((row, i) => (
                  <motion.tr
                    key={rowKey(row)}
                    className="border-t border-white/[0.06] transition-colors duration-200 hover:bg-[rgba(31,92,65,0.28)]"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      type: 'spring',
                      stiffness: 320,
                      damping: 30,
                      delay: i * ROW_STAGGER,
                    }}
                  >
                    {columns.map((c) => (
                      <td
                        key={c.header}
                        // Wrapping, where the header above still does not.
                        // Nine columns of this data do not fit a laptop on one
                        // line at any font size worth reading, and the choice
                        // was between a sideways scrollbar and a taller row.
                        // A taller row can still be read without moving
                        // anything. Costs about 7px of height per row and
                        // takes 210px off the width.
                        //
                        // Centred rather than top-aligned, because the row's
                        // height is set by whichever cell is tallest -- a pair
                        // of buttons, or a name that wrapped -- and top
                        // alignment then leaves every other cell floating
                        // above a gap. Middle is what makes the row read as
                        // one line across.
                        className={`px-2.5 py-3 align-middle ${
                          c.hideOnMobile ? 'hidden md:table-cell' : ''
                        }`}
                      >
                        {c.cell(row)}
                      </td>
                    ))}
                  </motion.tr>
                ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      <div className={`${TEXT.label} mt-4 flex items-center justify-between gap-4 text-[var(--admin-muted)]`}>
        <span className="tabular">
          {first}–{last} of {total.toLocaleString('en-US')}
        </span>
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            aria-label="Previous page"
            className={btnIcon}
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="tabular px-1">
            {page} / {lastPage}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            disabled={page >= lastPage || loading}
            aria-label="Next page"
            className={btnIcon}
          >
            <ChevronRight className="size-4" />
          </button>
        </span>
      </div>
    </section>
  )
}
const DASH = '—'

const STATUS_TONE: Record<MetaidStatus, string> = {
  pending: 'text-[var(--admin-gold)]',
  approved: 'text-[#3EE68A]',
  rejected: 'text-[var(--admin-destructive)]',
}

const muted = (text: string) => (
  <span className="text-[var(--admin-muted)]">{text}</span>
)

/**
 * Every account request, from all three tables.
 *
 * `metaid_request` is what the signed-in dashboard writes; `registration` and
 * `real_account_request` are the landing form's, still taking rows. All three
 * answer the same question -- does this person have an MT5 account -- so one
 * screen answers it, in one vocabulary, with one set of buttons.
 *
 * Pending offers Approve and Reject. A decided row offers Undo, which puts it
 * back to pending and both buttons back. Where the row came from decides which
 * endpoint is called and nothing else: a dashboard request moves through
 * `metaid_request.status`, a landing-form row through `is_id_given`, and the
 * screen does not show the difference because there is no difference to show.
 *
 * Nothing here asks for confirmation, because nothing here is final. Deciding
 * sends no mail -- newera issues the MetaID by hand afterwards -- so a
 * mis-click is one press to undo rather than something to apologise for.
 */
export function MetaidQueue() {
  const [busy, setBusy] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  // A new identity for fetchPage is what UserList already reloads on, so a
  // decision refreshes the table without the table knowing decisions exist.
  const [version, setVersion] = useState(0)
  const fetchPage = useCallback(
    (qs: string) => listMetaidQueue(qs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version]
  )

  const keyOf = (r: MetaidRow) => `${r.source}-${r.id}`

  const move = async (row: MetaidRow, to: MetaidStatus) => {
    setBusy(keyOf(row))
    setFailed(null)
    try {
      if (row.source !== 'request') {
        await setIdGiven(row.source, row.id, to)
      } else if (to === 'pending') {
        await undoMetaid(row.id)
      } else {
        await decideMetaid(row.id, to)
      }
      setVersion((v) => v + 1)
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'Could not save that change.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      {failed && (
        <p role="alert" className={`${TEXT.label} mb-4 text-[var(--admin-destructive)]`}>
          {failed}
        </p>
      )}
      <UserList<MetaidRow>
        title="MetaTrader5 Account"
        accent="Requests"
        fetchPage={fetchPage}
        rowKey={keyOf}
        filters={[
          {
            name: 'status',
            label: 'Status',
            all: 'All statuses',
            width: 'w-[10.5rem]',
            options: [
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
            ],
          },
          {
            name: 'type',
            label: 'Type',
            all: 'All types',
            width: 'w-[10.5rem]',
            options: [
              { value: 'demo', label: 'Demo' },
              { value: 'real', label: 'Real' },
            ],
          },
          { name: 'q', label: 'Search', placeholder: 'Name, email or phone' },
          ...DATE_RANGE,
        ]}
        columns={[
          {
            header: 'User',
            skeleton: 'w-16',
            cell: (r) =>
              r.user_id === null ? (
                muted(DASH)
              ) : (
                <span className="tabular text-[var(--admin-muted)]">#{r.user_id}</span>
              ),
          },
          {
            header: 'Request',
            skeleton: 'w-16',
            cell: (r) => <span className="tabular text-[var(--admin-muted)]">#{r.id}</span>,
            hideOnMobile: true,
          },
          {
            header: 'Name',
            skeleton: 'w-36',
            cell: (r) => r.full_name ?? muted(DASH),
          },
          {
            header: 'Phone',
            skeleton: 'w-32',
            cell: (r) =>
              r.phone ? <span className="tabular">{r.phone}</span> : muted(DASH),
            hideOnMobile: true,
          },
          {
            header: 'Country',
            skeleton: 'w-14',
            cell: (r) =>
              r.country ? (
                <span className={`${TEXT.label} inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5`}>
                  <Flag code={r.country} className="size-3.5" />
                  {r.country}
                </span>
              ) : (
                muted(DASH)
              ),
            hideOnMobile: true,
          },
          {
            header: 'Email',
            skeleton: 'w-56',
            cell: (r) => (
              <span className="font-medium text-white">{r.email}</span>
            ),
          },
          {
            header: 'Type',
            skeleton: 'w-16',
            cell: (r) => (
              <span className={`${TEXT.label} rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 capitalize`}>
                {r.type}
              </span>
            ),
          },
          {
            header: 'Status',
            skeleton: 'w-20',
            cell: (r) => (
              <span className={`font-semibold capitalize ${STATUS_TONE[r.status]}`}>
                {r.status}
              </span>
            ),
          },
          {
            header: 'Actions',
            skeleton: 'w-32',
            // The status decides these, and nothing else does. Same buttons
            // under the same word, whichever table the row came from.
            cell: (r) => {
              const working = busy === keyOf(r)

              if (r.status !== 'pending') {
                return (
                  <button
                    type="button"
                    disabled={working}
                    onClick={() => move(r, 'pending')}
                    className={`${btnGhost} ${btnRow}`}
                  >
                    <Undo2 className="size-3.5" />
                    Undo
                  </button>
                )
              }

              return (
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={working}
                    onClick={() => move(r, 'approved')}
                    className={`${btnSecondary} ${btnRow}`}
                  >
                    <Check className="size-3.5" />
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={working}
                    onClick={() => move(r, 'rejected')}
                    className={`${btnGhost} ${btnRow} hover:text-[var(--admin-destructive)]`}
                  >
                    <X className="size-3.5" />
                    Reject
                  </button>
                </span>
              )
            },
          },
        ]}
      />
    </>
  )
}

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Check, ChevronLeft, ChevronRight, Loader2, Search, X } from 'lucide-react'
import { COUNTRIES } from '../lib/countries'
import { EASE } from '../lib/motion'
import {
  TEXT,
  SELECT_CHEVRON,
  btnGhost,
  btnIcon,
  btnPrimary,
  btnSecondary,
  btnDestructive,
  control,
  fieldLabel,
  modalCard,
  modalShell,
  selectControl,
} from '../panel/type'
import { RowsSkeleton } from '../panel/Skeleton'
import {
  listDemoUsers,
  listRealUsers,
  query,
  type DemoUser,
  type Page,
  type RealUser,
  decideMetaid,
  listMetaidQueue,
  type MetaidRow,
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

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

type Props<T> = {
  title: string
  accent: string
  columns: Column<T>[]
  filters: readonly Filter[]
  fetchPage: (qs: string) => Promise<Page<T>>
}

function UserList<T extends { id: number }>({
  title,
  accent,
  columns,
  filters,
  fetchPage,
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
                    className={`${TEXT.label} whitespace-nowrap px-4 py-4 font-semibold uppercase tracking-[0.1em] text-[var(--admin-muted)] ${
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
                      Nothing matches those filters.
                    </p>
                  </td>
                </tr>
              )}

              {!loading &&
                !error &&
                data?.rows.map((row, i) => (
                  <motion.tr
                    key={row.id}
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
                        className={`whitespace-nowrap px-4 py-4 ${
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

const flagFor = (code: string) =>
  COUNTRIES.find((c) => c.code === code)?.flag ?? ''

export function DemoUsers() {
  return (
    <UserList<DemoUser>
      title="Demo ID"
      accent="Users"
      fetchPage={listDemoUsers}
      filters={[
        { name: 'q', label: 'Search', placeholder: 'Name, email or phone' },
        {
          name: 'country',
          label: 'Country',
          all: 'All countries',
          options: COUNTRIES.map((c) => ({
            value: c.code,
            label: `${c.flag} ${c.name}`,
          })),
        },
        ...DATE_RANGE,
      ]}
      columns={[
        {
          header: 'Name',
          skeleton: 'w-36',
          cell: (r) => <span className="font-medium text-white">{r.full_name}</span>,
        },
        { header: 'Email', skeleton: 'w-56', cell: (r) => r.email },
        {
          header: 'Phone',
          skeleton: 'w-32',
          cell: (r) => <span className="tabular">{r.mobile}</span>,
        },
        {
          header: 'Country',
          skeleton: 'w-14',
          cell: (r) => (
            <span className={`${TEXT.label} inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5`}>
              <span aria-hidden>{flagFor(r.country)}</span>
              {r.country}
            </span>
          ),
          hideOnMobile: true,
        },
        {
          header: 'Registered',
          skeleton: 'w-32',
          cell: (r) => (
            <span className="tabular text-[var(--admin-muted)]">{fmt(r.created_at)}</span>
          ),
          hideOnMobile: true,
        },
      ]}
    />
  )
}

export function RealUsers() {
  return (
    <UserList<RealUser>
      title="Real ID"
      accent="Users"
      fetchPage={listRealUsers}
      filters={[
        { name: 'q', label: 'Search', placeholder: 'Email' },
        ...DATE_RANGE,
      ]}
      columns={[
        {
          header: 'Email',
          skeleton: 'w-64',
          cell: (r) => <span className="font-medium text-white">{r.email}</span>,
        },
        {
          header: 'Requested',
          skeleton: 'w-32',
          cell: (r) => (
            <span className="tabular text-[var(--admin-muted)]">{fmt(r.created_at)}</span>
          ),
        },
      ]}
    />
  )
}

const STATUS_TONE = {
  pending: 'text-[var(--admin-gold)]',
  approved: 'text-[#3EE68A]',
  rejected: 'text-[var(--admin-destructive)]',
} as const

/**
 * The MetaID queue, for admins and newera staff.
 *
 * A decision is refused for anything already decided -- the procedure checks
 * `status = 'pending'` in the same UPDATE that moves it, so two people
 * clicking at once means the second one is told no rather than overwriting the
 * first. The buttons disappear on a decided row for the same reason, one step
 * earlier.
 */
/** The row a decision is about to be made on, and which decision. */
type Pending = { row: MetaidRow; status: 'approved' | 'rejected' }

/**
 * Asks before spending a decision.
 *
 * A decision cannot be taken back -- sp_decide_metaid only moves a row that is
 * still pending -- so the mis-click has to be caught before the request, not
 * apologised for after it. The row is named in full because two rows from the
 * same person differ only by type and address.
 */
function ConfirmDecision({
  pending,
  busy,
  onConfirm,
  onClose,
}: {
  pending: Pending
  busy: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const { row, status } = pending
  const approving = status === 'approved'

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && !busy && ref.current?.close()}
      aria-labelledby="decide-title"
      className={modalShell}
      style={{ colorScheme: 'dark' }}
    >
      <div className={modalCard}>
        <h2 id="decide-title" className={`${TEXT.body} font-semibold`}>
          {approving ? 'Approve this request?' : 'Reject this request?'}
        </h2>

        <dl className={`${TEXT.label} mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2`}>
          <dt className="text-[var(--admin-muted)]">Request</dt>
          <dd className="tabular">#{row.id}</dd>
          <dt className="text-[var(--admin-muted)]">User</dt>
          <dd className="tabular">#{row.user_id}</dd>
          <dt className="text-[var(--admin-muted)]">Type</dt>
          <dd className="capitalize">{row.type}</dd>
          <dt className="text-[var(--admin-muted)]">Issue to</dt>
          <dd className="break-all">{row.email}</dd>
        </dl>

        <p className={`${TEXT.label} mt-5 text-[var(--admin-muted)]`}>
          This cannot be undone, and the entrant sees the result on their
          dashboard.
        </p>

        <div className="mt-6 flex flex-wrap justify-end gap-2.5">
          {/* Cancel takes focus: the safe half of an irreversible pair should
              be what Enter reaches first. */}
          <button
            type="button"
            autoFocus
            disabled={busy}
            onClick={() => ref.current?.close()}
            className={btnGhost}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={approving ? btnSecondary : btnDestructive}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : approving ? (
              <Check className="size-4" />
            ) : (
              <X className="size-4" />
            )}
            {approving ? 'Approve' : 'Reject'}
          </button>
        </div>
      </div>
    </dialog>
  )
}

export function MetaidQueue() {
  const [pending, setPending] = useState<Pending | null>(null)
  const [deciding, setDeciding] = useState<number | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  // A new identity for fetchPage is what UserList already reloads on, so a
  // decision refreshes the table without the table knowing decisions exist.
  const [version, setVersion] = useState(0)
  const fetchPage = useCallback(
    (qs: string) => listMetaidQueue(qs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version]
  )

  const decide = async () => {
    if (!pending) return
    setDeciding(pending.row.id)
    setFailed(null)
    try {
      await decideMetaid(pending.row.id, pending.status)
      setPending(null)
      setVersion((v) => v + 1)
    } catch (e) {
      setPending(null)
      setFailed(e instanceof Error ? e.message : 'Could not record that.')
    } finally {
      setDeciding(null)
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
        title="MetaID"
        accent="Requests"
        fetchPage={fetchPage}
        filters={[
          {
            name: 'status',
            label: 'Status',
            all: 'Any status',
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
            cell: (r) => <span className="tabular text-[var(--admin-muted)]">#{r.user_id}</span>,
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
            cell: (r) =>
              r.full_name ?? (
                <span className="text-[var(--admin-muted)]">&mdash;</span>
              ),
          },
          {
            header: 'Phone',
            skeleton: 'w-32',
            cell: (r) => <span className="tabular">{r.phone}</span>,
            hideOnMobile: true,
          },
          {
            header: 'Country',
            skeleton: 'w-14',
            cell: (r) =>
              r.country ? (
                <span className={`${TEXT.label} inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5`}>
                  <span aria-hidden>{flagFor(r.country)}</span>
                  {r.country}
                </span>
              ) : (
                <span className="text-[var(--admin-muted)]">&mdash;</span>
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
            cell: (r) =>
              r.status !== 'pending' ? (
                <span className={`${TEXT.label} text-[var(--admin-muted)]`}>
                  {r.decided_at ? `Decided ${fmt(r.decided_at)}` : 'Decided'}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={deciding === r.id}
                    onClick={() => setPending({ row: r, status: 'approved' })}
                    className={`${btnSecondary} px-3 py-1.5`}
                  >
                    <Check className="size-4" />
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={deciding === r.id}
                    onClick={() => setPending({ row: r, status: 'rejected' })}
                    className={`${btnGhost} px-3 py-1.5 hover:text-[var(--admin-destructive)]`}
                  >
                    <X className="size-4" />
                    Reject
                  </button>
                </span>
              ),
          },
        ]}
      />

      {pending && (
        <ConfirmDecision
          pending={pending}
          busy={deciding === pending.row.id}
          onConfirm={decide}
          onClose={() => setPending(null)}
        />
      )}
    </>
  )
}

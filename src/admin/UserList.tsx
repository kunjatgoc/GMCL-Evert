import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { COUNTRIES } from '../lib/countries'
import { EASE } from '../lib/motion'
import { TEXT, control, fieldLabel } from '../panel/type'
import { RowsSkeleton } from '../panel/Skeleton'
import {
  listDemoUsers,
  listRealUsers,
  query,
  type DemoUser,
  type Page,
  type RealUser,
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

type Filters = {
  q: string
  country: string
  date_from: string
  date_to: string
}

const EMPTY: Filters = { q: '', country: '', date_from: '', date_to: '' }

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
  withCountry?: boolean
  fetchPage: (qs: string) => Promise<Page<T>>
}

function UserList<T extends { id: number }>({
  title,
  accent,
  columns,
  withCountry = false,
  fetchPage,
}: Props<T>) {
  // `draft` is what the inputs hold; `applied` is what the last search asked
  // for. Splitting them is what lets the query fire on submit instead of on
  // every keystroke -- no debounce, no request per character.
  const [draft, setDraft] = useState<Filters>(EMPTY)
  const [applied, setApplied] = useState<Filters>(EMPTY)
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
    setDraft(EMPTY)
    setApplied(EMPTY)
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
        <label className="flex min-w-[13rem] flex-1 flex-col gap-1">
          <span className={fieldLabel}>Search</span>
          <input
            value={draft.q}
            onChange={(e) => setDraft({ ...draft, q: e.target.value })}
            placeholder={withCountry ? 'Name, email or phone' : 'Email'}
            className={control}
          />
        </label>

        {withCountry && (
          <label className="flex flex-col gap-1">
            <span className={fieldLabel}>Country</span>
            <select
              value={draft.country}
              onChange={(e) => setDraft({ ...draft, country: e.target.value })}
              className={`${control} w-[11.5rem] cursor-pointer`}
            >
              <option value="" className="bg-[#121212]">
                All countries
              </option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code} className="bg-[#121212]">
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Native date inputs. A picker library would be three dependencies
            for something every browser already ships. */}
        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>From</span>
          <input
            type="date"
            value={draft.date_from}
            onChange={(e) => setDraft({ ...draft, date_from: e.target.value })}
            className={`${control} cursor-pointer [color-scheme:dark]`}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>To</span>
          <input
            type="date"
            value={draft.date_to}
            onChange={(e) => setDraft({ ...draft, date_to: e.target.value })}
            className={`${control} cursor-pointer [color-scheme:dark]`}
          />
        </label>

        <div className="flex items-center gap-2">
        <button
          type="submit"
          className={`${TEXT.body} group relative inline-flex items-center gap-2 overflow-hidden cursor-pointer rounded-xl bg-[linear-gradient(180deg,#7DF7B8_0%,#3EE68A_38%,#22A968_100%)] px-4 py-2.5 font-semibold text-black shadow-[0_8px_28px_-8px_rgba(62,230,138,0.55)] transition-[filter] duration-300 hover:brightness-110`}
        >
          {/* The GlowButton sweep, kept inline: this is a rectangle, not a
              pill, and the shared component bakes its own radius in. */}
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-y-8 -left-1/3 w-1/3 rotate-12 bg-white/40 opacity-0 blur-md transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:left-[110%] group-hover:opacity-100"
          />
          <Search className="relative size-4" />
          <span className="relative">Search</span>
        </button>

        <button
          type="button"
          onClick={reset}
          className={`${TEXT.body} cursor-pointer rounded-xl px-3 py-2.5 text-[#E4EAE7]/70 transition-colors duration-300 hover:text-white`}
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
            className="grid size-10 cursor-pointer place-items-center rounded-xl border border-white/10 bg-white/[0.03] transition-colors duration-300 hover:border-[rgba(62,230,138,0.4)] hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-white/10"
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
            className="grid size-10 cursor-pointer place-items-center rounded-xl border border-white/10 bg-white/[0.03] transition-colors duration-300 hover:border-[rgba(62,230,138,0.4)] hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-white/10"
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
      withCountry
      fetchPage={listDemoUsers}
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

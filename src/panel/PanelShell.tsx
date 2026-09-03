import { useEffect, useState, type ComponentType } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { Check, LogOut, X, type LucideIcon } from 'lucide-react'
import { getMe, homeFor, logout, Unauthorized, type Me } from '../lib/api'
import { EASE } from '../lib/motion'
import { PALETTE } from './palette'
import { TEXT, btnGhost, btnSecondary } from './type'
import { PanelSkeleton, useDelayed } from './Skeleton'

/**
 * The signed-in shell: a rail of screens on the left, one screen on the right.
 *
 * One shell for every role. What differs is the list handed to it -- an
 * entrant gets two screens, an admin gets three, and a staff role will get its
 * own without another rail being written. That is the whole of "the menu
 * depends on who you are": a different array, not a different layout.
 */
export type PanelRoute = {
  path: string
  label: string
  icon: LucideIcon
  /** Views that do not care about the account may take no props at all. */
  view: ComponentType<{ me: Me }>
}

type Props = {
  routes: readonly PanelRoute[]
  /** The line under the lockup. Says which panel this is. */
  subtitle: string
  /** The only role this panel is for. Anyone else is sent to their own. */
  role: string
}

const normalise = (p: string) => p.replace(/\/+$/, '') || '/'

/** pushState plus popstate. A handful of screens does not justify a router
 *  dependency; swap one in when there are nested layouts or route params. */
function usePath() {
  const [path, setPath] = useState(() => normalise(window.location.pathname))

  useEffect(() => {
    const onPop = () => setPath(normalise(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const go = (next: string) => {
    if (normalise(next) === path) return
    window.history.pushState({}, '', next)
    setPath(normalise(next))
  }

  return [path, go] as const
}

/** The panel's own plate -- a near-empty room with one screen still awake --
 *  rather than the hero's particle scatter. Fixed rather than absolute so it
 *  does not scroll away underneath a long table. */
function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-[var(--admin-bg)]">
      <img
        src="/img/admin-plate.webp"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-bottom opacity-55"
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />
      {/* Breathes on a slow cycle so the room is not perfectly still. The
          plate already carries the light; this only makes it move. */}
      <div className="absolute inset-x-0 bottom-0 h-[30rem] [animation:horizon-glow_13s_ease-in-out_infinite] [background:radial-gradient(55%_60%_at_25%_100%,rgba(62,230,138,0.1),transparent_72%)]" />
      <div className="grain absolute inset-0" />
    </div>
  )
}

export function PanelShell({ routes, subtitle, role }: Props) {
  const [path, go] = usePath()
  const [me, setMe] = useState<Me | null>(null)
  const [checking, setChecking] = useState(true)
  // A warm session answers /me in well under 400ms. Showing nothing until
  // then means the common case never flashes a loader at all.
  const showSkeleton = useDelayed()
  // Two-step rather than a modal: signing out is reversible in three seconds,
  // and a dialog over the whole panel would be heavier than the action.
  const [confirmingOut, setConfirmingOut] = useState(false)

  // The cookie is the session, so the guard is "does /me answer". A rejected
  // call is the only reliable signal -- the cookie is HttpOnly and JS cannot
  // read it, let alone tell whether it is still valid.
  //
  // A signed-in account on the wrong panel is sent to its own rather than
  // shown a rail of screens whose every request would answer 401. This is
  // courtesy, not the guard: the endpoints behind each screen check the role
  // themselves, and are the only thing that has to.
  useEffect(() => {
    getMe()
      .then((m) => {
        if (m.role !== role) {
          window.location.href = homeFor(m.role)
          return
        }
        setMe(m)
      })
      .catch((e) => {
        if (e instanceof Unauthorized) window.location.href = '/login'
      })
      .finally(() => setChecking(false))
  }, [role])

  const signOut = async () => {
    await logout().catch(() => {})
    window.location.href = '/login'
  }

  if (checking || !me) {
    return (
      <div className="relative isolate min-h-dvh bg-[var(--admin-bg)]" style={PALETTE}>
        <Backdrop />
        {showSkeleton && <PanelSkeleton />}
      </div>
    )
  }

  const active = routes.find((r) => r.path === path) ?? routes[0]
  const View = active.view

  return (
    // One switch for the whole panel: with reducedMotion="user" every
    // transform animation below collapses to an opacity change when the OS
    // asks for it, so no component has to check the preference itself.
    <MotionConfig reducedMotion="user">
      <div className="relative isolate min-h-dvh bg-[var(--admin-bg)] md:flex" style={PALETTE}>
        <Backdrop />

        <motion.nav
          className="glass relative isolate overflow-hidden border-b border-white/8 bg-[var(--admin-card)] p-4 md:sticky md:top-0 md:h-dvh md:w-[19.5rem] md:shrink-0 md:border-b-0 md:border-r md:p-6"
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          {/* Brushed slab lit down its left edge. It is what stops the rail
              reading as a translucent rectangle floating over the room. */}
          <img
            src="/img/admin-rail.webp"
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover opacity-55"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />

          <span className="flex items-center gap-2.5">
            <span
              aria-hidden
              className={`${TEXT.label} grid size-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] font-bold text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]`}
            >
              GML
            </span>
            <span className="leading-none">
              <span className={`${TEXT.body} block font-[family-name:var(--font-display)] font-bold tracking-tight`}>
                Global Market League
              </span>
              <span className={`${TEXT.label} mt-1.5 block uppercase tracking-[0.14em] text-[var(--admin-muted)]`}>
                {subtitle}
              </span>
            </span>
          </span>

          <ul className="mt-5 flex gap-1.5 overflow-x-auto md:mt-9 md:flex-col md:overflow-visible">
            {routes.map((r, i) => {
              const Icon = r.icon
              const on = r.path === active.path
              return (
                <motion.li
                  key={r.path}
                  className="relative"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, ease: EASE, delay: 0.15 + i * 0.07 }}
                >
                  {/* One element shared across items: motion moves it between
                      them instead of cross-fading two rectangles, so the
                      highlight reads as travelling down the list. */}
                  {on && (
                    <motion.span
                      layoutId="nav-active"
                      aria-hidden
                      className="absolute inset-0 rounded-xl border border-[rgba(62,230,138,0.25)] bg-[rgba(62,230,138,0.09)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
                      transition={{ duration: 0.45, ease: EASE }}
                    />
                  )}
                  <a
                    href={r.path}
                    onClick={(e) => {
                      // Left-click only: modified clicks still open a new tab.
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
                      e.preventDefault()
                      go(r.path)
                    }}
                    aria-current={on ? 'page' : undefined}
                    className={`${TEXT.body} relative flex cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-xl px-3.5 py-3 transition-colors duration-300 ${
                      on
                        ? 'font-semibold text-[#3EE68A]'
                        : 'text-[#E4EAE7] hover:bg-white/[0.04] hover:text-white'
                    }`}
                  >
                    <Icon className="size-[18px] shrink-0" />
                    {r.label}
                  </a>
                </motion.li>
              )
            })}
          </ul>

          <div className="mt-6 border-t border-white/8 pt-4 md:absolute md:inset-x-6 md:bottom-6 md:mt-0">
            <p className={`${TEXT.label} truncate text-[var(--admin-muted)]`}>{me.email}</p>

            <AnimatePresence mode="wait" initial={false}>
              {confirmingOut ? (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.22, ease: EASE }}
                  className="mt-2"
                >
                  <p className={`${TEXT.label} text-[var(--admin-muted)]`}>Sign out?</p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={signOut}
                      autoFocus
                      className={btnSecondary}
                    >
                      <Check className="size-4" />
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingOut(false)}
                      className={btnGhost}
                    >
                      <X className="size-4" />
                      Cancel
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.button
                  key="idle"
                  type="button"
                  onClick={() => setConfirmingOut(true)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`${TEXT.body} group mt-2 inline-flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-[#E4EAE7] transition-colors duration-300 hover:text-white`}
                >
                  <LogOut className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                  Sign out
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.nav>

        <main className="min-w-0 flex-1 p-5 sm:p-6 xl:p-8">
          {/* Keyed on the route so the old screen leaves before the new one
              arrives, rather than both occupying the same cell mid-swap. */}
          <AnimatePresence mode="wait">
            <motion.div
              key={active.path}
              initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              <View me={me} />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </MotionConfig>
  )
}

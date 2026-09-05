import { useEffect, useState, type ComponentType } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { LogOut } from 'lucide-react'
import { getMe, homeFor, logout, Unauthorized, type Me } from '../lib/api'
import type { IconComponent } from '../components/ui/IconArt'
import { EASE } from '../lib/motion'
import { PALETTE } from './palette'
import { Lockup } from '../components/ui/Lockup'
import { TEXT } from './type'
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
  /** A lucide icon, or anything else that draws itself from a className --
   *  the MetaTrader mark is an <img>, not a glyph. */
  icon: IconComponent
  /** Views that do not care about the account may take no props at all. */
  view: ComponentType<{ me: Me }>
  /** Renders beside the address and Sign out instead of in the main list.
   *  For the screens that are about the person rather than the work. */
  atBottom?: boolean
}

/** What one role sees: the line under the lockup, and the screens it reaches. */
export type PanelView = {
  subtitle: string
  routes: readonly PanelRoute[]
}

type Props = {
  /**
   * Role to view. The keys are the roles allowed here -- anyone else is sent
   * to their own panel -- so there is no separate list of who is permitted
   * that could fall out of step with who has screens.
   */
  views: Record<string, PanelView>
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

/**
 * The panel's ground.
 *
 * A photographic plate lived here once -- a blurred skyline whose lit windows
 * read as smeared rows of text the moment a real table sat in front of it.
 * Decoration that looks like a rendering fault is worse than no decoration, so
 * it went in b877004, and `panel-plate.webp` is its replacement: the same
 * atmosphere with every horizontal structure removed, since horizontal is what
 * a row of type looks like. See prompt 22 in design/prompts.md.
 *
 * The plate is optional and hides itself when absent, so the CSS underneath it
 * has to stand on its own -- which is why there are two washes and not one.
 * Fixed rather than absolute, so none of it scrolls away under a long list.
 */
function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-[var(--admin-bg)]">
      <img
        src="/img/panel-plate.webp"
        alt=""
        loading="lazy"
        className="absolute inset-0 size-full object-cover opacity-[0.22]"
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />

      {/* Falls on a diagonal for the same reason the plate does: nothing that
          crosses the screen level with a table row can be mistaken for one. */}
      <div className="absolute inset-0 [background:linear-gradient(203deg,rgba(62,230,138,0.07)_0%,transparent_42%)]" />

      {/* Breathes on a slow cycle so the room is not perfectly still. */}
      <div className="absolute inset-x-0 bottom-0 h-[30rem] [animation:horizon-glow_13s_ease-in-out_infinite] [background:radial-gradient(55%_60%_at_25%_100%,rgba(62,230,138,0.1),transparent_72%)]" />
      <div className="grain absolute inset-0" />
    </div>
  )
}

export function PanelShell({ views }: Props) {
  const [path, go] = usePath()
  const [me, setMe] = useState<Me | null>(null)
  const [view, setView] = useState<PanelView | null>(null)
  const [checking, setChecking] = useState(true)
  // A warm session answers /me in well under 400ms. Showing nothing until
  // then means the common case never flashes a loader at all.
  const showSkeleton = useDelayed()
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
        const mine = views[m.role]
        if (!mine) {
          window.location.href = homeFor(m.role)
          return
        }
        setMe(m)
        setView(mine)
      })
      .catch((e) => {
        if (e instanceof Unauthorized) window.location.href = '/login'
      })
      .finally(() => setChecking(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signOut = async () => {
    await logout().catch(() => {})
    window.location.href = '/login'
  }

  if (checking || !me || !view) {
    return (
      <div className="relative isolate min-h-dvh bg-[var(--admin-bg)]" style={PALETTE}>
        <Backdrop />
        {showSkeleton && <PanelSkeleton />}
      </div>
    )
  }

  const active = view.routes.find((r) => r.path === path) ?? view.routes[0]
  const View = active.view

  return (
    // One switch for the whole panel: with reducedMotion="user" every
    // transform animation below collapses to an opacity change when the OS
    // asks for it, so no component has to check the preference itself.
    <MotionConfig reducedMotion="user">
      <div className="relative isolate min-h-dvh bg-[var(--admin-bg)] md:flex" style={PALETTE}>
        <Backdrop />

        <motion.nav
          // 15.5rem, not 19.5. At 19.5 the rail took 312px of a 1280px laptop
          // -- a quarter of the screen for four links -- and the table beside
          // it paid for every one of those pixels.
          className="glass relative isolate overflow-hidden border-b border-white/8 bg-[var(--admin-card)] p-4 md:sticky md:top-0 md:h-dvh md:w-[15.5rem] md:shrink-0 md:border-b-0 md:border-r md:p-5"
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

          <Lockup tone="panel" subtitle={view.subtitle} />

          <ul className="mt-5 flex gap-1.5 overflow-x-auto md:mt-9 md:flex-col md:overflow-visible">
            {view.routes.filter((r) => !r.atBottom).map((r, i) => {
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

            {/* The same links, drawn smaller: down here they are the account,
                not the work, and reading at the size of the main list would
                make them compete with it. */}
            <ul className="mt-2.5 flex flex-col gap-0.5">
              {view.routes.filter((r) => r.atBottom).map((r) => {
                const Icon = r.icon
                const on = r.path === active.path
                return (
                  <li key={r.path}>
                    <a
                      href={r.path}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
                        e.preventDefault()
                        go(r.path)
                      }}
                      aria-current={on ? 'page' : undefined}
                      className={`${TEXT.body} flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 transition-colors duration-300 ${
                        on
                          ? 'font-semibold text-[#3EE68A]'
                          : 'text-[#E4EAE7] hover:text-white'
                      }`}
                    >
                      <Icon className="size-4 shrink-0" />
                      {r.label}
                    </a>
                  </li>
                )
              })}
            </ul>

            {/* Signs out on the press, with nothing to confirm. Signing out
                destroys no work and costs one sign-in to undo, which is less
                than the two taps the confirmation charged everybody every
                time. */}
            <button
              type="button"
              onClick={signOut}
              className={`${TEXT.body} group mt-2 inline-flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-[#E4EAE7] transition-colors duration-300 hover:text-white`}
            >
              <LogOut className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              Sign out
            </button>
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

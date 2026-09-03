import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Globe, LayoutDashboard, Trophy, UserPlus, Users } from 'lucide-react'
import { Card } from '../panel/Card'
import { request, Unauthorized } from '../lib/api'
import { PanelShell, type PanelRoute } from '../panel/PanelShell'
import { TEXT } from '../panel/type'
import { StatsSkeleton, useDelayed } from '../panel/Skeleton'
import { EASE } from '../lib/motion'

/** The league in four numbers, all of them already in the database. */
type GmlStats = {
  entrants: number
  entrants_today: number
  countries: number
  accounts: number
}

const getGmlStats = () => request<GmlStats>('/api/gml/stats')

/**
 * What GML staff land on.
 *
 * Counts only, and only counts that already exist. GML's actual workflow has
 * not been specified, so this is the foundation and nothing more -- one
 * screen, one endpoint, and a rail with room for whatever the work turns out
 * to be. Nothing here touches MetaID requests: those are newera's to answer.
 */
function GmlDashboard() {
  const [stats, setStats] = useState<GmlStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const showSkeleton = useDelayed()

  useEffect(() => {
    getGmlStats()
      .then(setStats)
      .catch((e: unknown) => {
        if (e instanceof Unauthorized) window.location.href = '/login'
        else setError(e instanceof Error ? e.message : 'Could not load the numbers.')
      })
  }, [])

  return (
    <section>
      <motion.h1
        className={`${TEXT.display} font-bold leading-[1.05]`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        Dashboard
      </motion.h1>

      {error && (
        <p role="alert" className={`${TEXT.body} mt-6 text-[var(--admin-destructive)]`}>
          {error}
        </p>
      )}

      {!stats ? (
        !error && showSkeleton && <StatsSkeleton />
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* Entrants is the accent: the league is the thing being counted,
                and one green number per view is the rule. */}
            <Card
              label="League entrants"
              value={stats.entrants}
              sub={`${stats.entrants_today} entered today`}
              icon={Trophy}
              index={0}
              accent
            />
            <Card
              label="Accounts"
              value={stats.accounts}
              sub="Signed up and confirmed"
              icon={Users}
              index={1}
            />
            <Card
              label="Countries"
              value={stats.countries}
              sub="Represented by entrants"
              icon={Globe}
              index={2}
            />
            <Card
              label="Entered today"
              value={stats.entrants_today}
              sub="Since midnight"
              icon={UserPlus}
              index={3}
            />
          </div>

          <p className={`${TEXT.label} mt-6 text-[var(--admin-muted)]`}>
            League tooling arrives here once the workflow is defined.
          </p>
        </>
      )}
    </section>
  )
}

/** One screen so far. The rail is the structure the rest hangs off. */
const ROUTES: readonly PanelRoute[] = [
  { path: '/gml', label: 'Dashboard', icon: LayoutDashboard, view: GmlDashboard },
]

export default function GmlApp() {
  return <PanelShell views={{ gml_staff: { subtitle: 'GML staff', routes: ROUTES } }} />
}

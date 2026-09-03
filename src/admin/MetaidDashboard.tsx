import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { CheckCircle2, Clock, ClipboardList, XCircle } from 'lucide-react'
import { Card } from '../panel/Card'
import { getMetaidStats, Unauthorized, type MetaidStats } from './api'
import { TEXT } from '../panel/type'
import { StatsSkeleton, useDelayed } from '../panel/Skeleton'
import { EASE } from '../lib/motion'

/**
 * What a newera reviewer lands on: the queue in numbers.
 *
 * Not the admin dashboard. That one counts registrations and real-account
 * interest, which is GML's side of the arrangement and sits behind
 * require_admin; a reviewer is here to answer MetaID requests, so this counts
 * those and nothing else.
 */
export function MetaidDashboard() {
  const [stats, setStats] = useState<MetaidStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const showSkeleton = useDelayed()

  useEffect(() => {
    getMetaidStats()
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
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* Pending is the accent: it is the only number here anyone can act
              on, and one green number per view is the rule. */}
          <Card
            label="Pending"
            value={stats.pending}
            sub="Waiting on a decision"
            icon={Clock}
            index={0}
            accent
          />
          <Card
            label="Approved"
            value={stats.approved}
            sub={`${stats.today} asked today`}
            icon={CheckCircle2}
            index={1}
          />
          <Card
            label="Rejected"
            value={stats.rejected}
            sub="Refused so far"
            icon={XCircle}
            index={2}
          />
          <Card
            label="All requests"
            value={stats.total}
            sub="Demo and real combined"
            icon={ClipboardList}
            index={3}
          />
        </div>
      )}
    </section>
  )
}

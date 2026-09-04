import { ClipboardList, LayoutDashboard } from 'lucide-react'
import { Dashboard } from './Dashboard'
import { MetaidDashboard } from './MetaidDashboard'
import { MetaidQueue } from './UserList'
import { PanelShell, type PanelRoute } from '../panel/PanelShell'

const QUEUE: PanelRoute = {
  path: '/admin/metaid',
  label: 'Account Requests',
  icon: ClipboardList,
  view: MetaidQueue,
}

/**
 * Two roles share this panel and see different amounts of it. Both land on a
 * Dashboard, but not the same one: the admin's counts registrations and
 * real-account interest, which is GML's business and sits behind
 * require_admin, while newera staff get the queue they actually work.
 *
 * Everything a staff role is not offered reads an endpoint behind
 * require_admin, and a menu item leading to a 401 is worse than no menu item.
 * Hiding them is courtesy; the endpoints are the guard.
 */
const ADMIN_ROUTES: readonly PanelRoute[] = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, view: Dashboard },
  QUEUE,
]

export default function AdminApp() {
  return (
    <PanelShell
      views={{
        admin: { subtitle: 'Admin panel', routes: ADMIN_ROUTES },
        newera_staff: {
          subtitle: 'newera staff',
          routes: [
            { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, view: MetaidDashboard },
            QUEUE,
          ],
        },
      }}
    />
  )
}

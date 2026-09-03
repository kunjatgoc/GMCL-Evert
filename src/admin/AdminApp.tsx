import { ClipboardList, LayoutDashboard, Users, UserCheck } from 'lucide-react'
import { Dashboard } from './Dashboard'
import { DemoUsers, MetaidQueue, RealUsers } from './UserList'
import { PanelShell, type PanelRoute } from '../panel/PanelShell'

const QUEUE: PanelRoute = {
  path: '/admin/metaid',
  label: 'MetaID Request List',
  icon: ClipboardList,
  view: MetaidQueue,
}

/**
 * Two roles share this panel and see different amounts of it. newera staff are
 * here to answer MetaID requests and nothing else, so that is all they are
 * given -- every other screen reads an endpoint behind require_admin, and a
 * menu item leading to a 401 is worse than no menu item.
 *
 * Hiding them is courtesy. The endpoints are the guard.
 */
const ADMIN_ROUTES: readonly PanelRoute[] = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, view: Dashboard },
  { path: '/admin/demo-users', label: 'Demo ID Users', icon: Users, view: DemoUsers },
  { path: '/admin/real-users', label: 'Real ID Users', icon: UserCheck, view: RealUsers },
  QUEUE,
]

export default function AdminApp() {
  return (
    <PanelShell
      views={{
        admin: { subtitle: 'Admin panel', routes: ADMIN_ROUTES },
        newera_staff: { subtitle: 'newera staff', routes: [QUEUE] },
      }}
    />
  )
}

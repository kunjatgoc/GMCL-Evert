import { LayoutDashboard, Users, UserCheck } from 'lucide-react'
import { Dashboard } from './Dashboard'
import { DemoUsers, RealUsers } from './UserList'
import { PanelShell, type PanelRoute } from '../panel/PanelShell'

/** What an admin can reach. The shell draws it; this only says what it is. */
const ROUTES: readonly PanelRoute[] = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, view: Dashboard },
  { path: '/admin/demo-users', label: 'Demo ID Users', icon: Users, view: DemoUsers },
  { path: '/admin/real-users', label: 'Real ID Users', icon: UserCheck, view: RealUsers },
]

export default function AdminApp() {
  return <PanelShell routes={ROUTES} subtitle="Admin panel" role="admin" />
}

import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { Login } from './components/Login'
import { Signup } from './components/Signup'
import { ForgotPassword, ResetPassword } from './components/Recover'
import { WhatsAppFab } from './components/ui/Support'
import './index.css'

// Ten screens is still not a router. A pathname check costs nothing and adds
// no dependency; the admin panel does its own in-panel navigation.
const path = window.location.pathname.replace(/\/+$/, '') || '/'

// Split so the marketing page never downloads either panel, and the panels
// never download gsap or lenis.
const AdminApp = lazy(() => import('./admin/AdminApp'))
const GmlApp = lazy(() => import('./gml/GmlApp'))
const UserDashboard = lazy(() => import('./user/UserDashboard'))

const fallback = <div className="min-h-dvh" />

// The entrant panel's own screens. A set rather than a chain of comparisons,
// because the list grows and the chain does not read once it does. Keep in
// step with ROUTES in src/user/UserDashboard.tsx.
const ENTRANT_PATHS = new Set([
  '/dashboard',
  '/request-metaid',
  '/league',
  '/profile',
])

const screen = path.startsWith('/admin') ? (
  <Suspense fallback={fallback}>
    <AdminApp />
  </Suspense>
) : path === '/gml' ? (
  <Suspense fallback={fallback}>
    <GmlApp />
  </Suspense>
) : ENTRANT_PATHS.has(path) ? (
  <Suspense fallback={fallback}>
    <UserDashboard />
  </Suspense>
) : path === '/login' ? (
  <Login />
) : path === '/signup' ? (
  <Signup />
) : path === '/forgot-password' ? (
  <ForgotPassword />
) : path === '/reset-password' ? (
  <ResetPassword />
) : (
  <App />
)

// The floating WhatsApp button rides along on every entrant-facing screen, and
// on none of the staff ones: the people who run the league have our number.
const isStaffPanel = path.startsWith('/admin') || path === '/gml'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {screen}
    {!isStaffPanel && <WhatsAppFab />}
  </StrictMode>
)

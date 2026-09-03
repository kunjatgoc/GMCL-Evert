import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { Login } from './components/Login'
import { Signup } from './components/Signup'
import { ForgotPassword, ResetPassword } from './components/Recover'
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

const screen = path.startsWith('/admin') ? (
  <Suspense fallback={fallback}>
    <AdminApp />
  </Suspense>
) : path === '/gml' ? (
  <Suspense fallback={fallback}>
    <GmlApp />
  </Suspense>
) : path === '/dashboard' || path === '/request-metaid' || path === '/profile' ? (
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>{screen}</StrictMode>
)

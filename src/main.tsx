import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { Login } from './components/Login'
import './index.css'

// Three screens is still not a router. A pathname check costs nothing and adds
// no dependency; the admin panel does its own in-panel navigation.
const path = window.location.pathname.replace(/\/+$/, '') || '/'

// Split so the marketing page never downloads the panel, and the panel never
// downloads gsap or lenis.
const AdminApp = lazy(() => import('./admin/AdminApp'))

const screen = path.startsWith('/admin') ? (
  <Suspense fallback={<div className="min-h-dvh" />}>
    <AdminApp />
  </Suspense>
) : path === '/login' ? (
  <Login />
) : (
  <App />
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>{screen}</StrictMode>
)

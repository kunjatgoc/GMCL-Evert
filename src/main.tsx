import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { Login } from './components/Login'
import './index.css'

// Two screens is not a router. A pathname check costs nothing and adds no
// dependency; swap in a real router at the third route.
const isLogin = window.location.pathname.replace(/\/+$/, '') === '/login'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isLogin ? <Login /> : <App />}</StrictMode>
)

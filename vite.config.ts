import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import icons from 'unplugin-icons/vite'

// The hero is a static image now, so there is no three.js chunk left to split
// out of the critical bundle.
export default defineConfig({
  // `~icons/<set>/<name>` imports compile to inline SVG; only the sets
  // installed as @iconify-json/* resolve, and nothing is fetched at runtime.
  plugins: [react(), tailwindcss(), icons({ compiler: 'jsx', jsx: 'react' })],
  // Same origin in dev, so submit.ts needs no URL and the API needs no CORS.
  server: { proxy: { '/api': 'http://localhost:8000' } },
})

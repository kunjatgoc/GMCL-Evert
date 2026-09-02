import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The hero is a static image now, so there is no three.js chunk left to split
// out of the critical bundle.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Same origin in dev, so submit.ts needs no URL and the API needs no CORS.
  server: { proxy: { '/api': 'http://localhost:8000' } },
})

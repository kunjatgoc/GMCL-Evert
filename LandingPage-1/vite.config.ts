import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The hero renderer is raw WebGL now, not three.js, and it is already behind a
// lazy import in Hero.tsx  so there is nothing left for manualChunks to split.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Same origin in dev, so submit.ts needs no URL and the API needs no CORS.
  server: { proxy: { '/api': 'http://localhost:8000' } },
})

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy all /api-like routes through Vite → backend
      // This avoids CORS and localhost/127.0.0.1 IPv6 issues on Windows
      '/readings': 'http://127.0.0.1:8000',
      '/devices':  'http://127.0.0.1:8000',
      '/alerts':   'http://127.0.0.1:8000',
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
      },
    },
  },
})

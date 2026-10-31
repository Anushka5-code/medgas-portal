import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth':     'http://127.0.0.1:3001',
      '/readings': 'http://127.0.0.1:3001',
      '/devices':  'http://127.0.0.1:3001',
      '/alerts':   'http://127.0.0.1:3001',
      '/wards':    'http://127.0.0.1:3001',
      '/handover': 'http://127.0.0.1:3001',
      '/ws': {
        target: 'ws://127.0.0.1:3001',
        ws: true,
      },
    },
  },
})

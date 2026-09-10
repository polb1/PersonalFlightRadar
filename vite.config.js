import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      // Datos: /opensky-api/states/all → https://opensky-network.org/api/states/all
      '/opensky-api': {
        target: 'https://opensky-network.org',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/opensky-api/, '/api'),
      },
      // OAuth2 token endpoint
      '/opensky-auth': {
        target: 'https://auth.opensky-network.org',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/opensky-auth/, ''),
      },
    },
  },
})

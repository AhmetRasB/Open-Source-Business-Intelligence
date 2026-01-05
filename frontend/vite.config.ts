import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Backend launchSettings.json -> http://localhost:5208
    proxy: {
      '/api': {
        target: 'http://localhost:5208',
        changeOrigin: true,
      },
    },
  },
})



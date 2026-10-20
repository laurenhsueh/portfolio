import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: true },
  build: {
    // three.js (+ react-three-fiber/drei) is ~900 kB minified and can't usefully be split. It's
    // loaded lazily, by the home page's butterflies and the Garden lab, never with the first
    // paint, so the size warning is expected for that chunk.
    chunkSizeWarningLimit: 1000,
  },
})

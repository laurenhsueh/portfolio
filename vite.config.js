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
    rollupOptions: {
      output: {
        // stable vendor chunks: React and three change rarely, so returning visitors keep them
        // cached when only the site's own code changes
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react'
          if (
            /[\\/]node_modules[\\/](three|@react-three[\\/]fiber|react-reconciler|its-fine|suspend-react)[\\/]/.test(id)
          )
            return 'three'
        },
      },
    },
  },
})

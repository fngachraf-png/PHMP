import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split the heavy Moroccan drug database into its own chunk
          'drugs-database': ['./src/data/moroccanDrugs.js'],
          // Split vendor libs
          'vendor-charts': ['recharts'],
          'vendor-icons': ['lucide-react'],
          'vendor-router': ['react-router-dom'],
        }
      }
    },
    chunkSizeWarningLimit: 1500
  }
})

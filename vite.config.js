import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // In production builds, treat noisy console methods as side-effect-free so the
  // minifier drops them. console.warn/console.error are kept for real diagnostics.
  esbuild: mode === 'production'
    ? { pure: ['console.log', 'console.debug', 'console.info'] }
    : {},
  server: {
    proxy: {
      '/api': 'http://localhost:3000'
    }
  },
  build: {
    rollupOptions: {
      input: './index.html'
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
}))

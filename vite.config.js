import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react({
    // This will force React 18 behavior
    jsxRuntime: 'automatic',
    // Include fast refresh
    fastRefresh: true,
  })],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})

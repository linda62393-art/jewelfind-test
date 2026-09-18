import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? '/jewelfind-test/' : '/',
  plugins: [react()],
  optimizeDeps: { noDiscovery: true },
}))

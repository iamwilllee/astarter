import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Discover these lazy-route controls before serving requests, in both runtimes.
// Late dep optimization can replace React modules while SSR/hydration is in flight.
const uiDependencies = [
  '@base-ui/react/button',
  '@base-ui/react/input',
  '@base-ui/react/dialog',
  '@base-ui/react/select',
]

export default defineConfig({
  build: process.env.STARTER_SMOKE_OUT ? { outDir: process.env.STARTER_SMOKE_OUT } : {},
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  optimizeDeps: { include: uiDependencies },
  environments: { ssr: { optimizeDeps: { include: uiDependencies } } },
  plugins: [
    cloudflare({ configPath: process.env.STARTER_SMOKE_CONFIG, viteEnvironment: { name: 'ssr' } }),
    tanstackStart(),
    react(),
    tailwindcss(),
  ],
})

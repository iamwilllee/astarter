import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'cloudflare:workers': fileURLToPath(
        new URL('./tests/helpers/worker-env.ts', import.meta.url),
      ),
    },
  },
  test: { include: ['tests/unit/**/*.test.ts'], testTimeout: 20_000, hookTimeout: 30_000 },
})

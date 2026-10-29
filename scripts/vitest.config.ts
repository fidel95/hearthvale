import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Runs the generators in scripts/ (npm run balance) with the same TypeScript
// and Vite setup as the game, so they can import the game's own modules.
export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  test: { include: ['scripts/*.gen.ts'], environment: 'node' },
})

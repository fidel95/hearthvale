import { defineConfig } from 'vitest/config'
import { serviceWorker } from './scripts/serviceWorker.ts'

export default defineConfig({
  // Relative paths, so the built game works from any address: a domain's
  // root, a GitHub Pages project folder, or a file server on your own machine.
  base: './',
  plugins: [serviceWorker()],
  build: {
    // three.js gets a file of its own: it's most of the download and rarely
    // changes, so after an update players only fetch the game's own code.
    rolldownOptions: {
      output: {
        manualChunks: (id: string) => (id.includes('node_modules/three') ? 'three' : undefined),
      },
    },
    // three.js alone is about 500 kB minified, over the default 500 kB warning.
    chunkSizeWarningLimit: 900,
  },
  test: {
    // Unit tests cover the game rules (City, Taxes, tax math), which don't
    // need a browser, so they run in plain Node.
    environment: 'node',
  },
})

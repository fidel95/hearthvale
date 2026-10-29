import { defineConfig } from 'vitest/config'

export default defineConfig({
  build: {
    // three.js alone is about 500 kB minified, so the default 500 kB warning
    // would fire on every build. It's expected for a 3D game; raise the bar.
    chunkSizeWarningLimit: 900,
  },
  test: {
    // Unit tests cover the game rules (City, Taxes, tax math), which don't
    // need a browser, so they run in plain Node.
    environment: 'node',
  },
})

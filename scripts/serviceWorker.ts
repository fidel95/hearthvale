import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { Plugin } from 'vite'

// A small Vite plugin: after a production build, write dist/sw.js from
// sw-template.js, listing every file in the build for the service worker to
// keep, and a version made from their contents. (It's what libraries like
// Workbox do, in a few lines, so it's easy to read.)
export function serviceWorker(): Plugin {
  let outDir = 'dist'
  return {
    name: 'hearthvale-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      const files = listFiles(outDir).filter((f) => f !== 'sw.js' && !f.endsWith('.txt') && !f.startsWith('.'))
      const hash = createHash('sha256')
      for (const f of files) hash.update(f).update(readFileSync(join(outDir, f)))
      const version = hash.digest('hex').slice(0, 12)
      const template = readFileSync(new URL('./sw-template.js', import.meta.url), 'utf8')
      // The code and style files the page loads: the service worker checks the
      // page it caches really names them (and so belongs to this version).
      const entry = [...new Set(readFileSync(join(outDir, 'index.html'), 'utf8').match(/assets\/[^"']+\.(?:js|css)/g) ?? [])]
      const sw = template
        .replace('__VERSION__', version)
        .replace('__FILES__', JSON.stringify(['./', ...files.map((f) => './' + f)], null, 2))
        .replace('__ENTRY__', JSON.stringify(entry))
      writeFileSync(join(outDir, 'sw.js'), sw)
      console.log(`service worker: ${files.length} files, version ${version}`)
    },
  }
}

function listFiles(dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? listFiles(path, root) : [relative(root, path).split('\\').join('/')]
  })
}

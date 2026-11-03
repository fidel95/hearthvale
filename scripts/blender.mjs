// npm run models: runs assets-src/blender/build.py in Blender, which builds
// our own models into public/models/hearthvale/. Finds Blender from $BLENDER,
// the PATH, or the usual install folders. Arguments pass through, e.g.
//   npm run models -- town-hall school
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const candidates = [
  process.env.BLENDER,
  '/Applications/Blender.app/Contents/MacOS/Blender',
  'C:\\Program Files\\Blender Foundation\\Blender 4.5\\blender.exe',
  '/usr/bin/blender',
  '/snap/bin/blender',
].filter(Boolean)
const onPath = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['blender'], { encoding: 'utf8' }).stdout?.trim().split('\n')[0]
const blender = candidates.find((p) => existsSync(p)) ?? onPath
if (!blender) {
  console.error('Blender not found. Install it (blender.org, or brew install --cask blender), or set BLENDER to its path.')
  process.exit(1)
}
const script = fileURLToPath(new URL('../assets-src/blender/build.py', import.meta.url))
const run = spawnSync(blender, ['-b', '--factory-startup', '-P', script, '--', ...process.argv.slice(2)], { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' })
// Blender is chatty; show our own lines.
for (const line of (run.stdout ?? '').split('\n')) if (/^(built|preview|flicker)|Error|Traceback|File "/.test(line)) console.log(line)
process.exit(run.status ?? 1)

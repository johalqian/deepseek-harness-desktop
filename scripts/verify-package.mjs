import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const sourceModules = resolve('node_modules')
const packagedModules = resolve('dist/mac-arm64/DeepSeek Harness Desktop.app/Contents/Resources/app/node_modules')
const missing = new Map()

function scan(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const packageDirectory = join(directory, entry.name)
    if (entry.name.startsWith('@')) {
      scan(packageDirectory)
      continue
    }
    const manifestPath = join(packageDirectory, 'package.json')
    if (!existsSync(manifestPath)) continue
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    for (const peer of Object.keys(manifest.peerDependencies ?? {})) {
      if (!peer.startsWith('@deepseek-ai/')) continue
      if (existsSync(join(packagedModules, ...peer.split('/')))) continue
      if (!missing.has(peer)) missing.set(peer, [])
      missing.get(peer).push(`${manifest.name}@${manifest.version}`)
    }
  }
}

scan(sourceModules)

if (missing.size > 0) {
  for (const [name, consumers] of missing) {
    console.error(`Missing packaged peer ${name}; required by ${consumers.slice(0, 4).join(', ')}`)
  }
  process.exit(1)
}

console.log('Packaged Harness peer dependencies are complete.')

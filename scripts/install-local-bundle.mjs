import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

if (process.argv.length !== 3) throw new Error('Usage: node install.mjs <existing-app-directory>')
const bundle = path.dirname(fileURLToPath(import.meta.url))
const manifest = JSON.parse(await readFile(path.join(bundle, 'manifest.json'), 'utf8'))
const directory = path.resolve(process.argv[2])
const packageFile = path.join(directory, 'package.json')
const app = JSON.parse(await readFile(packageFile, 'utf8'))
const local = {}
for (const pkg of manifest.packages) {
  const archive = path.join(bundle, pkg.file)
  assert.equal(
    createHash('sha256')
      .update(await readFile(archive))
      .digest('hex'),
    pkg.sha256,
    `Archive checksum mismatch: ${pkg.name}`,
  )
  local[pkg.name] = `file:${archive}`
}
await writeFile(
  packageFile,
  `${JSON.stringify({ ...app, dependencies: { ...app.dependencies, ...local }, overrides: { ...app.overrides, ...local } }, null, 2)}\n`,
)
execFileSync('bun', ['install', '--ignore-scripts'], { cwd: directory, stdio: 'inherit' })
console.log(`Installed local Picodash packages in ${directory}`)

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
assert.deepEqual(manifest.exports, {
  '.': { types: './dist/index.d.mts', import: './dist/index.mjs' },
  './browser': { types: './dist/browser.d.mts', import: './dist/browser.mjs' },
  './package.json': './package.json',
})
assert.equal(manifest.private, true)
assert.deepEqual(manifest.bin, { 'picodash-dev-bridge': 'dist/cli.mjs' })
await access(path.join(root, 'dist/index.mjs'))
await access(path.join(root, 'dist/browser.mjs'))
await access(path.join(root, 'dist/cli.mjs'))
assert.match(await readFile(path.join(root, 'dist/cli.mjs'), 'utf8'), /^#!\/usr\/bin\/env node\n/)
const executable = spawnSync(path.join(root, 'dist/cli.mjs'), ['sessions'], {
  cwd: root,
  env: { ...process.env, PICODASH_DEV_BRIDGE_URL: undefined, PICODASH_DEV_BRIDGE_TOKEN: undefined },
  encoding: 'utf8',
})
assert.equal(executable.status, 2)
assert.match(executable.stderr, /"type":"cli_error"/)
const browser = await import(`${pathToFileURL(path.join(root, 'dist/browser.mjs')).href}?artifact`)
assert.equal(typeof browser.connectPicodashDevBridge, 'function')
assert.equal('node:crypto' in browser, false)
console.log('dev-bridge package artifact check passed')

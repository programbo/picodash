#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { readFile, unlink } from 'node:fs/promises'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
let active
const build = spawn('bun', ['run', '--filter', '@picodash/lab', 'picodash:build'], {
  cwd: root,
  stdio: 'inherit',
})
active = build
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'])
  process.once(signal, () => active?.kill(signal))
const code = await new Promise((resolveCode) => {
  build.once('error', () => resolveCode(1))
  build.once('exit', (value, signal) => resolveCode(value ?? (signal ? 1 : 0)))
})
if (code !== 0) process.exit(code)

const host = spawn(
  process.execPath,
  [resolve(dirname(fileURLToPath(import.meta.url)), 'dev-host.mjs')],
  {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
    detached: process.platform !== 'win32',
  },
)
active = host
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'])
  process.once(signal, () => active?.kill(signal))
async function cleanupHostFiles() {
  const directory = resolve(root, '.picodash')
  const lockPath = resolve(directory, 'dev-bridge.lock')
  const credentialPath = resolve(directory, 'dev-bridge.json')
  let instanceId
  try {
    instanceId = JSON.parse(await readFile(credentialPath, 'utf8')).instanceId
  } catch {}
  if (!instanceId) return
  for (const path of [credentialPath, lockPath]) {
    try {
      if (JSON.parse(await readFile(path, 'utf8')).instanceId === instanceId) await unlink(path)
    } catch {}
  }
}
host.once('exit', async (value, signal) => {
  await cleanupHostFiles()
  process.exit(value ?? (signal ? 1 : 0))
})

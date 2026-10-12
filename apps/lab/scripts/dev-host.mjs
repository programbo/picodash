#!/usr/bin/env node
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPicodashDevBridgeHost } from '@picodash/dev-bridge/host'
const require = createRequire(import.meta.url)
const worktree = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
export function createDevHostRuntime(options = {}) {
  const root = options.worktree ?? worktree
  const port = Number(options.labPort ?? process.env.LAB_PORT ?? 6032)
  const host = createPicodashDevBridgeHost({
    origin: options.labOrigin ?? `http://127.0.0.1:${port}`,
    command: {
      file: process.execPath,
      args: [
        require.resolve('next/dist/bin/next'),
        'dev',
        '--hostname',
        '127.0.0.1',
        '--port',
        String(port),
      ],
      cwd: resolve(root, 'apps/lab'),
    },
    credentialDirectory: options.directory ?? resolve(root, '.picodash'),
    browserCredentialEnv: 'NEXT_PUBLIC_PICODASH_DEV_BRIDGE_CREDENTIAL_URL',
    signal: options.signal,
  })
  return { ...host, cleanup: host.stop }
}
export function installSignalHandlers(runtime, exit = process.exit) {
  const finish = async () => {
    await runtime.cleanup()
    exit(0)
  }
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.once(signal, () => void finish())
  return finish
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const runtime = createDevHostRuntime()
  const parent = process.ppid
  const watchdog = setInterval(() => {
    if (process.ppid !== parent) void runtime.cleanup()
  }, 250)
  installSignalHandlers(runtime)
  try {
    const result = await runtime.start()
    console.log(`Picodash Dev Bridge credential: ${result.credentialPath}`)
    const finished = await runtime.finished
    await runtime.cleanup()
    process.exitCode = finished.code
  } catch {
    console.error('Picodash Lab development host failed; credentials redacted.')
    process.exitCode = 1
  } finally {
    clearInterval(watchdog)
    await runtime.cleanup()
  }
}

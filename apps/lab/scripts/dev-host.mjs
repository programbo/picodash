#!/usr/bin/env node
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { chmod, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { startPicodashDevBridgeRelay } from '@picodash/dev-bridge'

const require = createRequire(import.meta.url)
const nextBin = require.resolve('next/dist/bin/next')
const defaultWorktree = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

const isLive = (pid, kill = process.kill) => {
  try {
    kill(pid, 0)
    return true
  } catch (error) {
    return error?.code === 'EPERM'
  }
}
const parseOwned = async (path, instanceId) => {
  try {
    return JSON.parse(await readFile(path, 'utf8')).instanceId === instanceId
  } catch {
    return false
  }
}

export function createDevHostRuntime(options = {}) {
  const worktree = options.worktree ?? defaultWorktree
  const labPort = Number(options.labPort ?? process.env.LAB_PORT ?? 6032)
  const labOrigin = options.labOrigin ?? `http://127.0.0.1:${labPort}`
  const directory = options.directory ?? resolve(worktree, '.picodash')
  const credentialPath = options.credentialPath ?? resolve(directory, 'dev-bridge.json')
  const lockPath = options.lockPath ?? resolve(directory, 'dev-bridge.lock')
  const instanceId = options.instanceId ?? randomUUID()
  const relayFactory = options.relayFactory ?? startPicodashDevBridgeRelay
  const spawnChild =
    options.spawnChild ?? ((file, args, spawnOptions) => spawn(file, args, spawnOptions))
  const kill = options.kill ?? process.kill
  let relay
  let broker
  let child
  let cleaned = false
  let cleanupPromise

  async function acquireLock() {
    await mkdir(directory, { recursive: true, mode: 0o700 })
    await chmod(directory, 0o700)
    const record = JSON.stringify({ pid: process.pid, instanceId }) + '\n'
    for (;;) {
      try {
        await writeFile(lockPath, record, { mode: 0o600, flag: 'wx' })
        await chmod(lockPath, 0o600)
        return
      } catch (error) {
        if (error?.code !== 'EEXIST') throw error
        let current
        try {
          current = JSON.parse(await readFile(lockPath, 'utf8'))
        } catch (readError) {
          if (readError?.code === 'ENOENT') continue
          throw error
        }
        if (Number.isInteger(current?.pid) && isLive(current.pid, kill))
          throw new Error(`Dev host already running (pid ${current.pid}).`)
        const stale = `${lockPath}.${randomUUID()}.stale`
        try {
          await rename(lockPath, stale)
          await unlink(stale).catch(() => {})
        } catch (renameError) {
          if (renameError?.code === 'ENOENT') continue
          throw renameError
        }
      }
    }
  }

  async function atomicJson(path, value) {
    const temp = `${path}.${instanceId}.tmp`
    await writeFile(temp, JSON.stringify(value) + '\n', { mode: 0o600 })
    await chmod(temp, 0o600)
    await rename(temp, path)
    await chmod(path, 0o600)
  }

  async function startBroker() {
    return await new Promise((resolveBroker, reject) => {
      const server = createServer(async (req, res) => {
        const cors = {
          'Access-Control-Allow-Origin': labOrigin,
          Vary: 'Origin',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
          'Content-Type': 'application/json',
        }
        const originOk = req.headers.origin === labOrigin
        const bodyless =
          !req.headers['transfer-encoding'] &&
          (!req.headers['content-length'] || req.headers['content-length'] === '0')
        if (
          req.method !== 'POST' ||
          req.url !== '/v1/browser-credential' ||
          !originOk ||
          !bodyless
        ) {
          res.writeHead(originOk ? 405 : 403, { ...cors, 'Content-Length': '0' })
          res.end()
          return
        }
        const credential = relay.issueBrowserCredential(labOrigin)
        const body = JSON.stringify(credential)
        res.writeHead(200, { ...cors, 'Content-Length': String(Buffer.byteLength(body)) })
        res.end(body)
      })
      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => {
        const address = server.address()
        if (!address || typeof address === 'string')
          return reject(new Error('Broker failed to bind.'))
        resolveBroker({ server, url: `http://127.0.0.1:${address.port}/v1/browser-credential` })
      })
    })
  }

  async function cleanup() {
    if (cleanupPromise) return cleanupPromise
    cleanupPromise = (async () => {
      if (cleaned) return
      cleaned = true
      if (child && !child.killed) {
        try {
          child.kill('SIGTERM')
        } catch {}
      }
      if (broker)
        await new Promise((resolveClose) => broker.server.close(resolveClose)).catch(() => {})
      if (relay) await relay.close().catch(() => {})
      if (await parseOwned(credentialPath, instanceId)) await unlink(credentialPath).catch(() => {})
      if (await parseOwned(lockPath, instanceId)) await unlink(lockPath).catch(() => {})
    })()
    return cleanupPromise
  }

  async function start() {
    await acquireLock()
    try {
      relay = await relayFactory({ allowedBrowserOrigins: [labOrigin], port: 0 })
      broker = await startBroker()
      await atomicJson(credentialPath, {
        type: 'picodash_dev_bridge_agent_credential',
        version: 1,
        instanceId,
        pid: process.pid,
        labOrigin,
        url: relay.baseUrl,
        token: relay.agentCredential.token,
      })
      if (options.logCredential !== false)
        console.log(`Picodash Dev Bridge credential: ${credentialPath}`)
      const childEnv = {
        ...(options.env ?? process.env),
        NEXT_PUBLIC_PICODASH_DEV_BRIDGE_CREDENTIAL_URL: broker.url,
      }
      delete childEnv.PICODASH_DEV_BRIDGE_URL
      delete childEnv.PICODASH_DEV_BRIDGE_TOKEN
      child = spawnChild(
        process.execPath,
        [nextBin, 'dev', '--hostname', '127.0.0.1', '--port', String(labPort)],
        { cwd: resolve(worktree, 'apps/lab'), env: childEnv, stdio: options.stdio ?? 'inherit' },
      )
      child.once?.('exit', async (code, signal) => {
        await cleanup()
        options.onChildExit?.(code ?? (signal ? 1 : 0), signal)
      })
      return { child, relay, broker, credentialPath, lockPath, instanceId, labOrigin }
    } catch (error) {
      await cleanup()
      throw error
    }
  }
  return {
    start,
    cleanup,
    acquireLock,
    startBroker: () => startBroker(),
    paths: { directory, credentialPath, lockPath },
    instanceId,
    labOrigin,
  }
}

export async function startDevHost(options) {
  return createDevHostRuntime(options).start()
}
export function installSignalHandlers(runtime, exit = process.exit) {
  let done = false
  const finish = async () => {
    if (done) return
    done = true
    await runtime.cleanup()
    exit(0)
  }
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.once(signal, () => void finish())
  return finish
}

const direct = import.meta.url === `file://${process.argv[1]}`
if (direct) {
  const parentPid = process.ppid
  let terminating = false
  const runtime = createDevHostRuntime({
    onChildExit: (code) => {
      terminating = true
      process.exit(code)
    },
  })
  const finish = async (code) => {
    if (terminating) return
    terminating = true
    await runtime.cleanup()
    process.exit(code)
  }
  setInterval(() => {
    if (process.ppid !== parentPid) void finish(0)
  }, 250)
  installSignalHandlers(runtime, process.exit)
  runtime.start().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}

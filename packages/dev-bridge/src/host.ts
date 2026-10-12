import { randomUUID } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import { appendFile, chmod, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import { startPicodashDevBridgeRelay } from './relay.js'
import type { PicodashDevBridgeRelay } from './types.js'

export interface PicodashDevBridgeHostOptions {
  readonly origin: string
  readonly command: Readonly<{ file: string; args: readonly string[]; cwd: string }>
  readonly credentialDirectory?: string
  readonly browserCredentialEnv?: string
  readonly signal?: AbortSignal
  /** Optional explicit maximum session duration; normal lifetime follows its owner. */
  readonly lifetimeMs?: number
}
export type PicodashDevBridgeHostStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'failed'

export function createPicodashDevBridgeHost(options: PicodashDevBridgeHostOptions) {
  const url = new URL(options.origin)
  if (
    url.protocol !== 'http:' ||
    url.hostname !== '127.0.0.1' ||
    !url.port ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.username ||
    url.password ||
    url.origin !== options.origin
  )
    throw new Error('Host requires an exact local HTTP origin.')
  if (process.env.NODE_ENV === 'production')
    throw new Error('Picodash dev bridge is disabled in production.')
  const envKey = options.browserCredentialEnv ?? 'VITE_PICODASH_DEV_BRIDGE_CREDENTIAL_URL'
  if (!/^(VITE_|NEXT_PUBLIC_)[A-Z0-9_]+$/.test(envKey))
    throw new Error('Invalid browser credential environment key.')
  const lifetime = options.lifetimeMs
  if (lifetime !== undefined && (!Number.isSafeInteger(lifetime) || lifetime < 1))
    throw new Error('Invalid host lifetime.')
  const directory = resolve(
    options.credentialDirectory ?? resolve(options.command.cwd, '.picodash'),
  )
  const credentialPath = resolve(directory, 'dev-bridge.json')
  const lockPath = resolve(directory, 'dev-bridge.lock')
  const instanceId = randomUUID()
  const temporaryPath = `${credentialPath}.${instanceId}.tmp`
  let state: PicodashDevBridgeHostStatus = 'idle'
  let relay: PicodashDevBridgeRelay | undefined
  let broker: Server | undefined
  let child: ChildProcess | undefined
  const parentPid = process.ppid
  let watchdog: ReturnType<typeof setInterval> | undefined
  let terminalResult: Readonly<{ code: number; signal: NodeJS.Signals | null }> = {
    code: 0,
    signal: null,
  }
  let lifetimeTimer: ReturnType<typeof setTimeout> | undefined
  let startup:
    | Promise<Readonly<{ credentialPath: string; origin: string; childPid: number }>>
    | undefined
  let cleanup: Promise<void> | undefined
  let finish!: (result: Readonly<{ code: number; signal: NodeJS.Signals | null }>) => void
  const finished = new Promise<Readonly<{ code: number; signal: NodeJS.Signals | null }>>(
    (resolveFinished) => {
      finish = resolveFinished
    },
  )
  const owned = async (path: string) => {
    try {
      const value: unknown = JSON.parse(await readFile(path, 'utf8'))
      return (
        !!value &&
        typeof value === 'object' &&
        'instanceId' in value &&
        value.instanceId === instanceId
      )
    } catch {
      return false
    }
  }
  const live = (pid: number) => {
    try {
      process.kill(pid, 0)
      return true
    } catch (error) {
      return error instanceof Error && 'code' in error && error.code === 'EPERM'
    }
  }
  async function acquire() {
    await mkdir(directory, { recursive: true, mode: 0o700 })
    await chmod(directory, 0o700)
    for (;;) {
      try {
        await writeFile(lockPath, JSON.stringify({ pid: process.pid, instanceId }) + '\n', {
          mode: 0o600,
          flag: 'wx',
        })
        const ignorePath = resolve(directory, '.gitignore')
        let ignored = ''
        try {
          ignored = await readFile(ignorePath, 'utf8')
        } catch (error) {
          if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT')
            throw error
        }
        const patterns = [
          'dev-bridge.json',
          'dev-bridge.lock',
          'dev-bridge.json.*.tmp',
          'dev-bridge.lock.*.stale',
        ]
        const missing = patterns.filter((pattern) => !ignored.split('\n').includes(pattern))
        if (missing.length)
          await appendFile(
            ignorePath,
            `${ignored && !ignored.endsWith('\n') ? '\n' : ''}${missing.join('\n')}\n`,
            { mode: 0o600 },
          )
        return
      } catch (error) {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error
        const record: unknown = JSON.parse(await readFile(lockPath, 'utf8'))
        if (
          !record ||
          typeof record !== 'object' ||
          !('pid' in record) ||
          typeof record.pid !== 'number' ||
          !Number.isInteger(record.pid)
        )
          throw new Error('Invalid existing host lock.')
        if (live(record.pid)) throw new Error('Dev host already running.')
        const stale = `${lockPath}.${instanceId}.stale`
        await rename(lockPath, stale)
        await unlink(stale)
      }
    }
  }
  const stopping = () =>
    state === 'stopping' || state === 'stopped' || options.signal?.aborted === true
  function groupAlive() {
    if (!child?.pid) return false
    try {
      process.kill(process.platform !== 'win32' ? -child.pid : child.pid, 0)
      return true
    } catch {
      return false
    }
  }
  function signalChild(signal: NodeJS.Signals) {
    if (!child?.pid) return
    try {
      if (process.platform !== 'win32') process.kill(-child.pid, signal)
      else child.kill(signal)
    } catch {}
  }
  async function waitForGroup(timeout: number) {
    const deadline = Date.now() + timeout
    while (groupAlive() && Date.now() < deadline)
      await new Promise((resolveWait) => setTimeout(resolveWait, 20))
    return !groupAlive()
  }
  async function stop() {
    if (cleanup) return cleanup
    if (state !== 'failed') state = 'stopping'
    cleanup = (async () => {
      clearTimeout(lifetimeTimer)
      clearInterval(watchdog)
      options.signal?.removeEventListener('abort', abort)
      if (startup) await startup.catch(() => {})
      let groupStopped = true
      if (groupAlive()) {
        signalChild('SIGTERM')
        groupStopped = await waitForGroup(2000)
        if (!groupStopped) {
          signalChild('SIGKILL')
          groupStopped = await waitForGroup(1000)
        }
      }
      if (broker) {
        broker.closeAllConnections()
        await new Promise<void>((resolveClose) => broker!.close(() => resolveClose()))
      }
      if (relay) await relay.close()
      for (const path of [credentialPath, lockPath, temporaryPath])
        if (await owned(path)) await unlink(path).catch(() => {})
      if (!groupStopped) {
        state = 'failed'
        terminalResult = { code: 3, signal: null }
      } else if (state !== 'failed') state = 'stopped'
      finish(terminalResult)
      if (!groupStopped) throw new Error('Owned development process group did not exit.')
    })()
    return cleanup
  }
  const abort = () => {
    void stop().catch(() => {})
  }
  function start() {
    if (state !== 'idle') return Promise.reject(new Error('Dev host can start only once.'))
    state = 'starting'
    startup = (async () => {
      options.signal?.throwIfAborted()
      await acquire()
      if (stopping()) throw new Error('Host start cancelled.')
      relay = await startPicodashDevBridgeRelay({ allowedBrowserOrigins: [options.origin] })
      broker = createServer((req, res) => {
        const headers = {
          'Access-Control-Allow-Origin': options.origin,
          Vary: 'Origin',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
          'Content-Type': 'application/json',
        }
        if (
          req.headers.origin !== options.origin ||
          req.method !== 'POST' ||
          req.url !== '/v1/browser-credential' ||
          req.headers['transfer-encoding'] ||
          (req.headers['content-length'] && req.headers['content-length'] !== '0')
        ) {
          res.writeHead(req.headers.origin === options.origin ? 405 : 403, {
            ...headers,
            'Content-Length': '0',
          })
          res.end()
          return
        }
        res.writeHead(200, headers)
        res.end(JSON.stringify(relay!.issueBrowserCredential(options.origin)))
      })
      await new Promise<void>((resolveListen, reject) => {
        broker!.once('error', reject)
        broker!.listen(0, '127.0.0.1', resolveListen)
      })
      const address = broker.address()
      if (!address || typeof address === 'string') throw new Error('Broker failed to bind.')
      const temporary = temporaryPath
      await writeFile(
        temporary,
        JSON.stringify({
          type: 'picodash_dev_bridge_agent_credential',
          version: 1,
          instanceId,
          pid: process.pid,
          origin: options.origin,
          url: relay.baseUrl,
          token: relay.agentCredential.token,
        }) + '\n',
        { mode: 0o600 },
      )
      await rename(temporary, credentialPath)
      await chmod(credentialPath, 0o600)
      if (stopping()) throw new Error('Host start cancelled.')
      const env = {
        ...process.env,
        [envKey]: `http://127.0.0.1:${address.port}/v1/browser-credential`,
      }
      delete env.PICODASH_DEV_BRIDGE_URL
      delete env.PICODASH_DEV_BRIDGE_TOKEN
      child = spawn(options.command.file, [...options.command.args], {
        cwd: options.command.cwd,
        env,
        stdio: 'inherit',
        detached: process.platform !== 'win32',
      })
      child.once('exit', (code, signal) => {
        terminalResult = { code: code ?? (signal ? 1 : 0), signal }
        void stop().catch(() => {})
      })
      await new Promise<void>((resolveSpawn, reject) => {
        child!.once('spawn', resolveSpawn)
        child!.once('error', reject)
      })
      if (!child.pid) throw new Error('Development child failed to start.')
      if (stopping()) throw new Error('Host start cancelled.')
      state = 'running'
      if (lifetime !== undefined) {
        lifetimeTimer = setTimeout(() => {
          void stop().catch(() => {})
        }, lifetime)
        lifetimeTimer.unref()
      }
      watchdog = setInterval(() => {
        if (process.ppid !== parentPid) void stop().catch(() => {})
      }, 250)
      watchdog.unref()
      options.signal?.addEventListener('abort', abort, { once: true })
      return { credentialPath, origin: options.origin, childPid: child.pid }
    })()
    void startup.catch(async () => {
      if (!stopping()) {
        state = 'failed'
        terminalResult = { code: 3, signal: null }
      }
      await stop().catch(() => {})
    })
    return startup
  }
  return {
    start,
    stop,
    finished,
    get status() {
      return state
    },
  }
}

import { afterEach, expect, test } from 'vite-plus/test'
import { mkdtemp, readFile, stat, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPicodashDevBridgeHost } from '../src/host.js'

const hosts: ReturnType<typeof createPicodashDevBridgeHost>[] = []
const directories: string[] = []
afterEach(async () => {
  await Promise.all(hosts.splice(0).map((host) => host.stop()))
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})
async function fixture(extra: Partial<Parameters<typeof createPicodashDevBridgeHost>[0]> = {}) {
  const cwd = await mkdtemp(join(tmpdir(), 'picodash-host-'))
  directories.push(cwd)
  const host = createPicodashDevBridgeHost({
    origin: 'http://127.0.0.1:6240',
    credentialDirectory: join(cwd, '.picodash'),
    command: {
      file: process.execPath,
      args: [
        '-e',
        `require('fs').writeFileSync('environment.json',JSON.stringify({broker:process.env.VITE_PICODASH_DEV_BRIDGE_CREDENTIAL_URL,token:process.env.PICODASH_DEV_BRIDGE_TOKEN}));setInterval(()=>{},1000)`,
      ],
      cwd,
    },
    ...extra,
  })
  hosts.push(host)
  return { host, cwd }
}

test('host owns a real child, private credentials, exact-origin broker and complete teardown', async () => {
  const { host, cwd } = await fixture()
  const started = await host.start()
  expect(host.status).toBe('running')
  await expect
    .poll(async () => JSON.parse(await readFile(join(cwd, 'environment.json'), 'utf8')))
    .toMatchObject({
      broker: expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+\/v1\/browser-credential$/),
    })
  const environment = JSON.parse(await readFile(join(cwd, 'environment.json'), 'utf8'))
  expect(environment.token).toBeUndefined()
  expect((await stat(join(cwd, '.picodash'))).mode & 0o777).toBe(0o700)
  expect((await stat(started.credentialPath)).mode & 0o777).toBe(0o600)
  const credential = JSON.parse(await readFile(started.credentialPath, 'utf8'))
  const response = await fetch(environment.broker, {
    method: 'POST',
    headers: { Origin: started.origin },
  })
  expect(response.status).toBe(200)
  expect((await response.json()).token).not.toBe(credential.token)
  expect(
    (await fetch(environment.broker, { method: 'POST', headers: { Origin: 'http://evil.test' } }))
      .status,
  ).toBe(403)
  expect(
    (await fetch(environment.broker, { method: 'GET', headers: { Origin: started.origin } }))
      .status,
  ).toBe(405)
  expect(
    (
      await fetch(environment.broker, {
        method: 'POST',
        headers: { Origin: started.origin },
        body: 'x',
      })
    ).status,
  ).toBe(405)
  await host.stop()
  await host.stop()
  expect(host.status).toBe('stopped')
  await expect(readFile(started.credentialPath)).rejects.toThrow()
  await expect(fetch(credential.url)).rejects.toThrow()
  expect(() => process.kill(started.childPid, 0)).toThrow()
})

test('duplicate start and live lock are refused while foreign replacement survives cleanup', async () => {
  const { host, cwd } = await fixture()
  const started = await host.start()
  await expect(host.start()).rejects.toThrow('only once')
  const other = createPicodashDevBridgeHost({
    origin: started.origin,
    command: { file: process.execPath, args: [], cwd },
  })
  hosts.push(other)
  await expect(other.start()).rejects.toThrow('already running')
  await other.stop()
  await writeFile(started.credentialPath, JSON.stringify({ instanceId: 'foreign' }))
  await host.stop()
  expect(JSON.parse(await readFile(started.credentialPath, 'utf8'))).toEqual({
    instanceId: 'foreign',
  })
})

test('spawn failure, startup-stop race and abort clean owned resources', async () => {
  const { host, cwd } = await fixture({
    command: { file: '/definitely/missing/picodash-child', args: [], cwd: tmpdir() },
  })
  await expect(host.start()).rejects.toThrow()
  await host.stop()
  expect(host.status).toBe('failed')
  await expect(readFile(join(cwd, '.picodash/dev-bridge.lock'))).rejects.toThrow()
  const raced = await fixture()
  const pending = raced.host.start()
  const stopped = raced.host.stop()
  await expect(pending).rejects.toThrow()
  await stopped
  await expect(readFile(join(raced.cwd, '.picodash/dev-bridge.lock'))).rejects.toThrow()
  const abort = new AbortController()
  const active = await fixture({ signal: abort.signal })
  const result = await active.host.start()
  abort.abort()
  await active.host.stop()
  expect(() => process.kill(result.childPid, 0)).toThrow()
})

test('child exit and bounded lifetime stop the owned host', async () => {
  const { host, cwd } = await fixture()
  const result = await host.start()
  process.kill(result.childPid, 'SIGTERM')
  await host.finished
  await host.stop()
  await expect(readFile(join(cwd, '.picodash/dev-bridge.lock'))).rejects.toThrow()
  const limited = await fixture({ lifetimeMs: 50 })
  await limited.host.start()
  await limited.host.finished
  await limited.host.stop()
  expect(limited.host.status).toBe('stopped')
})

test('leader exit cleans its still-live detached descendants before finished resolves', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'picodash-descendants-'))
  directories.push(cwd)
  const host = createPicodashDevBridgeHost({
    origin: 'http://127.0.0.1:6240',
    command: {
      file: process.execPath,
      args: [
        '-e',
        `const cp=require('child_process'),fs=require('fs');const c=cp.spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});fs.writeFileSync('descendant',String(c.pid));setTimeout(()=>process.exit(7),50)`,
      ],
      cwd,
    },
  })
  hosts.push(host)
  await host.start()
  const result = await host.finished
  expect(result.code).toBe(7)
  const descendant = Number(await readFile(join(cwd, 'descendant'), 'utf8'))
  expect(() => process.kill(descendant, 0)).toThrow()
  await expect(readFile(join(cwd, '.picodash/dev-bridge.json'))).rejects.toThrow()
  expect(host.status).toBe('stopped')
})

test('abrupt owner loss stops the host and its development process group', async () => {
  const { spawn } = await import('node:child_process')
  const cwd = await mkdtemp(join(tmpdir(), 'picodash-parent-loss-'))
  directories.push(cwd)
  const cli = new URL('../dist/host-cli.mjs', import.meta.url).pathname
  const command = `require('fs').writeFileSync('devpid',String(process.pid));setInterval(()=>{},1000)`
  const parent = spawn(
    process.execPath,
    [
      '-e',
      `const c=require('child_process').spawn(process.execPath,${JSON.stringify([cli, '--origin', 'http://127.0.0.1:6240', '--', process.execPath, '-e', command])},{cwd:${JSON.stringify(cwd)},stdio:'ignore'});setInterval(()=>{},1000)`,
    ],
    { stdio: 'ignore' },
  )
  let hostPid: number | undefined
  let devPid: number | undefined
  try {
    await expect
      .poll(async () => {
        const value = JSON.parse(await readFile(join(cwd, '.picodash/dev-bridge.json'), 'utf8'))
        hostPid = value.pid
        devPid = Number(await readFile(join(cwd, 'devpid'), 'utf8'))
        return !!devPid
      })
      .toBe(true)
    parent.kill('SIGTERM')
    await new Promise((resolveExit) => parent.once('exit', resolveExit))
    await expect
      .poll(async () => {
        try {
          await readFile(join(cwd, '.picodash/dev-bridge.json'))
          return false
        } catch {
          return true
        }
      })
      .toBe(true)
    await expect
      .poll(() => {
        try {
          process.kill(devPid!, 0)
          return false
        } catch {
          return true
        }
      })
      .toBe(true)
    await expect
      .poll(() => {
        try {
          process.kill(hostPid!, 0)
          return false
        } catch {
          return true
        }
      })
      .toBe(true)
  } finally {
    if (parent.exitCode === null && parent.signalCode === null) parent.kill('SIGKILL')
    if (hostPid) {
      try {
        process.kill(hostPid, 'SIGTERM')
      } catch {}
    }
    if (devPid) {
      try {
        process.kill(-devPid, 'SIGKILL')
      } catch {}
    }
  }
})

test('credential files are Git-ignored automatically without replacing existing ignore content', async () => {
  const { spawnSync } = await import('node:child_process')
  const { host, cwd } = await fixture()
  expect(spawnSync('git', ['init', '-q', cwd]).status).toBe(0)
  await (await import('node:fs/promises')).mkdir(join(cwd, '.picodash'), { recursive: true })
  await writeFile(join(cwd, '.picodash/.gitignore'), 'application-owned-note.txt')
  const result = await host.start()
  const ignore = await readFile(join(cwd, '.picodash/.gitignore'), 'utf8')
  expect(ignore.startsWith('application-owned-note.txt\n')).toBe(true)
  for (const path of [
    'dev-bridge.json',
    'dev-bridge.lock',
    'dev-bridge.json.owned.tmp',
    'dev-bridge.lock.owned.stale',
  ])
    expect(
      spawnSync('git', ['check-ignore', '--no-index', `.picodash/${path}`], { cwd }).status,
    ).toBe(0)
  expect(
    spawnSync('git', ['check-ignore', '--no-index', '.picodash/app-observations.json'], { cwd })
      .status,
  ).toBe(1)
  await host.stop()
  await expect(readFile(result.credentialPath)).rejects.toThrow()
  expect(await readFile(join(cwd, '.picodash/.gitignore'), 'utf8')).toBe(ignore)
})

import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, stat, writeFile, rm, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { EventEmitter } from 'node:events'
import { request } from 'node:http'
import { spawn as spawnProcess } from 'node:child_process'
import { createDevHostRuntime } from './dev-host.mjs'
import { readFile as readText } from 'node:fs/promises'

const dirs = []
afterEach(async () => {
  while (dirs.length) await rm(dirs.pop(), { recursive: true, force: true })
})
async function fixture(extra = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'picodash-lab-'))
  dirs.push(directory)
  const child = new EventEmitter()
  child.killed = false
  child.kill = () => {
    child.killed = true
    return true
  }
  const args = []
  let env
  const runtime = createDevHostRuntime({
    directory,
    worktree: directory,
    labPort: 0,
    stdio: 'ignore',
    logCredential: false,
    child: undefined,
    spawnChild: (_file, argv, options) => {
      args.push(...argv)
      env = options.env
      return child
    },
    ...extra,
  })
  return {
    runtime,
    directory,
    child,
    args,
    get env() {
      return env
    },
  }
}
async function httpGet(url, options = {}) {
  return await new Promise((resolve, reject) => {
    const req = request(url, options, (res) => {
      const chunks = []
      res.on('data', (x) => chunks.push(x))
      res.on('end', () =>
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString(),
        }),
      )
    })
    req.on('error', reject)
    if (options.body) req.write(options.body)
    req.end()
  })
}
const mode = (path) => stat(path).then((s) => s.mode & 0o777)

test('launcher resolves the Picodash worktree root from apps/lab/scripts', async () => {
  const source = await readText(new URL('./dev.mjs', import.meta.url), 'utf8')
  assert.match(
    source,
    /resolve\(dirname\(fileURLToPath\(import\.meta\.url\)\), '\.\.\/\.\.\/\.\.'\)/,
  )
})

test('real relay and broker bind loopback ephemeral ports, write exact private credential, and strip bearer from child/broker', async () => {
  const f = await fixture()
  const logs = []
  const oldLog = console.log
  console.log = (...x) => logs.push(x.join(' '))
  try {
    const result = await f.runtime.start()
    const credential = JSON.parse(await readFile(result.credentialPath, 'utf8'))
    assert.deepEqual(Object.keys(credential).sort(), [
      'instanceId',
      'labOrigin',
      'pid',
      'token',
      'type',
      'url',
      'version',
    ])
    assert.equal(credential.type, 'picodash_dev_bridge_agent_credential')
    assert.equal(credential.version, 1)
    assert.equal(await mode(f.directory), 0o700)
    assert.equal(await mode(result.credentialPath), 0o600)
    assert.equal(await mode(result.lockPath), 0o600)
    assert.match(credential.url, /^http:\/\/127\.0\.0\.1:\d+$/)
    assert.match(result.broker.url, /^http:\/\/127\.0\.0\.1:\d+\/v1\/browser-credential$/)
    assert.ok(!logs.join('\n').includes(credential.token))
    assert.ok(!f.args.includes(credential.token))
    assert.notEqual(f.env.PICODASH_DEV_BRIDGE_TOKEN, credential.token)
    const response = await httpGet(result.broker.url, {
      method: 'POST',
      headers: { Origin: result.labOrigin },
    })
    assert.equal(response.status, 200)
    const browserCredential = JSON.parse(response.body)
    assert.deepEqual(Object.keys(browserCredential).sort(), ['origin', 'token', 'webSocketUrl'])
    assert.notEqual(browserCredential.token, result.relay.agentCredential.token)
    assert.equal(browserCredential.origin, result.labOrigin)
    assert.equal(response.headers['access-control-allow-origin'], result.labOrigin)
    assert.equal(response.headers.vary, 'Origin')
    assert.equal(response.headers['cache-control'], 'no-store')
    assert.equal(response.headers.pragma, 'no-cache')
    assert.equal(response.headers['content-type'], 'application/json')
    assert.equal(f.env.NEXT_PUBLIC_PICODASH_DEV_BRIDGE_CREDENTIAL_URL, result.broker.url)
    await f.runtime.cleanup()
    await f.runtime.cleanup()
  } finally {
    console.log = oldLog
  }
})

test('broker enforces exact method, path, body, and origin', async () => {
  const f = await fixture()
  const result = await f.runtime.start()
  for (const options of [
    { method: 'GET', headers: { Origin: result.labOrigin } },
    { method: 'POST', path: '/wrong', headers: { Origin: result.labOrigin } },
    { method: 'POST', headers: { Origin: result.labOrigin, 'Content-Length': '1' }, body: 'x' },
    { method: 'POST', headers: { Origin: 'http://evil.test' } },
  ]) {
    const url = new URL(result.broker.url)
    if (options.path) url.pathname = options.path
    const response = await httpGet(url, options)
    assert.ok([403, 405].includes(response.status))
    assert.equal(response.body, '')
  }
  await f.runtime.cleanup()
})

test('live lock fails, stale lock recovers, and concurrent acquisition is safe', async () => {
  const f = await fixture()
  const second = createDevHostRuntime({ directory: f.directory, labPort: 0 })
  const race = await Promise.allSettled([f.runtime.acquireLock(), second.acquireLock()])
  assert.equal(race.filter((item) => item.status === 'fulfilled').length, 1)
  assert.equal(race.filter((item) => item.status === 'rejected').length, 1)
  await f.runtime.cleanup()
  await second.cleanup()
  await writeFile(
    join(f.directory, 'dev-bridge.lock'),
    JSON.stringify({ pid: 999999, instanceId: 'stale' }),
  )
  await second.acquireLock()
  assert.equal(
    JSON.parse(await readFile(join(f.directory, 'dev-bridge.lock'))).instanceId,
    second.instanceId,
  )
  await second.cleanup()
})

test('cleanup preserves foreign replacement and removes only owned instances', async () => {
  const f = await fixture()
  const result = await f.runtime.start()
  await writeFile(result.lockPath, JSON.stringify({ pid: 999999, instanceId: 'foreign-lock' }))
  await writeFile(result.credentialPath, JSON.stringify({ instanceId: 'foreign-credential' }))
  await f.runtime.cleanup()
  assert.equal((await readFile(result.lockPath, 'utf8')).includes('foreign-lock'), true)
  assert.equal((await readFile(result.credentialPath, 'utf8')).includes('foreign-credential'), true)
})

test('child exit invokes cleanup without process.exit in imported runtime', async () => {
  let exited
  const f = await fixture({
    onChildExit: (code, signal) => {
      exited = [code, signal]
    },
  })
  const result = await f.runtime.start()
  f.child.emit('exit', 7, null)
  await new Promise((r) => setTimeout(r, 30))
  assert.deepEqual(exited, [7, null])
  await assert.rejects(readFile(result.lockPath))
  await assert.rejects(readFile(result.credentialPath))
})

test('host process handles SIGTERM and removes live credentials and lock in isolated state', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'picodash-process-'))
  dirs.push(directory)
  const credentialPath = join(directory, 'dev-bridge.json')
  const lockPath = join(directory, 'dev-bridge.lock')
  const child = spawnProcess(
    process.execPath,
    [join(import.meta.dirname, 'dev-host-process-fixture.mjs')],
    {
      cwd: resolve(import.meta.dirname, '../../..'),
      env: { ...process.env, PICODASH_TEST_DIRECTORY: directory },
      stdio: 'ignore',
    },
  )
  try {
    for (let i = 0; i < 100; i += 1) {
      try {
        await access(credentialPath)
        await access(lockPath)
        break
      } catch {
        await new Promise((r) => setTimeout(r, 50))
      }
    }
    await access(credentialPath)
    await access(lockPath)
    child.kill('SIGTERM')
    await new Promise((resolveExit) => child.once('exit', resolveExit))
    await assert.rejects(access(credentialPath))
    await assert.rejects(access(lockPath))
  } finally {
    if (!child.killed) child.kill('SIGKILL')
    await rm(directory, { recursive: true, force: true })
  }
})

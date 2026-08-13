import { afterEach, describe, expect, test } from 'vite-plus/test'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { access } from 'node:fs/promises'
import path from 'node:path'
import WebSocket from 'ws'
import { createPicodashNexus } from '@picodash/nexus'
import { connectPicodashDevBridge } from '../src/browser.js'
import { startPicodashDevBridgeRelay } from '../src/relay.js'

const root = path.resolve(import.meta.dirname, '..')
const cli = path.join(root, 'dist/cli.mjs')

class BrowserWebSocket extends EventTarget {
  static readonly CONNECTING = WebSocket.CONNECTING
  static readonly OPEN = WebSocket.OPEN
  static readonly CLOSING = WebSocket.CLOSING
  static readonly CLOSED = WebSocket.CLOSED
  private readonly inner: WebSocket

  constructor(url: string, protocols: string | string[]) {
    super()
    this.inner = new WebSocket(url, protocols, { headers: { Origin: 'http://localhost' } })
    this.inner.on('open', () => this.dispatchEvent(new Event('open')))
    this.inner.on('message', (raw) =>
      this.dispatchEvent(
        new MessageEvent('message', {
          data: Buffer.isBuffer(raw) ? raw.toString() : Buffer.from(raw as ArrayBuffer).toString(),
        }),
      ),
    )
    this.inner.on('error', () => this.dispatchEvent(new Event('error')))
    this.inner.on('close', () => this.dispatchEvent(new Event('close')))
  }

  get readyState() {
    return this.inner.readyState
  }

  send(value: string) {
    this.inner.send(value)
  }

  close() {
    this.inner.close()
  }
}

type RunResult = { code: number | null; stdout: string; stderr: string }

const mockDescriptor = (overrides: Record<string, unknown> = {}) => ({
  sessionId: 'session',
  generation: 1,
  sequence: 0,
  registrationId: 'registration',
  browserTabId: 'tab',
  origin: 'http://localhost',
  fieldKeys: ['count'],
  disclosedValueFields: ['count'],
  writableFields: ['count'],
  disclosedScopeIds: [],
  diagnosticsDisclosed: false,
  capabilities: ['inspect', 'set_values', 'wait'],
  ...overrides,
})

async function mockRelay(
  handler: (
    requestPath: string,
    request: import('node:http').IncomingMessage,
    response: import('node:http').ServerResponse,
  ) => void,
) {
  const server = createServer((request, response) => handler(request.url ?? '/', request, response))
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('mock server failed')
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

function run(
  args: readonly string[],
  env: Record<string, string>,
  input?: string,
): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const out: Buffer[] = []
    const err: Buffer[] = []
    child.stdout.on('data', (chunk) => out.push(Buffer.from(chunk)))
    child.stderr.on('data', (chunk) => err.push(Buffer.from(chunk)))
    child.on('close', (code) =>
      resolve({
        code,
        stdout: Buffer.concat(out).toString(),
        stderr: Buffer.concat(err).toString(),
      }),
    )
    if (input !== undefined) child.stdin.end(input)
    else child.stdin.end()
  })
}

const previousWebSocket = globalThis.WebSocket
let relay: Awaited<ReturnType<typeof startPicodashDevBridgeRelay>> | undefined
let browser:
  | { close(): Promise<void>; session: { sessionId: string; generation: number } }
  | undefined
let nexus: ReturnType<typeof createPicodashNexus> | undefined

afterEach(async () => {
  await browser?.close()
  await relay?.close()
  if (nexus) nexus.destroy({ discardUnpersisted: true })
  browser = undefined
  relay = undefined
  nexus = undefined
  ;(globalThis as unknown as { WebSocket: unknown }).WebSocket = previousWebSocket
})

describe('dev bridge CLI', () => {
  test('rejects argv before credentials, stdin, or network access', async () => {
    await access(cli)
    const result = await run(['sessions', '--token', 'secret'], {})
    expect(result.code).toBe(2)
    expect(result.stdout).toBe('')
    expect(JSON.parse(result.stderr)).toMatchObject({
      type: 'cli_error',
      error: { code: 'usage_error' },
    })
    expect(result.stderr).not.toContain('secret')
  })

  test('validates exact credentials and reports redacted configuration errors', async () => {
    const result = await run(['sessions'], {
      PICODASH_DEV_BRIDGE_URL: 'http://127.0.0.1:1234/path',
      PICODASH_DEV_BRIDGE_TOKEN: 'secret',
    })
    expect(result.code).toBe(2)
    expect(JSON.parse(result.stderr)).toMatchObject({ error: { code: 'configuration_error' } })
    expect(result.stderr).not.toContain('secret')
    for (const url of [
      'https://127.0.0.1:1234',
      'http://localhost:1234',
      'http://127.0.0.1:0',
      'http://127.0.0.1:65536',
      'http://127.0.0.1:1234/',
      'http://127.0.0.1:1234?x=1',
    ]) {
      const invalid = await run(['sessions'], {
        PICODASH_DEV_BRIDGE_URL: url,
        PICODASH_DEV_BRIDGE_TOKEN: 'A'.repeat(43),
      })
      expect(invalid.code).toBe(2)
    }
    for (const token of ['A'.repeat(42), 'A'.repeat(44), `${'A'.repeat(42)}+`]) {
      const invalid = await run(['sessions'], {
        PICODASH_DEV_BRIDGE_URL: 'http://127.0.0.1:1234',
        PICODASH_DEV_BRIDGE_TOKEN: token,
      })
      expect(invalid.code).toBe(2)
    }
  }, 30_000)

  test('covers flag order, duplicate/equals/positional rejection and deterministic session sorting', async () => {
    const invalid = [
      ['inspect', '--session-id', 'x', '--generation', '1', '--generation', '2'],
      ['inspect', '--session-id=x', '--generation', '1'],
      ['inspect', '--session-id', 'x', '--generation', '1', 'extra'],
      ['inspect', '-s', 'x', '--generation', '1'],
    ]
    for (const args of invalid) {
      const result = await run(args, {})
      expect(result.code).toBe(2)
      expect(JSON.parse(result.stderr)).toMatchObject({ error: { code: 'usage_error' } })
    }
    const mock = await mockRelay((_path, _request, response) => {
      response.setHeader('content-type', 'application/json')
      response.end(
        JSON.stringify({
          type: 'sessions',
          sessions: [
            mockDescriptor({ origin: 'http://z', registrationId: 'a' }),
            mockDescriptor({ origin: 'http://a', registrationId: 'z' }),
          ],
        }),
      )
    })
    try {
      const result = await run(['sessions'], {
        PICODASH_DEV_BRIDGE_URL: mock.url,
        PICODASH_DEV_BRIDGE_TOKEN: 'A'.repeat(43),
      })
      expect(result.code).toBe(0)
      const body = JSON.parse(result.stdout)
      expect(body.sessions[0].origin).toBe('http://a')
      expect(result.stdout.indexOf('{"sessions"')).toBe(0)
    } finally {
      await mock.close()
    }
  })

  test('preserves generated request IDs on protocol and transport failures', async () => {
    const mock = await mockRelay((requestPath, request, response) => {
      response.setHeader('content-type', 'application/json')
      if (requestPath === '/v1/sessions') {
        response.end(JSON.stringify({ type: 'sessions', sessions: [mockDescriptor()] }))
        return
      }
      if (requestPath.endsWith('/commands')) {
        response.end(JSON.stringify({ type: 'command_result', requestId: 'wrong', secret: true }))
        return
      }
      response.statusCode = 404
      response.end('{}')
    })
    const env = { PICODASH_DEV_BRIDGE_URL: mock.url, PICODASH_DEV_BRIDGE_TOKEN: 'A'.repeat(43) }
    try {
      const protocol = await run(
        ['set-values', '--session-id', 'session', '--generation', '1'],
        env,
        '{"values":{"count":1}}',
      )
      expect(protocol.code).toBe(3)
      expect(protocol.stdout).toBe('')
      expect(JSON.parse(protocol.stderr)).toMatchObject({
        type: 'cli_error',
        error: { code: 'protocol_error' },
        requestId: expect.stringMatching(/^cli-[0-9a-f-]{36}$/),
      })
    } finally {
      await mock.close()
    }
    const nonJson = await mockRelay((requestPath, _request, response) => {
      if (requestPath === '/v1/sessions') {
        response.setHeader('content-type', 'application/json')
        response.end(JSON.stringify({ type: 'sessions', sessions: [mockDescriptor()] }))
        return
      }
      response.statusCode = 200
      response.end('not-json')
    })
    try {
      const result = await run(
        ['set-values', '--session-id', 'session', '--generation', '1'],
        { PICODASH_DEV_BRIDGE_URL: nonJson.url, PICODASH_DEV_BRIDGE_TOKEN: 'A'.repeat(43) },
        '{"values":{"count":1}}',
      )
      expect(result.code).toBe(3)
      expect(JSON.parse(result.stderr)).toMatchObject({
        error: { code: 'protocol_error' },
        requestId: expect.stringMatching(/^cli-[0-9a-f-]{36}$/),
      })
    } finally {
      await nonJson.close()
    }
    const transport = await mockRelay((requestPath, request, response) => {
      response.setHeader('content-type', 'application/json')
      if (requestPath === '/v1/sessions') {
        response.end(JSON.stringify({ type: 'sessions', sessions: [mockDescriptor()] }))
        return
      }
      request.socket.destroy()
    })
    try {
      const result = await run(
        ['set-values', '--session-id', 'session', '--generation', '1'],
        { PICODASH_DEV_BRIDGE_URL: transport.url, PICODASH_DEV_BRIDGE_TOKEN: 'A'.repeat(43) },
        '{"values":{"count":1}}',
      )
      expect(result.code).toBe(3)
      expect(JSON.parse(result.stderr)).toMatchObject({
        error: { code: 'transport_error' },
        requestId: expect.stringMatching(/^cli-[0-9a-f-]{36}$/),
      })
    } finally {
      await transport.close()
    }
  }, 30_000)

  test('accepts optional bridge request IDs/session refs and preserves ID on selection errors', async () => {
    const mock = await mockRelay((requestPath, _request, response) => {
      response.setHeader('content-type', 'application/json')
      if (requestPath === '/v1/sessions') {
        response.end(JSON.stringify({ type: 'sessions', sessions: [mockDescriptor()] }))
        return
      }
      response.end(
        JSON.stringify({
          type: 'bridge_error',
          error: { code: 'session_disconnected', message: 'Session is disconnected.' },
        }),
      )
    })
    const env = { PICODASH_DEV_BRIDGE_URL: mock.url, PICODASH_DEV_BRIDGE_TOKEN: 'A'.repeat(43) }
    try {
      const result = await run(
        ['set-values', '--session-id', 'session', '--generation', '1'],
        env,
        '{"values":{"count":1}}',
      )
      expect(result.code).toBe(4)
      expect(JSON.parse(result.stdout)).toMatchObject({ error: { code: 'session_disconnected' } })
      expect(result.stderr).toBe('')
    } finally {
      await mock.close()
    }
    const missing = await mockRelay((requestPath, _request, response) => {
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify({ type: 'sessions', sessions: [] }))
    })
    try {
      const result = await run(
        ['set-values', '--session-id', 'missing', '--generation', '1'],
        { PICODASH_DEV_BRIDGE_URL: missing.url, PICODASH_DEV_BRIDGE_TOKEN: 'A'.repeat(43) },
        '{"values":{"count":1}}',
      )
      expect(result.code).toBe(4)
      expect(JSON.parse(result.stdout)).toMatchObject({
        error: { code: 'session_not_found' },
        requestId: expect.stringMatching(/^cli-[0-9a-f-]{36}$/),
      })
    } finally {
      await missing.close()
    }
  })

  test('runs sessions, inspect, set-values, and wait through a live relay and Nexus', async () => {
    ;(globalThis as unknown as { WebSocket: unknown }).WebSocket = BrowserWebSocket
    nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: {
        count: {
          defaultValue: 1,
          validate: (value) => (Number(value) === 3 ? [{ message: 'No threes.' }] : []),
        },
      },
    })
    relay = await startPicodashDevBridgeRelay({ allowedBrowserOrigins: ['http://localhost'] })
    browser = await connectPicodashDevBridge({
      nexus,
      credential: relay.issueBrowserCredential('http://localhost'),
      registrationId: 'cli-test',
      browserTabId: 'tab',
      disclosure: { valueFields: ['count'] },
      permissions: { writableFields: ['count'] },
    })
    const env = {
      PICODASH_DEV_BRIDGE_URL: relay.baseUrl,
      PICODASH_DEV_BRIDGE_TOKEN: relay.agentCredential.token,
    }
    const sessionArgs = [
      '--session-id',
      browser.session.sessionId,
      '--generation',
      String(browser.session.generation),
    ]
    expect((await run(['sessions'], env)).code).toBe(0)
    expect((await run(['inspect', ...sessionArgs], env)).code).toBe(0)
    const changed = await run(['set-values', ...sessionArgs], env, '{"values":{"count":2}}')
    expect(changed.code).toBe(0)
    expect(JSON.parse(changed.stdout)).toMatchObject({
      requestId: expect.stringMatching(/^cli-[0-9a-f-]{36}$/),
    })
    const rejected = await run(['set-values', ...sessionArgs], env, '{"values":{"count":3}}')
    expect(rejected.code).toBe(5)
    expect(JSON.parse(rejected.stdout)).toMatchObject({
      outcome: { type: 'transaction_result', result: { ok: false } },
      requestId: expect.stringMatching(/^cli-[0-9a-f-]{36}$/),
    })
    const denied = await run(['set-values', ...sessionArgs], env, '{"values":{"secret":1}}')
    expect(denied.code).toBe(4)
    expect(JSON.parse(denied.stdout)).toMatchObject({
      error: { code: 'capability_denied' },
      requestId: expect.stringMatching(/^cli-[0-9a-f-]{36}$/),
    })
    const waited = await run(
      ['wait', ...sessionArgs],
      env,
      '{"timeoutMs":100,"condition":{"type":"value_equals","field":"count","value":2}}',
    )
    expect(waited.code).toBe(0)
    expect(JSON.parse(waited.stdout)).toMatchObject({ type: 'wait_result', outcome: 'satisfied' })
    const timedOut = await run(
      ['wait', ...sessionArgs],
      env,
      '{"timeoutMs":10,"condition":{"type":"sequence_after","sequence":999}}',
    )
    expect(timedOut.code).toBe(6)
    expect(JSON.parse(timedOut.stdout)).toMatchObject({ type: 'wait_result', outcome: 'timed_out' })
    nexus.destroy({ discardUnpersisted: true })
    nexus = undefined
    const contract = await run(['set-values', ...sessionArgs], env, '{"values":{"count":4}}')
    expect(contract.code).toBe(5)
    expect(JSON.parse(contract.stdout)).toMatchObject({
      outcome: { type: 'contract_error', code: 'use-after-destroy' },
      requestId: expect.stringMatching(/^cli-[0-9a-f-]{36}$/),
    })
  })

  test('rejects invalid stdin and stale generations with specified exits', async () => {
    ;(globalThis as unknown as { WebSocket: unknown }).WebSocket = BrowserWebSocket
    nexus = createPicodashNexus({ valueOwner: 'nexus', fields: { count: { defaultValue: 1 } } })
    relay = await startPicodashDevBridgeRelay({ allowedBrowserOrigins: ['http://localhost'] })
    browser = await connectPicodashDevBridge({
      nexus,
      credential: relay.issueBrowserCredential('http://localhost'),
      registrationId: 'cli-input',
      browserTabId: 'tab',
      disclosure: { valueFields: ['count'] },
      permissions: { writableFields: ['count'] },
    })
    const env = {
      PICODASH_DEV_BRIDGE_URL: relay.baseUrl,
      PICODASH_DEV_BRIDGE_TOKEN: relay.agentCredential.token,
    }
    const args = [
      'set-values',
      '--session-id',
      browser.session.sessionId,
      '--generation',
      String(browser.session.generation),
    ]
    expect((await run(args, env, '{"values":{}} extra')).code).toBe(2)
    expect((await run(args, env, '{"values":{},"extra":1}')).code).toBe(2)
    expect(
      (
        await run(
          [
            'wait',
            '--session-id',
            browser.session.sessionId,
            '--generation',
            String(browser.session.generation),
          ],
          env,
          '{"timeoutMs":1,"condition":{"type":"value_equals","field":"bad\u0000field","value":1}}',
        )
      ).code,
    ).toBe(2)
    expect((await run(args, env, `{"values":{"count":"${'x'.repeat(1_000_001)}"}}`)).code).toBe(2)
    const stale = await run(
      ['inspect', '--session-id', browser.session.sessionId, '--generation', '2'],
      env,
    )
    expect(stale.code).toBe(4)
    expect(JSON.parse(stale.stdout)).toMatchObject({ error: { code: 'generation_mismatch' } })
    const missing = await run(['inspect', '--session-id', 'missing', '--generation', '1'], env)
    expect(missing.code).toBe(4)
    expect(JSON.parse(missing.stdout)).toMatchObject({ error: { code: 'session_not_found' } })
  })

  test('aborts wait on SIGINT with exit 130', async () => {
    ;(globalThis as unknown as { WebSocket: unknown }).WebSocket = BrowserWebSocket
    nexus = createPicodashNexus({ valueOwner: 'nexus', fields: { count: { defaultValue: 1 } } })
    relay = await startPicodashDevBridgeRelay({ allowedBrowserOrigins: ['http://localhost'] })
    browser = await connectPicodashDevBridge({
      nexus,
      credential: relay.issueBrowserCredential('http://localhost'),
      registrationId: 'cli-sigint',
      browserTabId: 'tab',
      disclosure: { valueFields: ['count'] },
    })
    const child = spawn(
      process.execPath,
      [
        cli,
        'wait',
        '--session-id',
        browser.session.sessionId,
        '--generation',
        String(browser.session.generation),
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          PICODASH_DEV_BRIDGE_URL: relay.baseUrl,
          PICODASH_DEV_BRIDGE_TOKEN: relay.agentCredential.token,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    )
    const output: Buffer[] = []
    child.stderr.on('data', (chunk) => output.push(Buffer.from(chunk)))
    child.stdin.end('{"timeoutMs":30000,"condition":{"type":"sequence_after","sequence":0}}')
    await new Promise((resolve) => setTimeout(resolve, 1_000))
    child.kill('SIGINT')
    const code = await new Promise<number | null>((resolve) => child.on('close', resolve))
    expect(code).toBe(130)
    expect(Buffer.concat(output).toString()).toContain('aborted')
  }, 30_000)
})

import { describe, expect, test } from 'vite-plus/test'
import WebSocket from 'ws'
import { createPicodashStore } from '@picodash/store'
import { createPicodashDevBridgeClient } from '../src/client.js'
import { startPicodashDevBridgeRelay } from '../src/relay.js'

const waitMessage = (socket: WebSocket) =>
  new Promise<Record<string, unknown>>((resolve) =>
    socket.once('message', (raw) =>
      resolve(
        JSON.parse(
          Buffer.isBuffer(raw)
            ? raw.toString('utf8')
            : Buffer.from(raw as ArrayBuffer).toString('utf8'),
        ) as Record<string, unknown>,
      ),
    ),
  )

describe('dev bridge relay', () => {
  test('refuses production before binding', async () => {
    const previous = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    await expect(
      startPicodashDevBridgeRelay({ allowedBrowserOrigins: ['http://localhost'] }),
    ).rejects.toThrow()
    process.env.NODE_ENV = previous
  })

  test('authenticates origin and bearer, discloses metadata only, and executes atomic writes', async () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { count: { defaultValue: 1 }, secret: { defaultValue: 'hidden' } },
    })
    const relay = await startPicodashDevBridgeRelay({ allowedBrowserOrigins: ['http://localhost'] })
    const browser = relay.issueBrowserCredential('http://localhost')
    const socket = new WebSocket(browser.webSocketUrl, 'picodash.dev-bridge.v1', {
      headers: { Origin: browser.origin },
    })
    await new Promise<void>((resolve) => socket.once('open', resolve))
    socket.send(
      JSON.stringify({
        type: 'register',
        protocolVersion: 1,
        token: browser.token,
        registration: {
          registrationId: 'test',
          browserTabId: 'tab',
          fieldKeys: ['count', 'secret'],
          disclosure: { valueFields: ['count'], scopeIds: [], diagnostics: false },
          permissions: { writableFields: ['count'] },
        },
      }),
    )
    const registered = await waitMessage(socket)
    const session = registered.session as { sessionId: string; generation: number }
    socket.send(
      JSON.stringify({
        type: 'snapshot',
        session: { sessionId: session.sessionId, generation: session.generation, sequence: 0 },
        sequence: 0,
        snapshot: { values: { count: 1 } },
      }),
    )
    const client = createPicodashDevBridgeClient(relay.agentCredential)
    const listed = await client.listSessions()
    expect(listed).toHaveLength(1)
    const inspected = await client.inspect({
      sessionId: session.sessionId,
      generation: 1,
      sequence: 0,
    })
    expect(inspected.snapshot).toEqual({ values: { count: 1 } })
    const writePromise = client.setValues(
      { sessionId: session.sessionId, generation: 1, sequence: 0 },
      { type: 'set_values', requestId: 'set-1', values: { count: 2 } },
    )
    const command = await waitMessage(socket)
    expect(command.type).toBe('command')
    socket.send(
      JSON.stringify({
        type: 'snapshot',
        session: { sessionId: session.sessionId, generation: 1, sequence: 1 },
        sequence: 1,
        snapshot: { values: { count: 2 } },
      }),
    )
    socket.send(
      JSON.stringify({
        type: 'command_result',
        requestId: 'set-1',
        session: { sessionId: session.sessionId, generation: 1, sequence: 1 },
        beforeSequence: 0,
        afterSequence: 1,
        outcome: {
          type: 'transaction_result',
          result: { ok: true, changedFields: ['count'], changedScopeIds: [] },
        },
      }),
    )
    expect(await writePromise).toMatchObject({
      type: 'command_result',
      outcome: { type: 'transaction_result' },
    })
    expect(store.getState().values.count).toBe(1)
    socket.close()
    await relay.close()
    store.destroy()
  })
})

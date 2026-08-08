import { afterEach, describe, expect, test, vi } from 'vite-plus/test'
import WebSocket from 'ws'
import { createPicodashDevBridgeClient } from '../src/client.js'
import { startPicodashDevBridgeRelay } from '../src/relay.js'
import {
  closeSocket,
  frame,
  openSocket,
  readFrame,
  registerFrame,
  snapshotFrame,
  waitOpen,
} from './support/raw.js'

const relays: Array<Awaited<ReturnType<typeof startPicodashDevBridgeRelay>>> = []
const sockets: WebSocket[] = []

afterEach(async () => {
  await Promise.all(sockets.splice(0).map(closeSocket))
  await Promise.all(relays.splice(0).map((relay) => relay.close()))
  vi.useRealTimers()
})

async function connected() {
  const relay = await startPicodashDevBridgeRelay({ allowedBrowserOrigins: ['http://localhost'] })
  relays.push(relay)
  const credential = relay.issueBrowserCredential('http://localhost')
  const socket = openSocket(credential.webSocketUrl, credential.origin)
  sockets.push(socket)
  await waitOpen(socket)
  frame(socket, registerFrame(credential.token))
  const registered = await readFrame(socket)
  const session = registered.session as Record<string, any>
  frame(socket, snapshotFrame(session, 0, { values: { count: 1 } }))
  await Promise.resolve()
  return { relay, socket, session, client: createPicodashDevBridgeClient(relay.agentCredential) }
}

describe('dev bridge relay observation and command lifecycle', () => {
  test('requires initial sequence zero, accepts monotonic snapshots, and requests exact gap resync', async () => {
    const relay = await startPicodashDevBridgeRelay({ allowedBrowserOrigins: ['http://localhost'] })
    relays.push(relay)
    const credential = relay.issueBrowserCredential('http://localhost')
    const socket = openSocket(credential.webSocketUrl, credential.origin)
    sockets.push(socket)
    await waitOpen(socket)
    frame(socket, registerFrame(credential.token))
    const registered = await readFrame(socket)
    const session = registered.session as Record<string, any>
    frame(socket, snapshotFrame(session, 2, { values: { count: 1 } }))
    expect(await readFrame(socket)).toMatchObject({ type: 'resync_request', nextSequence: 0 })
    frame(socket, snapshotFrame(session, 0, { values: { count: 1 } }))
    frame(socket, snapshotFrame(session, 1, { values: { count: 2 } }))
    const client = createPicodashDevBridgeClient(relay.agentCredential)
    await expect(
      client.inspect({ sessionId: session.sessionId, generation: 1, sequence: 1 }),
    ).resolves.toMatchObject({ session: { sequence: 1 }, snapshot: { values: { count: 2 } } })
  })

  test('returns command_timed_out after five seconds without a browser result', async () => {
    vi.useFakeTimers()
    const { client, session, socket } = await connected()
    const pending = client.setValues(
      { sessionId: session.sessionId, generation: session.generation, sequence: 0 },
      { type: 'set_values', requestId: 'timeout', values: { count: 2 } },
    )
    await readFrame(socket)
    await vi.advanceTimersByTimeAsync(5000)
    await expect(pending).resolves.toMatchObject({
      type: 'bridge_error',
      error: { code: 'command_timed_out' },
    })
  }, 7000)

  test('ignores forged command results until the current complete result arrives', async () => {
    const { client, session, socket } = await connected()
    let settled = false
    const pending = client.setValues(
      { sessionId: session.sessionId, generation: session.generation, sequence: 0 },
      { type: 'set_values', requestId: 'forged', values: { count: 2 } },
    )
    void pending.finally(() => {
      settled = true
    })
    await readFrame(socket)
    frame(socket, {
      type: 'command_result',
      requestId: 'forged',
      session: { sessionId: session.sessionId, generation: session.generation, sequence: 0 },
      beforeSequence: 0,
      afterSequence: 0,
      outcome: {
        type: 'transaction_result',
        result: { ok: true, changedFields: [], changedScopeIds: [] },
      },
      secret: 'must not be accepted',
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(settled).toBe(false)
    frame(socket, {
      type: 'command_result',
      requestId: 'forged',
      session: { sessionId: session.sessionId, generation: session.generation, sequence: 0 },
      beforeSequence: 99,
      afterSequence: 0,
      outcome: {
        type: 'transaction_result',
        result: { ok: true, changedFields: [], changedScopeIds: [] },
      },
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(settled).toBe(false)
    frame(socket, {
      type: 'command_result',
      requestId: 'forged',
      session: { sessionId: session.sessionId, generation: session.generation + 1, sequence: 0 },
      beforeSequence: 0,
      afterSequence: 0,
      outcome: {
        type: 'transaction_result',
        result: { ok: true, changedFields: [], changedScopeIds: [] },
      },
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(settled).toBe(false)
    frame(socket, {
      type: 'command_result',
      requestId: 'forged',
      session: { sessionId: session.sessionId, generation: session.generation, sequence: 0 },
      beforeSequence: 0,
      afterSequence: 0,
      outcome: {
        type: 'transaction_result',
        result: { ok: true, changedFields: [], changedScopeIds: [] },
      },
    })
    await expect(pending).resolves.toMatchObject({ type: 'command_result' })
  })

  test('wait is relay-owned: immediate, later, timeout, and no browser command', async () => {
    const { client, session, socket } = await connected()
    await expect(
      client.wait(
        { sessionId: session.sessionId, generation: session.generation, sequence: 0 },
        {
          type: 'wait',
          requestId: 'immediate',
          timeoutMs: 100,
          condition: { type: 'sequence_after', sequence: -1 },
        },
      ),
    ).resolves.toMatchObject({
      type: 'wait_result',
      outcome: 'satisfied',
      session: { sequence: 0 },
    })

    let unsolicited = false
    const onMessage = () => {
      unsolicited = true
    }
    socket.on('message', onMessage)
    const later = client.wait(
      { sessionId: session.sessionId, generation: session.generation, sequence: 0 },
      {
        type: 'wait',
        requestId: 'later',
        timeoutMs: 1000,
        condition: { type: 'value_equals', field: 'count', value: 2, afterSequence: 0 },
      },
    )
    await expect(
      client.wait(
        { sessionId: session.sessionId, generation: session.generation, sequence: 0 },
        {
          type: 'wait',
          requestId: 'later',
          timeoutMs: 1000,
          condition: { type: 'sequence_after', sequence: 0 },
        },
      ),
    ).resolves.toMatchObject({ type: 'bridge_error', error: { code: 'request_in_flight' } })
    await new Promise((resolve) => setTimeout(resolve, 25))
    expect(unsolicited).toBe(false)
    frame(socket, snapshotFrame(session, 1, { values: { count: 2 } }))
    await expect(later).resolves.toMatchObject({
      type: 'wait_result',
      outcome: 'satisfied',
      session: { sequence: 1 },
    })
    socket.off('message', onMessage)

    await expect(
      client.wait(
        { sessionId: session.sessionId, generation: session.generation, sequence: 1 },
        {
          type: 'wait',
          requestId: 'timeout',
          timeoutMs: 20,
          condition: { type: 'sequence_after', sequence: 1 },
        },
      ),
    ).resolves.toMatchObject({ type: 'wait_result', outcome: 'timed_out' })
  })

  test('REST command payloads use exact JSON-safe shapes and bounded request IDs', async () => {
    const { relay, session } = await connected()

    if (
      typeof session.sessionId !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(session.sessionId) ||
      !Number.isSafeInteger(session.generation) ||
      session.generation < 1
    ) {
      throw new Error('Relay returned an invalid session reference.')
    }

    const url = new URL(
      `/v1/sessions/${session.sessionId}/generations/${session.generation}`,
      relay.baseUrl,
    )
    const send = (path: string, body: unknown) =>
      fetch(`${url}/${path}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${relay.agentCredential.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      })
    const invalidCommands = [
      { type: 'set_values', requestId: 'x', values: {}, extra: true },
      { type: 'set_values', requestId: '', values: {} },
      { type: 'set_values', requestId: 'x\u0000', values: {} },
      { type: 'set_values', requestId: 'x', values: [] },
      {
        type: 'wait',
        requestId: 'x',
        timeoutMs: 10,
        condition: { type: 'sequence_after', sequence: 0, extra: true },
      },
      {
        type: 'wait',
        requestId: 'x',
        timeoutMs: 0,
        condition: { type: 'sequence_after', sequence: 0 },
      },
      {
        type: 'wait',
        requestId: 'x',
        timeoutMs: 10,
        condition: { type: 'unknown', value: 1 },
      },
    ]
    for (const body of invalidCommands)
      await expect(send(body.type === 'wait' ? 'wait' : 'commands', body)).resolves.toMatchObject({
        status: 400,
      })
  })

  test('value waits compare canonical JSON independent of object key order', async () => {
    const { relay, socket, session, client } = await connected()
    frame(socket, snapshotFrame(session, 1, { values: { count: { first: 1, second: 2 } } }))
    await expect(
      client.wait(
        { sessionId: session.sessionId, generation: session.generation, sequence: 1 },
        {
          type: 'wait',
          requestId: 'canonical',
          timeoutMs: 100,
          condition: { type: 'value_equals', field: 'count', value: { second: 2, first: 1 } },
        },
      ),
    ).resolves.toMatchObject({ type: 'wait_result', outcome: 'satisfied' })
    await relay.close()
  })

  test('rejects value waits for undisclosed fields and cleans up aborted waits', async () => {
    const { client, session } = await connected()
    await expect(
      client.wait(
        { sessionId: session.sessionId, generation: session.generation, sequence: 0 },
        {
          type: 'wait',
          requestId: 'hidden',
          timeoutMs: 100,
          condition: { type: 'value_equals', field: 'secret', value: 'x' },
        },
      ),
    ).resolves.toMatchObject({ type: 'bridge_error', error: { code: 'capability_denied' } })
    const controller = new AbortController()
    const pending = client.wait(
      { sessionId: session.sessionId, generation: session.generation, sequence: 0 },
      {
        type: 'wait',
        requestId: 'abort',
        timeoutMs: 1000,
        condition: { type: 'sequence_after', sequence: 1 },
      },
      { signal: controller.signal },
    )
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  test('reconnect invalidates pending work from the previous generation', async () => {
    const { relay, socket: first, session, client } = await connected()
    const pending = client.wait(
      { sessionId: session.sessionId, generation: session.generation, sequence: 0 },
      {
        type: 'wait',
        requestId: 'reconnect',
        timeoutMs: 1000,
        condition: { type: 'sequence_after', sequence: 0 },
      },
    )
    const credential = relay.issueBrowserCredential('http://localhost')
    const second = openSocket(credential.webSocketUrl, credential.origin)
    sockets.push(second)
    await waitOpen(second)
    frame(second, registerFrame(credential.token, 'registration', 'tab'))
    const registered = await readFrame(second)
    const next = registered.session as Record<string, any>
    expect(next.generation).toBe(session.generation + 1)
    await expect(pending).resolves.toMatchObject({
      type: 'bridge_error',
      error: { code: 'generation_mismatch' },
    })
    await closeSocket(first)
  })
})

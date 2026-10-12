import { describe, expect, test } from 'vite-plus/test'
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

describe('dev bridge relay security boundaries', () => {
  test.each([false, true])(
    'rejects malformed session escapes with an active session: %s',
    async (withSession) => {
      const relay = await startPicodashDevBridgeRelay({
        allowedBrowserOrigins: ['http://localhost'],
      })
      let socket: ReturnType<typeof openSocket> | undefined
      const unhandled: unknown[] = []
      const onUnhandled = (reason: unknown) => unhandled.push(reason)
      process.on('unhandledRejection', onUnhandled)
      try {
        if (withSession) {
          const credential = relay.issueBrowserCredential('http://localhost')
          socket = openSocket(credential.webSocketUrl, credential.origin)
          await waitOpen(socket)
          frame(socket, registerFrame(credential.token))
          expect((await readFrame(socket)).type).toBe('registered')
        }
        for (const sessionId of ['%ZZ', '%E0%A4%A', '%']) {
          const response = await fetch(
            `${relay.baseUrl}/v1/sessions/${sessionId}/generations/1/snapshot`,
            {
              headers: { authorization: `Bearer ${relay.agentCredential.token}` },
              signal: AbortSignal.timeout(1000),
            },
          )
          expect(response.status).toBe(400)
          expect(await response.json()).toMatchObject({
            type: 'bridge_error',
            error: { code: 'invalid_request', message: 'Invalid request.' },
          })
          const sessions = await createPicodashDevBridgeClient(relay.agentCredential).listSessions()
          expect(sessions).toHaveLength(withSession ? 1 : 0)
        }
        if (withSession) {
          const sessions = await createPicodashDevBridgeClient(relay.agentCredential).listSessions()
          const session = sessions[0]!
          const encodedId = `%${session.sessionId.charCodeAt(0).toString(16)}${session.sessionId.slice(1)}`
          const response = await fetch(
            `${relay.baseUrl}/v1/sessions/${encodedId}/generations/${session.generation}/snapshot`,
            { headers: { authorization: `Bearer ${relay.agentCredential.token}` } },
          )
          // A registered peer without a snapshot is valid but unsynchronized.
          expect(response.status).toBe(409)
          expect(await response.json()).toMatchObject({
            type: 'bridge_error',
            error: { code: 'session_unsynchronized' },
          })
        }
        await new Promise<void>((resolve) => setImmediate(resolve))
        expect(unhandled).toEqual([])
      } finally {
        process.off('unhandledRejection', onUnhandled)
        await closeSocket(socket)
        await relay.close()
      }
    },
  )

  test.each([1, 2])(
    'rejects retired version-%s peers during the WebSocket handshake',
    async (version) => {
      const relay = await startPicodashDevBridgeRelay({
        allowedBrowserOrigins: ['http://localhost'],
      })
      const credential = relay.issueBrowserCredential('http://localhost')
      const socket = openSocket(
        credential.webSocketUrl,
        credential.origin,
        `picodash.dev-bridge.v${version}`,
      )
      socket.on('error', () => undefined)
      await new Promise<void>((resolve) => socket.once('close', resolve))
      expect(socket.protocol).toBe('')
      await relay.close()
    },
  )

  test('browser credentials are origin-bound and single-use', async () => {
    const relay = await startPicodashDevBridgeRelay({ allowedBrowserOrigins: ['http://localhost'] })
    const credential = relay.issueBrowserCredential('http://localhost')
    const wrongOrigin = openSocket(credential.webSocketUrl, 'http://evil.test')
    wrongOrigin.on('error', () => undefined)
    await new Promise<void>((resolve) => wrongOrigin.once('close', resolve))
    const socket = openSocket(credential.webSocketUrl, credential.origin)
    await waitOpen(socket)
    frame(socket, registerFrame(credential.token))
    expect((await readFrame(socket)).type).toBe('registered')
    const replay = openSocket(credential.webSocketUrl, credential.origin)
    await waitOpen(replay)
    frame(replay, registerFrame(credential.token, 'replay', 'replay'))
    await expect(readFrame(replay)).rejects.toBeDefined()
    await closeSocket(replay)
    await closeSocket(socket)
    await relay.close()
  })

  test('malformed reconnect consumes only its credential and cannot replace a valid session', async () => {
    const relay = await startPicodashDevBridgeRelay({ allowedBrowserOrigins: ['http://localhost'] })
    const firstCredential = relay.issueBrowserCredential('http://localhost')
    const first = openSocket(firstCredential.webSocketUrl, firstCredential.origin)
    await waitOpen(first)
    frame(first, registerFrame(firstCredential.token, 'same', 'same'))
    const registered = await readFrame(first)
    const session = registered.session as Record<string, any>
    const malformedCredential = relay.issueBrowserCredential('http://localhost')
    const malformed = openSocket(malformedCredential.webSocketUrl, malformedCredential.origin)
    await waitOpen(malformed)
    frame(malformed, registerFrame(malformedCredential.token, 'same', 'same', { extra: true }))
    await closeSocket(malformed)
    const listed = await createPicodashDevBridgeClient(relay.agentCredential).listSessions()
    expect(listed).toHaveLength(1)
    expect(listed[0]).toMatchObject({ sessionId: session.sessionId, generation: 1 })
    await closeSocket(first)
    await relay.close()
  })

  test('authenticated socket close removes active session and disclosed snapshot', async () => {
    const relay = await startPicodashDevBridgeRelay({ allowedBrowserOrigins: ['http://localhost'] })
    const credential = relay.issueBrowserCredential('http://localhost')
    const socket = openSocket(credential.webSocketUrl, credential.origin)
    await waitOpen(socket)
    frame(socket, registerFrame(credential.token))
    const registered = await readFrame(socket)
    const session = registered.session as Record<string, any>
    frame(socket, snapshotFrame(session, 0, { values: { count: 1 } }))
    await new Promise((resolve) => setTimeout(resolve, 10))
    await closeSocket(socket)
    const client = createPicodashDevBridgeClient(relay.agentCredential)
    await expect(client.listSessions()).resolves.toHaveLength(0)
    await expect(
      client.inspect({ sessionId: session.sessionId, generation: 1, sequence: 0 }),
    ).rejects.toMatchObject({ error: { code: 'session_not_found' } })
    await relay.close()
  })

  test('session identity tuples do not collide when registration fields contain separators', async () => {
    const relay = await startPicodashDevBridgeRelay({ allowedBrowserOrigins: ['http://localhost'] })
    const firstCredential = relay.issueBrowserCredential('http://localhost')
    const first = openSocket(firstCredential.webSocketUrl, firstCredential.origin)
    await waitOpen(first)
    frame(first, registerFrame(firstCredential.token, 'a\0b', 'c'))
    await readFrame(first)
    const secondCredential = relay.issueBrowserCredential('http://localhost')
    const second = openSocket(secondCredential.webSocketUrl, secondCredential.origin)
    await waitOpen(second)
    frame(second, registerFrame(secondCredential.token, 'a', 'b\0c'))
    await readFrame(second)
    await expect(
      createPicodashDevBridgeClient(relay.agentCredential).listSessions(),
    ).resolves.toHaveLength(2)
    await closeSocket(first)
    await closeSocket(second)
    await relay.close()
  })

  test('invalid registration and snapshot payloads are rejected without widening disclosure', async () => {
    const relay = await startPicodashDevBridgeRelay({ allowedBrowserOrigins: ['http://localhost'] })
    const credential = relay.issueBrowserCredential('http://localhost')
    const socket = openSocket(credential.webSocketUrl, credential.origin)
    await waitOpen(socket)
    frame(
      socket,
      registerFrame(credential.token, 'bad', 'bad', {
        disclosure: { valueFields: ['secret'], scopeIds: [], diagnostics: false },
      }),
    )
    await closeSocket(socket)

    const validCredential = relay.issueBrowserCredential('http://localhost')
    const valid = openSocket(validCredential.webSocketUrl, validCredential.origin)
    await waitOpen(valid)
    frame(valid, registerFrame(validCredential.token))
    const registered = await readFrame(valid)
    const session = registered.session as Record<string, any>
    frame(valid, snapshotFrame(session, 0, { values: { count: 1, secret: 'leak' } }))
    const resync = await readFrame(valid)
    expect(resync).toMatchObject({ type: 'resync_request', nextSequence: 0 })
    await closeSocket(valid)
    await relay.close()
  })

  test('snapshots must include each disclosed value and scope exactly once', async () => {
    const relay = await startPicodashDevBridgeRelay({ allowedBrowserOrigins: ['http://localhost'] })
    const credential = relay.issueBrowserCredential('http://localhost')
    const socket = openSocket(credential.webSocketUrl, credential.origin)
    await waitOpen(socket)
    frame(
      socket,
      registerFrame(credential.token, 'complete', 'complete', {
        disclosure: {
          valueFields: ['count'],
          scopeIds: ['scope-a', 'scope-b'],
          diagnostics: false,
        },
      }),
    )
    const registered = await readFrame(socket)
    const session = registered.session as Record<string, any>
    frame(
      socket,
      snapshotFrame(session, 0, { values: {}, scopes: [{ id: 'scope-a' }, { id: 'scope-b' }] }),
    )
    expect(await readFrame(socket)).toMatchObject({ type: 'resync_request', nextSequence: 0 })
    frame(
      socket,
      snapshotFrame(session, 0, {
        values: { count: 1 },
        scopes: [{ id: 'scope-a' }, { id: 'scope-a' }],
      }),
    )
    expect(await readFrame(socket)).toMatchObject({ type: 'resync_request', nextSequence: 0 })
    frame(
      socket,
      snapshotFrame(session, 0, {
        values: { count: 1 },
        scopes: [{ id: 'scope-a' }, { id: 'scope-b' }],
      }),
    )
    await expect(
      createPicodashDevBridgeClient(relay.agentCredential).inspect({
        sessionId: session.sessionId,
        generation: session.generation,
        sequence: 0,
      }),
    ).resolves.toMatchObject({ snapshot: { values: { count: 1 } } })
    await closeSocket(socket)
    await relay.close()
  })

  test('REST wrappers require the agent bearer and metadata descriptors disclose no values', async () => {
    const relay = await startPicodashDevBridgeRelay({ allowedBrowserOrigins: ['http://localhost'] })
    const unauthorized = await fetch(`${relay.baseUrl}/v1/sessions`)
    expect(unauthorized.status).toBe(401)
    const credential = relay.issueBrowserCredential('http://localhost')
    const socket = openSocket(credential.webSocketUrl, credential.origin)
    await waitOpen(socket)
    frame(socket, registerFrame(credential.token))
    const registered = await readFrame(socket)
    const session = registered.session as Record<string, any>
    const listed = await createPicodashDevBridgeClient(relay.agentCredential).listSessions()
    expect(listed[0]).not.toHaveProperty('values')
    expect(listed[0]).not.toHaveProperty('scopes')
    expect(listed[0]).not.toHaveProperty('diagnostics')
    frame(socket, snapshotFrame(session, 0, { values: { count: 1 } }))
    await closeSocket(socket)
    await relay.close()
  })

  test('stale command results are fenced by current generation and request identity', async () => {
    const relay = await startPicodashDevBridgeRelay({ allowedBrowserOrigins: ['http://localhost'] })
    const firstCredential = relay.issueBrowserCredential('http://localhost')
    const first = openSocket(firstCredential.webSocketUrl, firstCredential.origin)
    await waitOpen(first)
    frame(first, registerFrame(firstCredential.token, 'same', 'same'))
    const firstRegistered = await readFrame(first)
    const oldSession = firstRegistered.session as Record<string, any>
    frame(first, snapshotFrame(oldSession, 0, { values: { count: 1 } }))

    const secondCredential = relay.issueBrowserCredential('http://localhost')
    const second = openSocket(secondCredential.webSocketUrl, secondCredential.origin)
    await waitOpen(second)
    frame(second, registerFrame(secondCredential.token, 'same', 'same'))
    const secondRegistered = await readFrame(second)
    const current = secondRegistered.session as Record<string, any>
    frame(second, snapshotFrame(current, 0, { values: { count: 1 } }))
    const client = createPicodashDevBridgeClient(relay.agentCredential)
    const pending = client.setValues(
      { sessionId: current.sessionId, generation: current.generation, sequence: 0 },
      { type: 'set_values', requestId: 'fenced', values: { count: 2 } },
    )
    await readFrame(second)
    frame(second, {
      type: 'command_result',
      requestId: 'fenced',
      session: { sessionId: current.sessionId, generation: oldSession.generation, sequence: 0 },
      beforeSequence: 0,
      afterSequence: 0,
      outcome: {
        type: 'transaction_result',
        result: { ok: true, changedFields: [], changedScopeIds: [] },
      },
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    await relay.close()
    await expect(pending).resolves.toMatchObject({
      type: 'bridge_error',
      error: { code: 'session_disconnected' },
    })
    await closeSocket(first)
    await closeSocket(second)
  })
})

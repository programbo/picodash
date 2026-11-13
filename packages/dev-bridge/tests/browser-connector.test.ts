import { afterEach, describe, expect, test, vi } from 'vite-plus/test'
import WebSocket from 'ws'
import { createPicodashNexus } from '@picodash/nexus'
import {
  acquireProviderLease,
  acquireEntityLease,
  publishNexusInteraction,
} from '@picodash/nexus/integration'
import { connectPicodashDevBridge } from '../src/browser.js'
import { createPicodashDevBridgeClient } from '../src/client.js'
import { startPicodashDevBridgeRelay } from '../src/relay.js'

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

  get bufferedAmount() {
    return this.inner.bufferedAmount
  }

  send(value: string) {
    this.inner.send(value)
  }

  close() {
    this.inner.close()
  }
}

const previousWebSocket = globalThis.WebSocket
const relays: Array<Awaited<ReturnType<typeof startPicodashDevBridgeRelay>>> = []
const connections: Array<{ close(): Promise<void> }> = []
const stores: Array<{ destroy(): void }> = []

afterEach(async () => {
  vi.unstubAllGlobals()
  await Promise.all(connections.splice(0).map((connection) => connection.close()))
  await Promise.all(relays.splice(0).map((relay) => relay.close()))
  stores.splice(0).forEach((nexus) => nexus.destroy())
  ;(globalThis as unknown as { WebSocket: unknown }).WebSocket = previousWebSocket
})

describe('browser connector', () => {
  test('observes public Nexus events with long valid scope identities only within explicit disclosure without a snapshot write', async () => {
    ;(globalThis as unknown as { WebSocket: unknown }).WebSocket = BrowserWebSocket
    const nexus = createPicodashNexus({ valueOwner: 'nexus', fields: {} })
    stores.push(nexus)
    const panelScopeId = 'panel'.repeat(60)
    const host = acquireProviderLease(nexus)
    const panel = acquireEntityLease(nexus.scope(panelScopeId), { kind: 'dashPanel', host })
    const hidden = acquireEntityLease(nexus.scope('hidden'), { kind: 'dashPanel', host })
    try {
      const relay = await startPicodashDevBridgeRelay({
        allowedBrowserOrigins: ['http://localhost'],
      })
      relays.push(relay)
      const browser = await connectPicodashDevBridge({
        nexus,
        credential: relay.issueBrowserCredential('http://localhost'),
        registrationId: 'events',
        browserTabId: 'events-tab',
        disclosure: { eventScopeIds: [panelScopeId], eventTypes: ['hover'] },
      })
      connections.push(browser)
      const client = createPicodashDevBridgeClient(relay.agentCredential)
      const initial = await client.readEvents(browser.session, {
        type: 'read_events',
        requestId: 'baseline',
      })
      if (initial.type !== 'events_result') throw new Error('baseline failed')
      const before = nexus.getState()
      publishNexusInteraction(hidden, {
        type: 'hover',
        input: 'mouse',
        target: 'panel',
        phase: 'enter',
      })
      publishNexusInteraction(panel, {
        type: 'pointer',
        input: 'mouse',
        target: 'panel',
        phase: 'down',
      })
      publishNexusInteraction(panel, {
        type: 'hover',
        input: 'mouse',
        target: 'panel',
        phase: 'enter',
      })
      const observed = await client.readEvents(browser.session, {
        type: 'read_events',
        requestId: 'observed',
        cursor: initial.cursor,
        timeoutMs: 1000,
      })
      expect(observed).toMatchObject({
        type: 'events_result',
        outcome: 'available',
        cursor: { sequence: 1 },
        events: [
          {
            sequence: 1,
            event: { sequence: 3, source: { scopeId: panelScopeId }, event: { type: 'hover' } },
          },
        ],
      })
      expect(nexus.getState()).toBe(before)
      expect(await client.inspect(browser.session)).toMatchObject({
        snapshot: {},
        session: {
          sequence: 0,
          eventSequence: 1,
          disclosedScopeIds: [],
          disclosedEventScopeIds: [panelScopeId],
          disclosedEventTypes: ['hover'],
        },
      })
      await browser.close()
      expect(await client.listSessions()).toEqual([])
      publishNexusInteraction(panel, {
        type: 'hover',
        input: 'mouse',
        target: 'panel',
        phase: 'leave',
      })
      const reloaded = await connectPicodashDevBridge({
        nexus,
        credential: relay.issueBrowserCredential('http://localhost'),
        registrationId: 'events',
        browserTabId: 'events-tab',
        disclosure: { eventScopeIds: [panelScopeId], eventTypes: ['hover'] },
      })
      connections.push(reloaded)
      expect(reloaded.session.generation).toBe(browser.session.generation + 1)
      await expect(
        client.readEvents(reloaded.session, {
          type: 'read_events',
          requestId: 'stale-cursor',
          cursor: initial.cursor,
        }),
      ).resolves.toMatchObject({ type: 'bridge_error', error: { code: 'generation_mismatch' } })
    } finally {
      hidden.release()
      panel.release()
      host.release()
    }
  })

  test('cancels pending registration before root destruction and ignores late frames', async () => {
    let release: (() => void) | undefined
    class DelayedRegistrationSocket extends BrowserWebSocket {
      override dispatchEvent(event: Event) {
        if (event instanceof MessageEvent) {
          release = () => super.dispatchEvent(event)
          return true
        }
        return super.dispatchEvent(event)
      }
    }
    ;(globalThis as unknown as { WebSocket: unknown }).WebSocket = DelayedRegistrationSocket
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { count: { defaultValue: 1 } },
    })
    const relay = await startPicodashDevBridgeRelay({ allowedBrowserOrigins: ['http://localhost'] })
    relays.push(relay)
    const abort = new AbortController()
    const pending = connectPicodashDevBridge({
      nexus,
      credential: relay.issueBrowserCredential('http://localhost'),
      registrationId: 'cancelled',
      disclosure: { valueFields: ['count'] },
      signal: abort.signal,
    })
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await expect.poll(() => release !== undefined).toBe(true)
    abort.abort()
    nexus.destroy()
    release!()
    await rejected
    await expect
      .poll(
        async () =>
          (await createPicodashDevBridgeClient(relay.agentCredential).listSessions()).length,
      )
      .toBe(0)
  })

  test('uses a real public Nexus, reports structured rejection, and advances snapshots', async () => {
    ;(globalThis as unknown as { WebSocket: unknown }).WebSocket = BrowserWebSocket
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: {
        count: {
          defaultValue: 1,
          validate: (value) => (Number(value) === 3 ? [{ message: 'No threes.' }] : []),
        },
      },
    })
    stores.push(nexus)
    const relay = await startPicodashDevBridgeRelay({ allowedBrowserOrigins: ['http://localhost'] })
    relays.push(relay)
    const browser = await connectPicodashDevBridge({
      nexus,
      credential: relay.issueBrowserCredential('http://localhost'),
      registrationId: 'browser-test',
      browserTabId: 'browser-tab',
      disclosure: { valueFields: ['count'] },
      permissions: { writableFields: ['count'] },
    })
    connections.push(browser)
    const client = createPicodashDevBridgeClient(relay.agentCredential)
    const first = await client.inspect(browser.session)
    expect(first.snapshot).toEqual({ values: { count: 1 } })
    const success = await client.setValues(browser.session, {
      type: 'set_values',
      requestId: 'real-success',
      values: { count: 2 },
    })
    expect(success).toMatchObject({ outcome: { type: 'transaction_result', result: { ok: true } } })
    expect(nexus.getState().values.count).toBe(2)
    expect((await client.inspect(browser.session)).snapshot).toEqual({ values: { count: 2 } })
    const rejected = await client.setValues(browser.session, {
      type: 'set_values',
      requestId: 'real-rejection',
      values: { count: 3 },
    })
    expect(rejected).toMatchObject({
      outcome: {
        type: 'transaction_result',
        result: { ok: false, issues: [{ message: 'No threes.' }] },
      },
    })
    expect(nexus.getState().values.count).toBe(2)
  })

  test('advances sequence only when explicitly disclosed Nexus state changes', async () => {
    ;(globalThis as unknown as { WebSocket: unknown }).WebSocket = BrowserWebSocket
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: {
        count: { defaultValue: 1 },
        secret: { defaultValue: 'hidden' },
      },
    })
    stores.push(nexus)
    const relay = await startPicodashDevBridgeRelay({ allowedBrowserOrigins: ['http://localhost'] })
    relays.push(relay)
    const browser = await connectPicodashDevBridge({
      nexus,
      credential: relay.issueBrowserCredential('http://localhost'),
      registrationId: 'disclosed-sequence',
      browserTabId: 'browser-tab',
      disclosure: { valueFields: ['count'], scopeIds: ['visible-scope'] },
    })
    connections.push(browser)
    const client = createPicodashDevBridgeClient(relay.agentCredential)

    expect((await client.inspect(browser.session)).session.sequence).toBe(0)
    nexus.setValue(nexus.fields.secret, 'still-hidden')
    nexus.setDashStackRootOrder('hidden-scope', ['item'])
    expect((await client.inspect(browser.session)).session.sequence).toBe(0)
    await expect(
      client.wait(browser.session, {
        type: 'wait',
        requestId: 'hidden-activity',
        timeoutMs: 20,
        condition: { type: 'value_equals', field: 'count', value: 1, afterSequence: 0 },
      }),
    ).resolves.toMatchObject({ type: 'wait_result', outcome: 'timed_out' })

    nexus.setDashStackRootOrder('visible-scope', ['item'])
    expect((await client.inspect(browser.session)).session.sequence).toBe(1)
    await expect(
      client.wait(browser.session, {
        type: 'wait',
        requestId: 'visible-metadata-sequence',
        timeoutMs: 20,
        condition: { type: 'sequence_after', sequence: 0 },
      }),
    ).resolves.toMatchObject({
      type: 'wait_result',
      outcome: 'satisfied',
      session: { sequence: 1 },
      snapshot: {
        scopes: [
          {
            id: 'visible-scope',
            metadata: {
              dashStack: {
                rootOrder: [[0, 'item']],
                groupOrders: [],
                collapseOverrides: [],
              },
            },
          },
        ],
      },
    })
    await expect(client.inspect(browser.session)).resolves.toMatchObject({
      session: { sequence: 1 },
      snapshot: {
        values: { count: 1 },
        scopes: [
          {
            id: 'visible-scope',
            metadata: {
              dashStack: {
                rootOrder: [[0, 'item']],
                groupOrders: [],
                collapseOverrides: [],
              },
            },
          },
        ],
      },
    })
    nexus.setValue(nexus.fields.count, 2)
    await expect(client.inspect(browser.session)).resolves.toMatchObject({
      session: { sequence: 2 },
      snapshot: { values: { count: 2 } },
    })
  })

  test('reconnects with a new generation and removes subscriptions on close', async () => {
    ;(globalThis as unknown as { WebSocket: unknown }).WebSocket = BrowserWebSocket
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { count: { defaultValue: 1 } },
    })
    stores.push(nexus)
    const relay = await startPicodashDevBridgeRelay({ allowedBrowserOrigins: ['http://localhost'] })
    relays.push(relay)
    const first = await connectPicodashDevBridge({
      nexus,
      credential: relay.issueBrowserCredential('http://localhost'),
      registrationId: 'reload',
      browserTabId: 'tab',
      disclosure: { valueFields: ['count'] },
      permissions: { writableFields: ['count'] },
    })
    connections.push(first)
    const second = await connectPicodashDevBridge({
      nexus,
      credential: relay.issueBrowserCredential('http://localhost'),
      registrationId: 'reload',
      browserTabId: 'tab',
      disclosure: { valueFields: ['count'] },
      permissions: { writableFields: ['count'] },
    })
    connections.push(second)
    expect(second.session.sessionId).toBe(first.session.sessionId)
    expect(second.session.generation).toBe(first.session.generation + 1)
    await first.close()
    await second.close()
    await expect(
      createPicodashDevBridgeClient(relay.agentCredential).listSessions(),
    ).resolves.toHaveLength(0)
  })

  test('maps plain Nexus exceptions to a request-bound redacted bridge error', async () => {
    ;(globalThis as unknown as { WebSocket: unknown }).WebSocket = BrowserWebSocket
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { count: { defaultValue: 1 } },
    })
    stores.push(nexus)
    const throwingNexus = new Proxy(nexus, {
      get(target, property, receiver) {
        if (property === 'setValues')
          return () => {
            throw new Error('secret details')
          }
        return Reflect.get(target, property, receiver)
      },
    })
    const relay = await startPicodashDevBridgeRelay({ allowedBrowserOrigins: ['http://localhost'] })
    relays.push(relay)
    const browser = await connectPicodashDevBridge({
      nexus: throwingNexus,
      credential: relay.issueBrowserCredential('http://localhost'),
      registrationId: 'plain-error',
      browserTabId: 'tab',
      disclosure: { valueFields: ['count'] },
      permissions: { writableFields: ['count'] },
    })
    connections.push(browser)
    const result = await createPicodashDevBridgeClient(relay.agentCredential).setValues(
      browser.session,
      { type: 'set_values', requestId: 'plain-error', values: { count: 2 } },
    )
    expect(result).toMatchObject({
      type: 'bridge_error',
      requestId: 'plain-error',
      error: { code: 'internal_error', message: 'Nexus operation failed.' },
    })
    expect(JSON.stringify(result)).not.toContain('secret details')
  })

  test('keeps Nexus contract errors as structured outcomes and preserves persistence status', async () => {
    ;(globalThis as unknown as { WebSocket: unknown }).WebSocket = BrowserWebSocket
    let payload: string | null = null
    const driver = {
      identity: {},
      read: () => payload,
      write: (_key: string, next: string) => {
        payload = next
      },
      remove: () => {
        payload = null
      },
    }
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      nexusId: 'dev-bridge-persistence',
      schemaVersion: 1,
      fields: { count: { defaultValue: 1 } },
      persistence: {
        storageKey: 'state',
        driver,
        values: { defaultFieldPolicy: 'include' },
      },
    })
    stores.push(nexus)
    const relay = await startPicodashDevBridgeRelay({ allowedBrowserOrigins: ['http://localhost'] })
    relays.push(relay)
    const browser = await connectPicodashDevBridge({
      nexus,
      credential: relay.issueBrowserCredential('http://localhost'),
      registrationId: 'persistent',
      browserTabId: 'tab',
      disclosure: { valueFields: ['count'] },
      permissions: { writableFields: ['count'] },
    })
    connections.push(browser)
    const client = createPicodashDevBridgeClient(relay.agentCredential)
    const saved = await client.setValues(browser.session, {
      type: 'set_values',
      requestId: 'saved',
      values: { count: 2 },
    })
    expect(saved).toMatchObject({ outcome: { result: { ok: true, persistence: 'saved' } } })
    stores.splice(stores.indexOf(nexus), 1)
    nexus.destroy({ discardUnpersisted: true })
    const destroyed = await client.setValues(browser.session, {
      type: 'set_values',
      requestId: 'destroyed',
      values: { count: 3 },
    })
    expect(destroyed).toMatchObject({
      outcome: { type: 'contract_error', code: 'use-after-destroy' },
    })
  })
})

test('named observations stay read-only, recover unavailable values, correlate terminal revisions and unsubscribe', async () => {
  vi.stubGlobal('WebSocket', BrowserWebSocket)
  const nexus = createPicodashNexus({ valueOwner: 'nexus', fields: { count: { defaultValue: 1 } } })
  stores.push(nexus)
  const relay = await startPicodashDevBridgeRelay({ allowedBrowserOrigins: ['http://localhost'] })
  relays.push(relay)
  const listeners = new Set<() => void>()
  let revision = 2
  let invalid = false
  let completion: number | null = null
  let firstRead = true
  const observations = {
    getSnapshot: () => {
      if (firstRead) {
        firstRead = false
        revision = 3
        listeners.forEach((listener) => listener())
      }
      if (invalid) throw new Error('private worker failure')
      return {
        solver: { requestRevision: revision, status: completion === null ? 'pending' : 'ready' },
        solverSettledRevision: completion,
        secret: 'not disclosed',
      }
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      revision = 3
      listener()
      return () => listeners.delete(listener)
    },
  }
  const abort = new AbortController()
  const connection = await connectPicodashDevBridge({
    nexus,
    credential: relay.issueBrowserCredential('http://localhost'),
    registrationId: 'external',
    buildId: 'build-a',
    disclosure: { valueFields: ['count'], observationNames: ['solver', 'solverSettledRevision'] },
    permissions: { writableFields: ['count'] },
    observations,
    signal: abort.signal,
  })
  connections.push(connection)
  const client = createPicodashDevBridgeClient(relay.agentCredential)
  await expect
    .poll(async () => (await client.inspect(connection.session)).snapshot.observations?.solver)
    .toEqual({ status: 'available', value: { requestRevision: 3, status: 'pending' } })
  const before = await client.inspect(connection.session)
  expect(before.session.buildId).toBe('build-a')
  expect(before.snapshot.observations?.secret).toBeUndefined()
  listeners.forEach((listener) => listener())
  await new Promise((resolve) => setTimeout(resolve, 10))
  expect((await client.inspect(connection.session)).session.sequence).toBe(before.session.sequence)
  const pending = client.wait(connection.session, {
    type: 'wait',
    requestId: 'terminal',
    timeoutMs: 1000,
    condition: { type: 'observation_equals', name: 'solverSettledRevision', value: 3 },
  })
  completion = 2
  listeners.forEach((listener) => listener())
  await expect
    .poll(
      async () =>
        (await client.inspect(connection.session)).snapshot.observations?.solverSettledRevision,
    )
    .toEqual({ status: 'available', value: 2 })
  completion = 3
  listeners.forEach((listener) => listener())
  expect(await pending).toMatchObject({
    outcome: 'satisfied',
    snapshot: { observations: { solverSettledRevision: { status: 'available', value: 3 } } },
  })
  expect(
    await client.wait(connection.session, {
      type: 'wait',
      requestId: 'denied',
      timeoutMs: 10,
      condition: { type: 'observation_equals', name: 'secret', value: 'not disclosed' },
    }),
  ).toMatchObject({ error: { code: 'capability_denied' } })
  invalid = true
  listeners.forEach((listener) => listener())
  await expect
    .poll(async () => (await client.inspect(connection.session)).snapshot.observations?.solver)
    .toEqual({ status: 'unavailable' })
  expect((await client.inspect(connection.session)).snapshot.values).toEqual({ count: 1 })
  invalid = false
  listeners.forEach((listener) => listener())
  await expect
    .poll(async () => (await client.inspect(connection.session)).snapshot.observations?.solver)
    .toMatchObject({ status: 'available' })
  abort.abort()
  await connection.close()
  expect(listeners.size).toBe(0)
})

test('malformed, cyclic and oversized observation results are redacted and recover without losing Nexus', async () => {
  vi.stubGlobal('WebSocket', BrowserWebSocket)
  const nexus = createPicodashNexus({ valueOwner: 'nexus', fields: { count: { defaultValue: 1 } } })
  stores.push(nexus)
  const relay = await startPicodashDevBridgeRelay({ allowedBrowserOrigins: ['http://localhost'] })
  relays.push(relay)
  let notify = () => {}
  let value: unknown = () => 'private function'
  const source = {
    getSnapshot: () => ({ bad: value }),
    subscribe: (listener: () => void) => {
      notify = listener
      return () => {
        notify = () => {}
      }
    },
  }
  const connection = await connectPicodashDevBridge({
    nexus,
    credential: relay.issueBrowserCredential('http://localhost'),
    registrationId: 'malformed',
    disclosure: { valueFields: ['count'], observationNames: ['bad'] },
    // @ts-expect-error Exercise runtime data outside the public JSON source contract.
    observations: source,
  })
  connections.push(connection)
  const client = createPicodashDevBridgeClient(relay.agentCredential)
  const cycle: Record<string, unknown> = {}
  cycle.self = cycle
  for (const bad of [() => {}, cycle, 'x'.repeat(65000), new Date(), Number.NaN]) {
    value = bad
    notify()
    await expect
      .poll(async () => (await client.inspect(connection.session)).snapshot.observations?.bad)
      .toEqual({ status: 'unavailable' })
    expect((await client.inspect(connection.session)).snapshot.values).toEqual({ count: 1 })
  }
  value = { safe: 1 }
  notify()
  await expect
    .poll(async () => (await client.inspect(connection.session)).snapshot.observations?.bad)
    .toEqual({ status: 'available', value: { safe: 1 } })
  await connection.close()
  const narrowed = await connectPicodashDevBridge({
    nexus,
    credential: relay.issueBrowserCredential('http://localhost'),
    registrationId: 'malformed',
    browserTabId: connection.session.browserTabId,
    disclosure: { valueFields: ['count'] },
  })
  connections.push(narrowed)
  expect(narrowed.session.generation).toBe(connection.session.generation + 1)
  expect((await client.inspect(narrowed.session)).snapshot.observations).toBeUndefined()
})

test('broker helper quietly disables without development or a configured broker', async () => {
  const { connectPicodashDevBridgeFromBroker } = await import('../src/browser.js')
  const nexus = createPicodashNexus({ valueOwner: 'nexus', fields: { count: { defaultValue: 1 } } })
  stores.push(nexus)
  const fetchBefore = globalThis.fetch
  let requests = 0
  globalThis.fetch = async () => {
    requests++
    throw new Error('must not fetch')
  }
  try {
    for (const options of [
      { development: false, brokerUrl: 'http://127.0.0.1:1/v1/browser-credential' },
      { development: true },
    ]) {
      const result = await connectPicodashDevBridgeFromBroker({
        ...options,
        nexus,
        registrationId: 'disabled',
      })
      expect(result.status).toBe('disabled')
      await result.close()
    }
    expect(requests).toBe(0)
  } finally {
    globalThis.fetch = fetchBefore
  }
})

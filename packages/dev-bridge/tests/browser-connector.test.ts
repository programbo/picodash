import { afterEach, describe, expect, test } from 'vite-plus/test'
import WebSocket from 'ws'
import { createPicodashStore } from '@picodash/store'
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
  await Promise.all(connections.splice(0).map((connection) => connection.close()))
  await Promise.all(relays.splice(0).map((relay) => relay.close()))
  stores.splice(0).forEach((store) => store.destroy())
  ;(globalThis as unknown as { WebSocket: unknown }).WebSocket = previousWebSocket
})

describe('browser connector', () => {
  test('uses a real public Store, reports structured rejection, and advances snapshots', async () => {
    ;(globalThis as unknown as { WebSocket: unknown }).WebSocket = BrowserWebSocket
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: {
        count: {
          defaultValue: 1,
          validate: (value) => (Number(value) === 3 ? [{ message: 'No threes.' }] : []),
        },
      },
    })
    stores.push(store)
    const relay = await startPicodashDevBridgeRelay({ allowedBrowserOrigins: ['http://localhost'] })
    relays.push(relay)
    const browser = await connectPicodashDevBridge({
      store,
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
    expect(store.getState().values.count).toBe(2)
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
    expect(store.getState().values.count).toBe(2)
  })

  test('advances sequence only when explicitly disclosed Store state changes', async () => {
    ;(globalThis as unknown as { WebSocket: unknown }).WebSocket = BrowserWebSocket
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: {
        count: { defaultValue: 1 },
        secret: { defaultValue: 'hidden' },
      },
    })
    stores.push(store)
    const relay = await startPicodashDevBridgeRelay({ allowedBrowserOrigins: ['http://localhost'] })
    relays.push(relay)
    const browser = await connectPicodashDevBridge({
      store,
      credential: relay.issueBrowserCredential('http://localhost'),
      registrationId: 'disclosed-sequence',
      browserTabId: 'browser-tab',
      disclosure: { valueFields: ['count'], scopeIds: ['visible-scope'] },
    })
    connections.push(browser)
    const client = createPicodashDevBridgeClient(relay.agentCredential)

    expect((await client.inspect(browser.session)).session.sequence).toBe(0)
    store.setValue(store.fields.secret, 'still-hidden')
    store.setDashListRootOrder('hidden-scope', ['item'])
    expect((await client.inspect(browser.session)).session.sequence).toBe(0)
    await expect(
      client.wait(browser.session, {
        type: 'wait',
        requestId: 'hidden-activity',
        timeoutMs: 20,
        condition: { type: 'value_equals', field: 'count', value: 1, afterSequence: 0 },
      }),
    ).resolves.toMatchObject({ type: 'wait_result', outcome: 'timed_out' })

    store.setDashListRootOrder('visible-scope', ['item'])
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
              dashList: {
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
              dashList: {
                rootOrder: [[0, 'item']],
                groupOrders: [],
                collapseOverrides: [],
              },
            },
          },
        ],
      },
    })
    store.setValue(store.fields.count, 2)
    await expect(client.inspect(browser.session)).resolves.toMatchObject({
      session: { sequence: 2 },
      snapshot: { values: { count: 2 } },
    })
  })

  test('reconnects with a new generation and removes subscriptions on close', async () => {
    ;(globalThis as unknown as { WebSocket: unknown }).WebSocket = BrowserWebSocket
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { count: { defaultValue: 1 } },
    })
    stores.push(store)
    const relay = await startPicodashDevBridgeRelay({ allowedBrowserOrigins: ['http://localhost'] })
    relays.push(relay)
    const first = await connectPicodashDevBridge({
      store,
      credential: relay.issueBrowserCredential('http://localhost'),
      registrationId: 'reload',
      browserTabId: 'tab',
      disclosure: { valueFields: ['count'] },
      permissions: { writableFields: ['count'] },
    })
    connections.push(first)
    const second = await connectPicodashDevBridge({
      store,
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

  test('maps plain Store exceptions to a request-bound redacted bridge error', async () => {
    ;(globalThis as unknown as { WebSocket: unknown }).WebSocket = BrowserWebSocket
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { count: { defaultValue: 1 } },
    })
    stores.push(store)
    const throwingStore = new Proxy(store, {
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
      store: throwingStore,
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
      error: { code: 'internal_error', message: 'Store operation failed.' },
    })
    expect(JSON.stringify(result)).not.toContain('secret details')
  })

  test('keeps Store contract errors as structured outcomes and preserves persistence status', async () => {
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
    const store = createPicodashStore({
      valueOwner: 'store',
      storeId: 'dev-bridge-persistence',
      schemaVersion: 1,
      fields: { count: { defaultValue: 1 } },
      persistence: {
        storageKey: 'state',
        driver,
        values: { defaultFieldPolicy: 'include' },
      },
    })
    stores.push(store)
    const relay = await startPicodashDevBridgeRelay({ allowedBrowserOrigins: ['http://localhost'] })
    relays.push(relay)
    const browser = await connectPicodashDevBridge({
      store,
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
    stores.splice(stores.indexOf(store), 1)
    store.destroy({ discardUnpersisted: true })
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

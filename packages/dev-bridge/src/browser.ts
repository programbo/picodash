import { PicodashContractError } from '@picodash/nexus'
import type { CoreTransactionResult, PersistentTransactionResult } from '@picodash/nexus'
import type {
  PicodashDevBridgeConnectOptions,
  PicodashDevBridgeBrowserConnection,
  PicodashDevBridgeCommand,
  PicodashDevBridgeSnapshot,
  PicodashDevBridgeWireFrame,
} from './types.js'
import { PICODASH_DEV_BRIDGE_PROTOCOL_VERSION, PICODASH_DEV_BRIDGE_SUBPROTOCOL } from './types.js'
import { makeSnapshot, snapshotsEqual, validateDisclosure } from './serialization.js'

export async function connectPicodashDevBridge(
  options: PicodashDevBridgeConnectOptions,
): Promise<PicodashDevBridgeBrowserConnection> {
  options.signal?.throwIfAborted()
  const origin =
    typeof globalThis.location?.origin === 'string' ? globalThis.location.origin : undefined
  if (origin !== undefined && options.credential.origin !== origin)
    throw new Error('Credential origin mismatch.')
  const disclosure = validateDisclosure(options.nexus, options.disclosure)
  const writable = [...(options.permissions?.writableFields ?? [])]
  if (writable.some((key) => !disclosure.valueFields.includes(key)))
    throw new Error('Writable fields must be disclosed.')
  let observationSource = options.observations
  const browserTabId = options.browserTabId ?? tabId()
  const socket = new WebSocket(options.credential.webSocketUrl, PICODASH_DEV_BRIDGE_SUBPROTOCOL)
  let descriptor: PicodashDevBridgeBrowserConnection['session'] | undefined
  let snapshot: PicodashDevBridgeSnapshot | undefined
  let sequence = 0
  let eventSequence = 0
  let closed = false
  let settled = false
  const unsubs: Array<() => void> = []
  let resolveRegistration!: (value: PicodashDevBridgeBrowserConnection['session']) => void
  let rejectRegistration!: (reason: Error) => void
  const registration = new Promise<PicodashDevBridgeBrowserConnection['session']>(
    (resolve, reject) => {
      resolveRegistration = resolve
      rejectRegistration = reject
    },
  )
  const timer = setTimeout(() => {
    if (!settled) {
      settled = true
      rejectRegistration(new Error('registration timeout'))
      socket.close()
    }
  }, 1000)
  const sendSnapshot = (
    type: 'snapshot' | 'resync' = 'snapshot',
    forcedSequence = sequence,
    nextSnapshot = makeSnapshot(options.nexus, disclosure, observationSource),
  ) => {
    snapshot = nextSnapshot
    socket.send(
      JSON.stringify({
        type,
        session: {
          sessionId: descriptor!.sessionId,
          generation: descriptor!.generation,
          sequence: forcedSequence,
        },
        sequence: forcedSequence,
        snapshot,
      }),
    )
  }
  const publishSnapshotChange = () => {
    const nextSnapshot = makeSnapshot(options.nexus, disclosure, observationSource)
    if (snapshot && snapshotsEqual(snapshot, nextSnapshot)) return
    if (!descriptor || socket.readyState !== WebSocket.OPEN || closed) return
    sequence += 1
    sendSnapshot('snapshot', sequence, nextSnapshot)
  }
  socket.addEventListener('open', () => {
    if (closed) return
    socket.send(
      JSON.stringify({
        type: 'register',
        protocolVersion: PICODASH_DEV_BRIDGE_PROTOCOL_VERSION,
        token: options.credential.token,
        registration: {
          registrationId: options.registrationId,
          browserTabId,
          ...(options.label === undefined ? {} : { label: options.label }),
          ...(options.buildId === undefined ? {} : { buildId: options.buildId }),
          fieldKeys: disclosure.fieldKeys,
          disclosure: {
            valueFields: disclosure.valueFields,
            scopeIds: disclosure.scopeIds,
            diagnostics: disclosure.diagnostics,
            observationNames: disclosure.observationNames,
            eventScopeIds: disclosure.eventScopeIds,
            eventTypes: disclosure.eventTypes,
          },
          permissions: { writableFields: writable },
        },
      }),
    )
  })
  socket.addEventListener('message', (event) => {
    if (closed) return
    const frame = parse(event.data)
    if (!frame) return
    if (frame.type === 'registered') {
      descriptor = frame.session
      sequence = 0
      settled = true
      clearTimeout(timer)
      resolveRegistration(descriptor)
      // Subscribe before reading, including sources whose subscription calls back synchronously.
      try {
        unsubs.push(options.nexus.subscribe(publishSnapshotChange))
        if (disclosure.diagnostics)
          unsubs.push(options.nexus.diagnostics.subscribe(publishSnapshotChange))
        if (disclosure.observationNames.length && options.observations) {
          try {
            unsubs.push(
              options.observations.subscribe(() =>
                queueMicrotask(() => {
                  if (!closed) publishSnapshotChange()
                }),
              ),
            )
          } catch {
            observationSource = undefined
          }
        }
        sendSnapshot()
      } catch {
        void close()
      }
    } else if (
      frame.type === 'resync_request' &&
      descriptor &&
      frame.generation === descriptor.generation
    ) {
      sequence = frame.nextSequence
      sendSnapshot('resync', sequence)
    } else if (frame.type === 'command' && descriptor) void execute(frame.command)
    else if (frame.type === 'bridge_error' && !descriptor) {
      settled = true
      clearTimeout(timer)
      rejectRegistration(new Error(frame.error.message))
    }
  })
  socket.addEventListener('error', () => {
    if (!settled) {
      settled = true
      clearTimeout(timer)
      rejectRegistration(new Error('connection failed'))
    }
  })
  socket.addEventListener('close', () => {
    void close()
    if (!settled) {
      settled = true
      clearTimeout(timer)
      rejectRegistration(new Error('connection closed'))
    }
    void close()
  })
  const abort = () => {
    if (!settled) {
      settled = true
      clearTimeout(timer)
      rejectRegistration(new DOMException('Connection aborted.', 'AbortError'))
    }
    void close()
  }
  options.signal?.addEventListener('abort', abort, { once: true })
  const session = await registration.catch((error: unknown) => {
    void close()
    throw error
  })
  if (closed) throw new DOMException('Connection aborted.', 'AbortError')
  if (disclosure.eventScopeIds.length && disclosure.eventTypes.length)
    unsubs.push(
      options.nexus.events.subscribe(
        (event) => {
          if (closed || socket.readyState !== WebSocket.OPEN) return
          eventSequence += 1
          const sessionRef = {
            sessionId: session.sessionId,
            generation: session.generation,
            sequence,
          }
          // A stalled transport must disconnect explicitly rather than accumulating history.
          if (socket.bufferedAmount > 1024 * 1024) {
            socket.send(JSON.stringify({ type: 'event_gap', session: sessionRef, eventSequence }))
            socket.close(1013, 'event transport overflow')
            return
          }
          socket.send(
            JSON.stringify({
              type: 'interaction_event',
              session: sessionRef,
              eventSequence,
              event,
            }),
          )
        },
        { scopeIds: disclosure.eventScopeIds, types: disclosure.eventTypes },
      ),
    )
  async function execute(command: PicodashDevBridgeCommand) {
    const beforeSequence = sequence
    let outcome: import('./types.js').PicodashDevBridgeNexusOutcome<
      CoreTransactionResult | PersistentTransactionResult
    >
    if (command.type !== 'set_values') return
    if (Object.keys(command.values).some((key) => !writable.includes(key)))
      outcome = {
        type: 'contract_error',
        code: 'invalid-configuration',
        context: { fieldKey: 'undisclosed' },
      }
    else
      try {
        const result = options.nexus.setValues(command.values)
        outcome = result.ok
          ? { type: 'transaction_result', result }
          : {
              type: 'transaction_result',
              result: { ok: false, issues: result.error.issues } as never,
            }
      } catch (error) {
        if (error instanceof PicodashContractError)
          outcome = { type: 'contract_error', code: error.code, context: error.context }
        else {
          if (!closed && socket.readyState === WebSocket.OPEN)
            socket.send(
              JSON.stringify({
                type: 'bridge_error',
                requestId: command.requestId,
                session: {
                  sessionId: session.sessionId,
                  generation: session.generation,
                  sequence,
                },
                error: { code: 'internal_error', message: 'Nexus operation failed.' },
              }),
            )
          return
        }
      }
    if (!closed && socket.readyState === WebSocket.OPEN)
      socket.send(
        JSON.stringify({
          type: 'command_result',
          requestId: command.requestId,
          session: { sessionId: session.sessionId, generation: session.generation, sequence },
          beforeSequence,
          afterSequence: sequence,
          outcome,
        }),
      )
  }
  async function close() {
    if (closed) return
    closed = true
    options.signal?.removeEventListener('abort', abort)
    unsubs.forEach((unsub) => unsub())
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
      await new Promise<void>((resolve) => {
        socket.addEventListener('close', () => resolve(), { once: true })
        socket.close()
      })
  }
  return { session, close }
}
function parse(value: unknown): PicodashDevBridgeWireFrame | undefined {
  try {
    return JSON.parse(
      typeof value === 'string'
        ? value
        : value instanceof ArrayBuffer
          ? new TextDecoder().decode(value)
          : String(value),
    ) as PicodashDevBridgeWireFrame
  } catch {
    return undefined
  }
}
function tabId() {
  try {
    const key = 'picodash-dev-bridge-tab'
    const existing = globalThis.sessionStorage?.getItem(key)
    if (existing) return existing
    const next = globalThis.crypto?.randomUUID?.() ?? `tab-${Math.random().toString(36).slice(2)}`
    globalThis.sessionStorage?.setItem(key, next)
    return next
  } catch {
    return `tab-${Math.random().toString(36).slice(2)}`
  }
}
export type {
  PicodashDevBridgeObservationSource,
  PicodashDevBridgeObservation,
  PicodashDevBridgeDisclosure,
  PicodashDevBridgePermissions,
  PicodashDevBridgeSnapshot,
  PicodashDevBridgeSnapshotScope,
  PicodashDevBridgeSnapshotDiagnostic,
  PicodashDevBridgeSessionRef,
  PicodashDevBridgeSessionDescriptor,
  PicodashDevBridgeNexusOutcome,
  PicodashDevBridgeSetValuesCommand,
  PicodashDevBridgeWaitCondition,
  PicodashDevBridgeWaitCommand,
  PicodashDevBridgeCommand,
  PicodashDevBridgeCommandResult,
  PicodashDevBridgeWaitResult,
  PicodashDevBridgeEventCursor,
  PicodashDevBridgeReadEventsCommand,
  PicodashDevBridgeEventEntry,
  PicodashDevBridgeEventsResult,
  PicodashDevBridgeErrorCode,
  PicodashDevBridgeError,
  PicodashDevBridgeBrowserCredential,
  PicodashDevBridgeRegistration,
  PicodashDevBridgeWireFrame,
} from './types.js'

export async function connectPicodashDevBridgeFromBroker<
  Fields extends import('@picodash/nexus').PicodashFieldDefinitions,
  Result extends CoreTransactionResult | PersistentTransactionResult = CoreTransactionResult,
>(
  options: Omit<PicodashDevBridgeConnectOptions<Fields, Result>, 'credential'> & {
    readonly brokerUrl?: string
    readonly development: boolean
  },
) {
  if (!options.development || !options.brokerUrl)
    return { status: 'disabled' as const, close: async () => {} }
  options.signal?.throwIfAborted()
  const url = new URL(options.brokerUrl)
  if (
    url.protocol !== 'http:' ||
    url.hostname !== '127.0.0.1' ||
    !url.port ||
    url.pathname !== '/v1/browser-credential' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('Invalid credential broker URL.')
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'omit',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
    signal: options.signal,
  })
  if (!response.ok) throw new Error('Credential broker unavailable.')
  const credential: unknown = await response.json()
  if (
    !credential ||
    typeof credential !== 'object' ||
    !('origin' in credential) ||
    typeof credential.origin !== 'string' ||
    !('token' in credential) ||
    typeof credential.token !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(credential.token) ||
    !('webSocketUrl' in credential) ||
    typeof credential.webSocketUrl !== 'string'
  )
    throw new Error('Invalid browser credential.')
  const websocket = new URL(credential.webSocketUrl)
  if (
    websocket.protocol !== 'ws:' ||
    websocket.hostname !== '127.0.0.1' ||
    !websocket.port ||
    websocket.pathname !== '/v1/browser' ||
    websocket.username ||
    websocket.password ||
    websocket.search ||
    websocket.hash
  )
    throw new Error('Invalid browser credential.')
  const connection = await connectPicodashDevBridge({
    ...options,
    credential: {
      origin: credential.origin,
      token: credential.token,
      webSocketUrl: credential.webSocketUrl,
    },
  })
  return { status: 'connected' as const, ...connection }
}

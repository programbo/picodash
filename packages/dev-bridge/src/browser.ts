import { PicodashContractError } from '@picodash/store'
import type { CoreTransactionResult, PersistentTransactionResult } from '@picodash/store'
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
  const origin =
    typeof globalThis.location?.origin === 'string' ? globalThis.location.origin : undefined
  if (origin !== undefined && options.credential.origin !== origin)
    throw new Error('Credential origin mismatch.')
  const disclosure = validateDisclosure(options.store, options.disclosure)
  const writable = [...(options.permissions?.writableFields ?? [])]
  if (writable.some((key) => !disclosure.valueFields.includes(key)))
    throw new Error('Writable fields must be disclosed.')
  const browserTabId = options.browserTabId ?? tabId()
  const socket = new WebSocket(options.credential.webSocketUrl, PICODASH_DEV_BRIDGE_SUBPROTOCOL)
  let descriptor: PicodashDevBridgeBrowserConnection['session'] | undefined
  let snapshot: PicodashDevBridgeSnapshot | undefined
  let sequence = 0
  let closed = false
  let settled = false
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
    nextSnapshot = makeSnapshot(options.store, disclosure),
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
    const nextSnapshot = makeSnapshot(options.store, disclosure)
    if (snapshot && snapshotsEqual(snapshot, nextSnapshot)) return
    sequence += 1
    sendSnapshot('snapshot', sequence, nextSnapshot)
  }
  socket.addEventListener('open', () =>
    socket.send(
      JSON.stringify({
        type: 'register',
        protocolVersion: PICODASH_DEV_BRIDGE_PROTOCOL_VERSION,
        token: options.credential.token,
        registration: {
          registrationId: options.registrationId,
          browserTabId,
          ...(options.label === undefined ? {} : { label: options.label }),
          fieldKeys: disclosure.fieldKeys,
          disclosure: {
            valueFields: disclosure.valueFields,
            scopeIds: disclosure.scopeIds,
            diagnostics: disclosure.diagnostics,
          },
          permissions: { writableFields: writable },
        },
      }),
    ),
  )
  socket.addEventListener('message', (event) => {
    const frame = parse(event.data)
    if (!frame) return
    if (frame.type === 'registered') {
      descriptor = frame.session
      sequence = 0
      settled = true
      clearTimeout(timer)
      resolveRegistration(descriptor)
      if (!snapshot) sendSnapshot()
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
    if (!settled) {
      settled = true
      clearTimeout(timer)
      rejectRegistration(new Error('connection closed'))
    }
  })
  const session = await registration
  const unsubs = [
    options.store.subscribe(() => {
      if (!closed && socket.readyState === WebSocket.OPEN) {
        publishSnapshotChange()
      }
    }),
  ]
  if (disclosure.diagnostics)
    unsubs.push(
      options.store.diagnostics.subscribe(() => {
        if (!closed && socket.readyState === WebSocket.OPEN) {
          publishSnapshotChange()
        }
      }),
    )
  async function execute(command: PicodashDevBridgeCommand) {
    const beforeSequence = sequence
    let outcome: import('./types.js').PicodashDevBridgeStoreOutcome<
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
        const result = options.store.setValues(command.values)
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
                error: { code: 'internal_error', message: 'Store operation failed.' },
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
  PicodashDevBridgeDisclosure,
  PicodashDevBridgePermissions,
  PicodashDevBridgeSnapshot,
  PicodashDevBridgeSnapshotScope,
  PicodashDevBridgeSnapshotDiagnostic,
  PicodashDevBridgeSessionRef,
  PicodashDevBridgeSessionDescriptor,
  PicodashDevBridgeStoreOutcome,
  PicodashDevBridgeSetValuesCommand,
  PicodashDevBridgeWaitCondition,
  PicodashDevBridgeWaitCommand,
  PicodashDevBridgeCommand,
  PicodashDevBridgeCommandResult,
  PicodashDevBridgeWaitResult,
  PicodashDevBridgeErrorCode,
  PicodashDevBridgeError,
  PicodashDevBridgeBrowserCredential,
  PicodashDevBridgeRegistration,
  PicodashDevBridgeWireFrame,
} from './types.js'

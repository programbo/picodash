import { createHash, randomBytes } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { URL } from 'node:url'
import { WebSocketServer, WebSocket, type RawData } from 'ws'
import { NEXUS_INTERACTION_TYPES } from '@picodash/nexus'
import { EventObservationJournal } from './event-observation.js'
import type {
  PicodashDevBridgeRelay,
  PicodashDevBridgeRelayOptions,
  PicodashDevBridgeRegistration,
  PicodashDevBridgeSessionDescriptor,
  PicodashDevBridgeSnapshot,
  PicodashDevBridgeCommand,
  PicodashDevBridgeCommandResult,
  PicodashDevBridgeWaitCommand,
  PicodashDevBridgeWaitResult,
  PicodashDevBridgeError,
  PicodashDevBridgeErrorCode,
  PicodashDevBridgeReadEventsCommand,
  PicodashDevBridgeEventsResult,
} from './types.js'
import { PICODASH_DEV_BRIDGE_PROTOCOL_VERSION, PICODASH_DEV_BRIDGE_SUBPROTOCOL } from './types.js'

type Pending =
  | {
      kind: 'command'
      resolve: (v: PicodashDevBridgeCommandResult | PicodashDevBridgeError) => void
      timer: ReturnType<typeof setTimeout>
      sequence: number
    }
  | {
      kind: 'wait'
      resolve: (v: PicodashDevBridgeWaitResult | PicodashDevBridgeError) => void
      timer: ReturnType<typeof setTimeout>
      condition: PicodashDevBridgeWaitCommand['condition']
    }
  | {
      kind: 'events'
      resolve: (v: PicodashDevBridgeEventsResult | PicodashDevBridgeError) => void
      timer: ReturnType<typeof setTimeout>
      command: PicodashDevBridgeReadEventsCommand
      cleanup: () => void
    }
type Session = {
  key: string
  id: string
  generation: number
  sequence: number
  descriptor: PicodashDevBridgeSessionDescriptor
  socket: WebSocket
  snapshot?: PicodashDevBridgeSnapshot
  synchronized: boolean
  pending: Map<string, Pending>
  events: EventObservationJournal
}
const token = () => randomBytes(32).toString('base64url')
const MAX_HTTP_BODY_BYTES = 1024 * 1024
const err = (
  code: PicodashDevBridgeErrorCode,
  message: string,
  requestId?: string,
): PicodashDevBridgeError => ({
  type: 'bridge_error',
  error: { code, message },
  ...(requestId === undefined ? {} : { requestId }),
})
const text = (raw: RawData) =>
  typeof raw === 'string'
    ? raw
    : Buffer.isBuffer(raw)
      ? raw.toString('utf8')
      : Buffer.from(raw as ArrayBuffer).toString('utf8')
export async function startPicodashDevBridgeRelay(
  options: PicodashDevBridgeRelayOptions,
): Promise<PicodashDevBridgeRelay> {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Picodash dev bridge is disabled in production.')
  const origins = new Set(options.allowedBrowserOrigins)
  const agentToken = token()
  const credentials = new Map<string, { origin: string }>()
  const active = new Map<string, Session>()
  const tombstones = new Map<string, { id: string; generation: number }>()
  const server = createServer((req, res) => void http(req, res))
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 })
  let closed = false
  server.on('upgrade', (req, socket, head) => {
    const origin = req.headers.origin
    const protocols = String(req.headers['sec-websocket-protocol'] ?? '')
      .split(',')
      .map((x) => x.trim())
    if (
      req.url !== '/v1/browser' ||
      typeof origin !== 'string' ||
      !origins.has(origin) ||
      !protocols.includes(PICODASH_DEV_BRIDGE_SUBPROTOCOL)
    ) {
      socket.destroy()
      return
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
  })
  wss.on('connection', (socket: WebSocket, req: IncomingMessage) => {
    const origin = String(req.headers.origin)
    let first = true
    let accepted: Session | undefined
    const timer = setTimeout(() => {
      if (first) socket.close(1008, 'registration timeout')
    }, 1000)
    socket.on('message', (raw) => {
      if (!first) {
        handleFrame(socket, parse(raw))
        return
      }
      first = false
      clearTimeout(timer)
      const parsed = parse(raw)
      const candidate =
        parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined
      const supplied = typeof candidate?.token === 'string' ? candidate.token : undefined
      if (!supplied || credentials.get(supplied)?.origin !== origin) {
        socket.close(1008, 'unauthorized')
        return
      }
      credentials.delete(supplied)
      const registration = validateRegistration(candidate)
      if (!registration) {
        socket.close(1008, 'invalid registration')
        return
      }
      accepted = accept(socket, origin, registration.registration)
    })
    socket.on('close', () => {
      if (first) clearTimeout(timer)
      else if (accepted) disconnect(accepted, new Error('session_disconnected'))
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(options.port ?? 0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Bridge failed to bind.')
  const baseUrl = `http://127.0.0.1:${address.port}`
  const webSocketUrl = `ws://127.0.0.1:${address.port}/v1/browser`
  const issueBrowserCredential = (origin: string) => {
    if (!origins.has(origin)) throw new Error('Origin is not allowlisted.')
    const value = { webSocketUrl, origin, token: token() }
    credentials.set(value.token, { origin })
    return value
  }
  async function close() {
    if (closed) return
    closed = true
    credentials.clear()
    for (const session of active.values()) disconnect(session, new Error('session_disconnected'))
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await new Promise<void>((resolve) => wss.close(() => resolve()))
  }
  function accept(
    socket: WebSocket,
    origin: string,
    registration: PicodashDevBridgeRegistration['registration'],
  ): Session {
    const key = JSON.stringify([origin, registration.registrationId, registration.browserTabId])
    let old = tombstones.get(key)
    let session = active.get(key)
    if (session) {
      disconnect(session, new Error('generation_mismatch'))
      old = { id: session.id, generation: session.generation }
    }
    const generation = (old?.generation ?? 0) + 1
    const id = old?.id ?? createHash('sha256').update(token()).digest('base64url')
    const descriptor: PicodashDevBridgeSessionDescriptor = {
      sessionId: id,
      generation,
      sequence: 0,
      registrationId: registration.registrationId,
      browserTabId: registration.browserTabId,
      ...(registration.label === undefined ? {} : { label: registration.label }),
      origin,
      fieldKeys: [...registration.fieldKeys],
      disclosedValueFields: [...registration.disclosure.valueFields],
      writableFields: [...registration.permissions.writableFields],
      disclosedScopeIds: [...registration.disclosure.scopeIds],
      diagnosticsDisclosed: registration.disclosure.diagnostics,
      disclosedEventScopeIds: [...(registration.disclosure.eventScopeIds ?? [])],
      disclosedEventTypes: [...(registration.disclosure.eventTypes ?? [])],
      eventSequence: 0,
      capabilities: ['inspect', 'set_values', 'wait', 'read_events'],
    }
    session = {
      key,
      id,
      generation,
      sequence: -1,
      descriptor,
      socket,
      synchronized: false,
      pending: new Map(),
      events: new EventObservationJournal(),
    }
    active.set(key, session)
    tombstones.delete(key)
    socket.send(JSON.stringify({ type: 'registered', session: descriptor }))
    return session
  }
  function disconnect(session: Session, reason: Error) {
    if (active.get(session.key) !== session) return
    active.delete(session.key)
    tombstones.set(session.key, { id: session.id, generation: session.generation })
    while (tombstones.size > 128) tombstones.delete(tombstones.keys().next().value!)
    session.snapshot = undefined
    for (const [id, p] of session.pending) {
      clearTimeout(p.timer)
      if (p.kind === 'events') p.cleanup()
      p.resolve(
        err(
          reason.message === 'generation_mismatch' ? 'generation_mismatch' : 'session_disconnected',
          reason.message,
          id,
        ),
      )
    }
    session.pending.clear()
    session.socket.close()
  }
  function handleFrame(source: WebSocket, frame: unknown) {
    const session = [...active.values()].find((x) => x.socket === source)
    if (!session || !frame || typeof frame !== 'object') return
    const value = frame as Record<string, unknown>
    if (value.type === 'interaction_event' || value.type === 'event_gap') {
      const keys =
        value.type === 'interaction_event'
          ? ['type', 'session', 'eventSequence', 'event']
          : ['type', 'session', 'eventSequence']
      if (
        !exactKeys(value, keys) ||
        !validSessionRef(value.session, session) ||
        !session.synchronized ||
        (value.session as Record<string, unknown>).sequence !== session.sequence ||
        !session.descriptor.disclosedEventScopeIds.length ||
        !session.descriptor.disclosedEventTypes.length ||
        typeof value.eventSequence !== 'number' ||
        !(value.type === 'interaction_event'
          ? session.events.append(value.eventSequence, value.event, session.descriptor)
          : session.events.gap(value.eventSequence))
      ) {
        // Event frames have no retry or mutation authority. Invalid disclosure or ordering ends
        // this generation rather than retaining a misleading partial history.
        disconnect(session, new Error('session_disconnected'))
        return
      }
      session.descriptor = { ...session.descriptor, eventSequence: session.events.sequence }
      evaluateEventWaits(session)
      return
    }
    if (value.type === 'snapshot' || value.type === 'resync') {
      const ref = value.session as Record<string, unknown>
      const sequence = Number(value.sequence)
      const expected = session.sequence + 1
      if (
        ref?.sessionId !== session.id ||
        ref.generation !== session.generation ||
        sequence !== expected ||
        !isDisclosureSnapshot(value.snapshot, session.descriptor)
      ) {
        session.synchronized = false
        source.send(
          JSON.stringify({
            type: 'resync_request',
            sessionId: session.id,
            generation: session.generation,
            nextSequence: expected,
          }),
        )
        return
      }
      session.sequence = sequence
      session.snapshot = value.snapshot as PicodashDevBridgeSnapshot
      session.synchronized = true
      session.descriptor = { ...session.descriptor, sequence }
      evaluateWaits(session)
      return
    }
    if (value.type === 'command_result') {
      const result = value as Record<string, unknown>
      const ref = result.session as Record<string, unknown>
      if (
        ref?.sessionId !== session.id ||
        ref.generation !== session.generation ||
        typeof result.requestId !== 'string'
      )
        return
      const pending = session.pending.get(result.requestId)
      if (!pending || pending.kind !== 'command' || !validCommandResult(result, session, pending))
        return
      session.pending.delete(result.requestId)
      clearTimeout(pending.timer)
      pending.resolve(result as PicodashDevBridgeCommandResult)
      return
    }
    if (value.type === 'bridge_error') {
      const error = value as Record<string, unknown>
      const ref = error.session as Record<string, unknown> | undefined
      const requestId = error.requestId
      if (
        !ref ||
        ref.sessionId !== session.id ||
        ref.generation !== session.generation ||
        typeof requestId !== 'string' ||
        !validBridgeError(error)
      )
        return
      const pending = session.pending.get(requestId)
      if (!pending || pending.kind !== 'command') return
      session.pending.delete(requestId)
      clearTimeout(pending.timer)
      pending.resolve(error as PicodashDevBridgeError)
    }
  }
  function dispatch(
    session: Session,
    command: PicodashDevBridgeCommand,
  ): Promise<PicodashDevBridgeCommandResult | PicodashDevBridgeError> | PicodashDevBridgeError {
    if (!session.socket || !session.synchronized)
      return err('session_unsynchronized', 'Session is unsynchronized.', command.requestId)
    if (session.pending.has(command.requestId))
      return err('request_in_flight', 'Request already in flight.', command.requestId)
    if (
      command.type === 'set_values' &&
      command.values &&
      Object.keys(command.values).some((key) => !session.descriptor.writableFields.includes(key))
    )
      return err('capability_denied', 'Field is not writable.', command.requestId)
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        session.pending.delete(command.requestId)
        resolve(err('command_timed_out', 'Command timed out.', command.requestId))
      }, 5000)
      session.pending.set(command.requestId, {
        kind: 'command',
        resolve,
        timer,
        sequence: session.sequence,
      })
      session.socket.send(
        JSON.stringify({
          type: 'command',
          session: {
            sessionId: session.id,
            generation: session.generation,
            sequence: session.sequence,
          },
          command,
        }),
      )
    })
  }
  function wait(
    session: Session,
    command: PicodashDevBridgeWaitCommand,
    signal?: AbortSignal,
  ): Promise<PicodashDevBridgeWaitResult | PicodashDevBridgeError> {
    if (!session.synchronized || !session.snapshot)
      return Promise.resolve(
        err('session_unsynchronized', 'Session is unsynchronized.', command.requestId),
      )
    if (command.type !== 'wait')
      return Promise.resolve(err('invalid_request', 'Invalid wait.', command.requestId))
    if (session.pending.has(command.requestId))
      return Promise.resolve(
        err('request_in_flight', 'Request already in flight.', command.requestId),
      )
    if (
      command.condition.type === 'value_equals' &&
      !session.descriptor.disclosedValueFields.includes(command.condition.field)
    )
      return Promise.resolve(err('capability_denied', 'Field is not disclosed.', command.requestId))
    const immediate = matches(session, command.condition)
    if (immediate) return Promise.resolve(waitResult(session, command.requestId, 'satisfied'))
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        session.pending.delete(command.requestId)
        resolve(waitResult(session, command.requestId, 'timed_out'))
      }, command.timeoutMs)
      session.pending.set(command.requestId, {
        kind: 'wait',
        resolve,
        timer,
        condition: command.condition,
      })
      const abort = () => {
        if (!session.pending.has(command.requestId)) return
        clearTimeout(timer)
        session.pending.delete(command.requestId)
        resolve(err('session_disconnected', 'Wait aborted.', command.requestId))
      }
      signal?.addEventListener('abort', abort, { once: true })
    })
  }
  function evaluateWaits(session: Session) {
    for (const [id, p] of session.pending) {
      if (p.kind === 'wait' && session.snapshot && matches(session, p.condition)) {
        clearTimeout(p.timer)
        session.pending.delete(id)
        p.resolve(waitResult(session, id, 'satisfied'))
      }
    }
  }
  function matches(session: Session, condition: PicodashDevBridgeWaitCommand['condition']) {
    if (!session.snapshot) return false
    if (condition.type === 'sequence_after') return session.sequence > condition.sequence
    if (condition.afterSequence !== undefined && session.sequence <= condition.afterSequence)
      return false
    return (
      canonicalJson(session.snapshot.values?.[condition.field]) === canonicalJson(condition.value)
    )
  }
  const waitResult = (
    session: Session,
    id: string,
    outcome: 'satisfied' | 'timed_out',
  ): PicodashDevBridgeWaitResult => ({
    type: 'wait_result',
    requestId: id,
    outcome,
    session: { sessionId: session.id, generation: session.generation, sequence: session.sequence },
    snapshot: session.snapshot!,
  })
  function readEvents(
    session: Session,
    command: PicodashDevBridgeReadEventsCommand,
    signal: AbortSignal,
  ): Promise<PicodashDevBridgeEventsResult | PicodashDevBridgeError> {
    if (active.get(session.key) !== session)
      return Promise.resolve(
        err(
          active.has(session.key) ? 'generation_mismatch' : 'session_disconnected',
          'Event session is no longer current.',
          command.requestId,
        ),
      )
    if (
      !session.descriptor.disclosedEventScopeIds.length ||
      !session.descriptor.disclosedEventTypes.length
    )
      return Promise.resolve(
        err('capability_denied', 'Events are not disclosed.', command.requestId),
      )
    if (!session.synchronized)
      return Promise.resolve(
        err('session_unsynchronized', 'Session is unsynchronized.', command.requestId),
      )
    if (session.pending.has(command.requestId))
      return Promise.resolve(
        err('request_in_flight', 'Request already in flight.', command.requestId),
      )
    const cursor = command.cursor
    if (cursor && (cursor.sessionId !== session.id || cursor.generation !== session.generation))
      return Promise.resolve(
        err('generation_mismatch', 'Event cursor is stale.', command.requestId),
      )
    if (cursor && cursor.sequence > session.events.sequence)
      return Promise.resolve(
        err('invalid_request', 'Event cursor is ahead of the session.', command.requestId),
      )
    const immediate = session.events.read(session.descriptor, command)
    if (
      !cursor ||
      immediate.outcome === 'history_gap' ||
      immediate.events.length ||
      !command.timeoutMs
    )
      return Promise.resolve(immediate)
    if ([...session.pending.values()].filter((pending) => pending.kind === 'events').length >= 32)
      return Promise.resolve(
        err('request_in_flight', 'Event wait capacity reached.', command.requestId),
      )
    return new Promise((resolve) => {
      const finish = (result: PicodashDevBridgeEventsResult | PicodashDevBridgeError) => {
        const pending = session.pending.get(command.requestId)
        if (!pending || pending.kind !== 'events') return
        clearTimeout(pending.timer)
        pending.cleanup()
        session.pending.delete(command.requestId)
        resolve(result)
      }
      const abort = () =>
        finish(err('session_disconnected', 'Event wait aborted.', command.requestId))
      const timer = setTimeout(
        () => finish(session.events.read(session.descriptor, command, 'timed_out')),
        command.timeoutMs,
      )
      session.pending.set(command.requestId, {
        kind: 'events',
        resolve,
        timer,
        command,
        cleanup: () => signal.removeEventListener('abort', abort),
      })
      signal.addEventListener('abort', abort, { once: true })
      if (signal.aborted) abort()
    })
  }
  function evaluateEventWaits(session: Session) {
    for (const [id, pending] of session.pending) {
      if (pending.kind !== 'events') continue
      const result = session.events.read(session.descriptor, pending.command)
      if (!result.events.length && result.outcome !== 'history_gap') continue
      clearTimeout(pending.timer)
      pending.cleanup()
      session.pending.delete(id)
      pending.resolve(result)
    }
  }
  async function http(req: IncomingMessage, res: ServerResponse) {
    if (req.headers.authorization !== `Bearer ${agentToken}`) {
      write(res, 401, err('unauthorized', 'Unauthorized.'))
      return
    }
    const url = new URL(req.url ?? '/', baseUrl)
    if (req.method === 'GET' && url.pathname === '/v1/sessions') {
      write(res, 200, { type: 'sessions', sessions: [...active.values()].map((x) => x.descriptor) })
      return
    }
    const m = url.pathname.match(
      /^\/v1\/sessions\/([^/]+)\/generations\/(\d+)\/(snapshot|commands|wait|events)$/,
    )
    if (!m) {
      write(res, 400, err('invalid_request', 'Invalid request.'))
      return
    }
    const session = [...active.values()].find((x) => x.id === decodeURIComponent(m[1]!))
    if (!session) {
      write(res, 404, err('session_not_found', 'Session not found.'))
      return
    }
    if (Number(m[2]) !== session.generation) {
      write(res, 409, err('generation_mismatch', 'Generation is stale.'))
      return
    }
    if (!session.socket) {
      write(res, 409, err('session_disconnected', 'Session is disconnected.'))
      return
    }
    if (m[3] === 'snapshot' && req.method === 'GET') {
      if (!session.synchronized || !session.snapshot) {
        write(res, 409, err('session_unsynchronized', 'Session is unsynchronized.'))
        return
      }
      write(res, 200, { type: 'snapshot', session: session.descriptor, snapshot: session.snapshot })
      return
    }
    const body = await read(req)
    if (m[3] === 'commands' && req.method === 'POST' && isSet(body)) {
      const outcome = await dispatch(session, body)
      write(res, outcome.type === 'bridge_error' ? status(outcome.error.code) : 200, outcome)
    } else if (m[3] === 'wait' && req.method === 'POST' && isWait(body)) {
      const abort = new AbortController()
      res.once('close', () => abort.abort())
      const outcome = await wait(session, body, abort.signal)
      write(res, outcome.type === 'bridge_error' ? status(outcome.error.code) : 200, outcome)
    } else if (m[3] === 'events' && req.method === 'POST' && isReadEvents(body)) {
      const abort = new AbortController()
      res.once('close', () => abort.abort())
      const outcome = await readEvents(session, body, abort.signal)
      write(res, outcome.type === 'bridge_error' ? status(outcome.error.code) : 200, outcome)
    } else write(res, 400, err('invalid_request', 'Invalid request.'))
  }
  return {
    baseUrl,
    webSocketUrl,
    agentCredential: { baseUrl, token: agentToken },
    issueBrowserCredential,
    close,
  }
}
function parse(raw: RawData) {
  try {
    return JSON.parse(text(raw)) as unknown
  } catch {
    return undefined
  }
}
function validateRegistration(
  value: Record<string, unknown> | undefined,
): PicodashDevBridgeRegistration | undefined {
  if (
    !value ||
    value.type !== 'register' ||
    value.protocolVersion !== PICODASH_DEV_BRIDGE_PROTOCOL_VERSION ||
    !value.registration ||
    typeof value.registration !== 'object'
  )
    return
  const r = value.registration as Record<string, unknown>
  if (
    !exactKeys(value, ['type', 'protocolVersion', 'token', 'registration']) ||
    !exactKeys(
      r,
      ['registrationId', 'browserTabId', 'label', 'fieldKeys', 'disclosure', 'permissions'],
      ['label'],
    )
  )
    return
  const strings = (x: unknown, max: number, nonempty = true): x is string =>
    typeof x === 'string' && x.length <= max && (!nonempty || x.length > 0)
  const arr = (x: unknown): x is string[] =>
    Array.isArray(x) && x.every((v) => strings(v, 256)) && new Set(x).size === x.length
  if (
    !strings(r.registrationId, 256) ||
    !strings(r.browserTabId, 256) ||
    !arr(r.fieldKeys) ||
    !r.disclosure ||
    !r.permissions
  )
    return
  const d = r.disclosure as Record<string, unknown>,
    p = r.permissions as Record<string, unknown>
  if (
    !exactKeys(
      d,
      ['valueFields', 'scopeIds', 'diagnostics', 'eventScopeIds', 'eventTypes'],
      ['eventScopeIds', 'eventTypes'],
    ) ||
    !exactKeys(p, ['writableFields'])
  )
    return
  if (
    !arr(d.valueFields) ||
    !arr(d.scopeIds) ||
    (d.eventScopeIds !== undefined && !validEventScopeIds(d.eventScopeIds)) ||
    (d.eventTypes !== undefined &&
      (!arr(d.eventTypes) ||
        !d.eventTypes.every((type: string) =>
          NEXUS_INTERACTION_TYPES.some((expected) => expected === type),
        ))) ||
    typeof d.diagnostics !== 'boolean' ||
    !arr(p.writableFields)
  )
    return
  if (
    (d.valueFields as string[]).some((x) => !(r.fieldKeys as string[]).includes(x)) ||
    (p.writableFields as string[]).some((x) => !(d.valueFields as string[]).includes(x))
  )
    return
  if (r.label !== undefined && !strings(r.label, 512)) return
  return value as unknown as PicodashDevBridgeRegistration
}
function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  optional: readonly string[] = [],
) {
  const allowed = new Set(expected)
  const keys = Object.keys(value)
  return (
    keys.every((key) => allowed.has(key)) &&
    expected.every((key) => optional.includes(key) || Object.hasOwn(value, key))
  )
}

function validEventScopeIds(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= 256 &&
    new Set(value).size === value.length &&
    value.every(
      (id) => typeof id === 'string' && id.length > 0 && id === id.trim() && !hasControl(id),
    )
  )
}
function isDisclosureSnapshot(value: unknown, d: PicodashDevBridgeSessionDescriptor) {
  if (!isRecord(value)) return false
  const v = value
  const expected = [
    ...(d.disclosedValueFields.length ? ['values'] : []),
    ...(d.disclosedScopeIds.length ? ['scopes'] : []),
    ...(d.diagnosticsDisclosed ? ['diagnostics'] : []),
  ]
  if (!exactKeys(v, expected)) return false
  if (expected.includes('values')) {
    const values = v.values
    if (!isRecord(values)) return false
    if (
      Object.keys(values).length !== d.disclosedValueFields.length ||
      d.disclosedValueFields.some((key) => !Object.hasOwn(values, key)) ||
      Object.keys(values).some((k) => !d.disclosedValueFields.includes(k))
    )
      return false
    if (Object.values(values).some((item) => !jsonValue(item))) return false
  }
  if (expected.includes('scopes')) {
    if (
      !Array.isArray(v.scopes) ||
      v.scopes.length !== d.disclosedScopeIds.length ||
      v.scopes.some((scope) => {
        if (!isRecord(scope) || !exactKeys(scope, ['id', 'metadata'], ['metadata'])) return true
        if (typeof scope.id !== 'string' || !d.disclosedScopeIds.includes(scope.id)) return true
        return scope.metadata !== undefined && !jsonValue(scope.metadata)
      })
    )
      return false
    const scopeIds = (v.scopes as unknown[]).map((scope) => (scope as Record<string, unknown>).id)
    if (new Set(scopeIds).size !== scopeIds.length) return false
    if (d.disclosedScopeIds.some((id) => !scopeIds.includes(id))) return false
  }
  if (expected.includes('diagnostics')) {
    if (
      !Array.isArray(v.diagnostics) ||
      v.diagnostics.some(
        (diagnostic) =>
          !isRecord(diagnostic) ||
          !exactKeys(diagnostic, [
            'key',
            'code',
            'severity',
            'message',
            'identity',
            'count',
            'lastOccurrence',
          ]) ||
          typeof diagnostic.key !== 'string' ||
          typeof diagnostic.code !== 'string' ||
          (diagnostic.severity !== 'error' && diagnostic.severity !== 'warning') ||
          typeof diagnostic.message !== 'string' ||
          !isRecord(diagnostic.identity) ||
          Object.values(diagnostic.identity).some((item) => !jsonValue(item)) ||
          !Number.isInteger(diagnostic.count) ||
          !Number.isInteger(diagnostic.lastOccurrence),
      )
    )
      return false
  }
  return true
}
function jsonValue(value: unknown): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(jsonValue)
  if (value && typeof value === 'object') return Object.values(value).every(jsonValue)
  return false
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return JSON.stringify(value)
  if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(value) : 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`
  }
  return 'null'
}
function validCommandResult(
  value: Record<string, unknown>,
  session: Session,
  pending: Extract<Pending, { kind: 'command' }>,
) {
  if (
    !exactKeys(value, [
      'type',
      'requestId',
      'session',
      'beforeSequence',
      'afterSequence',
      'outcome',
    ]) ||
    value.type !== 'command_result' ||
    typeof value.requestId !== 'string' ||
    !validSessionRef(value.session, session) ||
    !Number.isInteger(value.beforeSequence) ||
    !Number.isInteger(value.afterSequence) ||
    value.beforeSequence !== pending.sequence ||
    value.afterSequence !== session.sequence ||
    (value.session as Record<string, unknown>).sequence !== session.sequence ||
    !isRecord(value.outcome)
  )
    return false
  const outcome = value.outcome
  if (!exactKeys(outcome, ['type', 'result']) || outcome.type !== 'transaction_result') {
    if (!exactKeys(outcome, ['type', 'code', 'context']) || outcome.type !== 'contract_error')
      return false
    return (
      typeof outcome.code === 'string' &&
      isRecord(outcome.context) &&
      Object.values(outcome.context).every((item) => typeof item === 'string')
    )
  }
  if (!isRecord(outcome.result)) return false
  const result = outcome.result
  if (result.ok === true) {
    if (
      !exactKeys(result, ['ok', 'changedFields', 'changedScopeIds', 'persistence'], ['persistence'])
    )
      return false
    return (
      Array.isArray(result.changedFields) &&
      result.changedFields.every((item) => typeof item === 'string') &&
      Array.isArray(result.changedScopeIds) &&
      result.changedScopeIds.every((item) => typeof item === 'string') &&
      (result.persistence === undefined ||
        result.persistence === 'unchanged' ||
        result.persistence === 'saved' ||
        result.persistence === 'pending')
    )
  }
  if (result.ok !== false || !exactKeys(result, ['ok', 'issues']) || !Array.isArray(result.issues))
    return false
  return result.issues.every((issue) => jsonValue(issue))
}

function validBridgeError(value: Record<string, unknown>) {
  if (
    !exactKeys(value, ['type', 'requestId', 'session', 'error']) ||
    value.type !== 'bridge_error' ||
    typeof value.requestId !== 'string' ||
    !validSessionRef(value.session) ||
    !isRecord(value.error) ||
    !exactKeys(value.error, ['code', 'message']) ||
    typeof value.error.code !== 'string' ||
    !errorCodes.has(value.error.code as PicodashDevBridgeErrorCode) ||
    typeof value.error.message !== 'string' ||
    value.error.message.length === 0 ||
    value.error.message.length > 256
  )
    return false
  if (value.error.code === 'internal_error' && value.error.message !== 'Nexus operation failed.')
    return false
  return true
}

const errorCodes = new Set<PicodashDevBridgeErrorCode>([
  'invalid_request',
  'unauthorized',
  'capability_denied',
  'session_not_found',
  'generation_mismatch',
  'session_disconnected',
  'session_unsynchronized',
  'request_in_flight',
  'command_timed_out',
  'internal_error',
])

function validSessionRef(value: unknown, session?: Session) {
  if (!isRecord(value) || !exactKeys(value, ['sessionId', 'generation', 'sequence'])) return false
  if (
    typeof value.sessionId !== 'string' ||
    !Number.isSafeInteger(value.generation) ||
    typeof value.generation !== 'number' ||
    value.generation < 1 ||
    !validSequence(value.sequence)
  )
    return false
  return (
    session === undefined ||
    (value.sessionId === session.id && value.generation === session.generation)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
function isSet(v: unknown): v is PicodashDevBridgeCommand {
  return (
    isRecord(v) &&
    exactKeys(v, ['type', 'requestId', 'values']) &&
    v.type === 'set_values' &&
    validRequestId(v.requestId) &&
    isJsonObject(v.values) &&
    Object.values(v.values).every(jsonValue)
  )
}
function isWait(v: unknown): v is PicodashDevBridgeWaitCommand {
  return (
    isRecord(v) &&
    exactKeys(v, ['type', 'requestId', 'timeoutMs', 'condition']) &&
    v.type === 'wait' &&
    validRequestId(v.requestId) &&
    typeof v.timeoutMs === 'number' &&
    Number.isSafeInteger(v.timeoutMs) &&
    v.timeoutMs >= 1 &&
    v.timeoutMs <= 30000 &&
    validWaitCondition(v.condition)
  )
}

function isReadEvents(v: unknown): v is PicodashDevBridgeReadEventsCommand {
  if (
    !isRecord(v) ||
    !exactKeys(
      v,
      ['type', 'requestId', 'cursor', 'limit', 'timeoutMs'],
      ['cursor', 'limit', 'timeoutMs'],
    ) ||
    v.type !== 'read_events' ||
    !validRequestId(v.requestId)
  )
    return false
  if (
    v.cursor !== undefined &&
    (!isRecord(v.cursor) ||
      !exactKeys(v.cursor, ['sessionId', 'generation', 'sequence']) ||
      typeof v.cursor.sessionId !== 'string' ||
      !validRequestId(v.cursor.sessionId) ||
      typeof v.cursor.generation !== 'number' ||
      !Number.isSafeInteger(v.cursor.generation) ||
      v.cursor.generation < 1 ||
      typeof v.cursor.sequence !== 'number' ||
      !Number.isSafeInteger(v.cursor.sequence) ||
      v.cursor.sequence < 0)
  )
    return false
  return (
    (v.limit === undefined ||
      (typeof v.limit === 'number' &&
        Number.isSafeInteger(v.limit) &&
        v.limit >= 1 &&
        v.limit <= 256)) &&
    (v.timeoutMs === undefined ||
      (typeof v.timeoutMs === 'number' &&
        Number.isSafeInteger(v.timeoutMs) &&
        v.timeoutMs >= 0 &&
        v.timeoutMs <= 30000))
  )
}

function validRequestId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 && !hasControl(value)
}

function validWaitCondition(value: unknown): value is PicodashDevBridgeWaitCommand['condition'] {
  if (!isRecord(value) || typeof value.type !== 'string') return false
  if (value.type === 'sequence_after')
    return exactKeys(value, ['type', 'sequence']) && validSequence(value.sequence)
  if (value.type !== 'value_equals') return false
  return (
    exactKeys(value, ['type', 'field', 'value', 'afterSequence'], ['afterSequence']) &&
    typeof value.field === 'string' &&
    value.field.length > 0 &&
    value.field.length <= 256 &&
    !hasControl(value.field) &&
    jsonValue(value.value) &&
    (value.afterSequence === undefined || validSequence(value.afterSequence))
  )
}

function validSequence(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= -1
}

function hasControl(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 31 || (code >= 127 && code <= 159)) return true
  }
  return false
}
function write(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}
function status(code: PicodashDevBridgeErrorCode) {
  if (code === 'unauthorized') return 401
  if (code === 'capability_denied') return 403
  if (code === 'session_not_found') return 404
  if (code === 'command_timed_out') return 504
  if (
    [
      'generation_mismatch',
      'session_disconnected',
      'session_unsynchronized',
      'request_in_flight',
    ].includes(code)
  )
    return 409
  if (code === 'internal_error') return 500
  return 400
}
async function read(req: IncomingMessage) {
  const chunks: Buffer[] = []
  let size = 0
  for await (const value of req) {
    const chunk = Buffer.from(value)
    size += chunk.byteLength
    if (size > MAX_HTTP_BODY_BYTES) {
      chunks.length = 0
      req.destroy()
      return undefined
    }
    chunks.push(chunk)
  }
  const body = Buffer.concat(chunks, size)
  try {
    return JSON.parse(body.toString('utf8'))
  } catch {
    return undefined
  }
}

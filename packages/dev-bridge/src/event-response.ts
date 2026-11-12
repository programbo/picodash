import { normalizeNexusInteractionEvent } from '@picodash/nexus'
import type {
  PicodashDevBridgeError,
  PicodashDevBridgeErrorCode,
  PicodashDevBridgeEventCursor,
  PicodashDevBridgeEventEntry,
  PicodashDevBridgeEventsResult,
  PicodashDevBridgeSessionRef,
} from './types.js'

const errorCodes: readonly PicodashDevBridgeErrorCode[] = [
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
]

/** Parse the read-only event endpoint once at its HTTP response boundary. */
export function parseEventResponse(
  value: unknown,
  requestId: string,
): PicodashDevBridgeEventsResult | PicodashDevBridgeError | undefined {
  if (!record(value)) return undefined
  if (value.type === 'bridge_error') {
    const error = value.error
    if (
      !keys(value, ['type', 'error', 'requestId', 'session'], ['requestId', 'session']) ||
      (value.requestId !== undefined && value.requestId !== requestId) ||
      !record(error) ||
      !keys(error, ['code', 'message']) ||
      typeof error.message !== 'string' ||
      error.message.length === 0 ||
      error.message.length > 256 ||
      !errorCodes.some((code) => code === error.code) ||
      (value.session !== undefined && !sessionRef(value.session))
    )
      return undefined
    const code = errorCodes.find((candidate) => candidate === error.code)
    if (!code) return undefined
    return {
      type: 'bridge_error',
      error: { code, message: error.message },
      ...(value.requestId === undefined ? {} : { requestId }),
      ...(value.session === undefined ? {} : { session: value.session }),
    }
  }
  if (
    value.type !== 'events_result' ||
    !keys(value, [
      'type',
      'requestId',
      'outcome',
      'session',
      'cursor',
      'earliestAvailableSequence',
      'events',
    ]) ||
    value.requestId !== requestId ||
    !sessionRef(value.session) ||
    !eventCursor(value.cursor) ||
    value.session.sessionId !== value.cursor.sessionId ||
    value.session.generation !== value.cursor.generation ||
    (value.outcome !== 'available' &&
      value.outcome !== 'timed_out' &&
      value.outcome !== 'history_gap') ||
    !integer(value.earliestAvailableSequence, 1) ||
    !Array.isArray(value.events) ||
    value.events.length > 256 ||
    (value.outcome !== 'available' && value.events.length !== 0)
  )
    return undefined
  const events: PicodashDevBridgeEventEntry[] = []
  let previous = 0
  try {
    for (const entry of value.events) {
      if (
        !record(entry) ||
        !keys(entry, ['sequence', 'event']) ||
        !integer(entry.sequence, 1) ||
        entry.sequence <= previous ||
        entry.sequence > value.cursor.sequence
      )
        return undefined
      events.push({ sequence: entry.sequence, event: normalizeNexusInteractionEvent(entry.event) })
      previous = entry.sequence
    }
  } catch {
    return undefined
  }
  return {
    type: 'events_result',
    requestId,
    outcome: value.outcome,
    session: value.session,
    cursor: value.cursor,
    earliestAvailableSequence: value.earliestAvailableSequence,
    events,
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function keys(
  value: Record<string, unknown>,
  expected: readonly string[],
  optional: readonly string[] = [],
): boolean {
  return (
    Object.keys(value).every((key) => expected.includes(key)) &&
    expected.every((key) => optional.includes(key) || Object.hasOwn(value, key))
  )
}
function integer(value: unknown, minimum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum
}
function eventCursor(value: unknown): value is PicodashDevBridgeEventCursor {
  return (
    record(value) &&
    keys(value, ['sessionId', 'generation', 'sequence']) &&
    typeof value.sessionId === 'string' &&
    value.sessionId.length > 0 &&
    value.sessionId.length <= 256 &&
    integer(value.generation, 1) &&
    integer(value.sequence, 0)
  )
}
function sessionRef(value: unknown): value is PicodashDevBridgeSessionRef {
  return (
    record(value) &&
    keys(value, ['sessionId', 'generation', 'sequence']) &&
    typeof value.sessionId === 'string' &&
    value.sessionId.length > 0 &&
    value.sessionId.length <= 256 &&
    integer(value.generation, 1) &&
    integer(value.sequence, -1)
  )
}

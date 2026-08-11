#!/usr/bin/env node
import { randomUUID } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { stdin, stdout, stderr } from 'node:process'
import { fileURLToPath } from 'node:url'
import type { PicodashJsonValue } from '@picodash/nexus'
import { createPicodashDevBridgeClient } from './client.js'
import type { PicodashDevBridgeClient } from './client.js'
import type {
  PicodashDevBridgeCommandResult,
  PicodashDevBridgeError,
  PicodashDevBridgeSessionDescriptor,
  PicodashDevBridgeSessionRef,
  PicodashDevBridgeWaitCondition,
  PicodashDevBridgeSnapshot,
  PicodashDevBridgeWaitResult,
} from './types.js'

const MAX_STDIN_BYTES = 1_000_000
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/
const BRIDGE_ERROR_CODES = new Set([
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
const LOCAL_ERRORS = {
  usage_error: 'Invalid command line.',
  configuration_error: 'Bridge credentials are invalid.',
  input_error: 'Invalid input.',
  transport_error: 'Bridge request failed.',
  protocol_error: 'Bridge returned an invalid response.',
  aborted: 'Operation aborted.',
  internal_error: 'Internal error.',
} as const

type LocalErrorCode = keyof typeof LOCAL_ERRORS
type CommandName = 'sessions' | 'inspect' | 'set-values' | 'wait'
type Parsed =
  | { command: 'sessions' }
  | { command: Exclude<CommandName, 'sessions'>; sessionId: string; generation: number }

class CliFailure extends Error {
  constructor(
    readonly code: LocalErrorCode,
    readonly exitCode: 2 | 3 | 130,
  ) {
    super(LOCAL_ERRORS[code])
  }
}

export async function runPicodashDevBridgeCli(argv = process.argv.slice(2)): Promise<number> {
  let parsed: Parsed
  try {
    parsed = parseArgs(argv)
  } catch (error) {
    return reportLocal(error instanceof CliFailure ? error : new CliFailure('usage_error', 2))
  }
  let credentials: { baseUrl: string; token: string }
  try {
    credentials = readCredentials()
  } catch (error) {
    return reportLocal(
      error instanceof CliFailure ? error : new CliFailure('configuration_error', 2),
    )
  }
  let client: PicodashDevBridgeClient
  let activeRequestId: string | undefined
  try {
    client = createPicodashDevBridgeClient(credentials)
  } catch {
    return reportLocal(new CliFailure('internal_error', 3))
  }
  try {
    if (parsed.command === 'sessions') {
      const sessions = await client.listSessions()
      if (!Array.isArray(sessions) || !sessions.every(isSessionDescriptor))
        throw new CliFailure('protocol_error', 3)
      writeStdout({ type: 'sessions', sessions: sortSessions(sessions) })
      return 0
    }
    if (parsed.command === 'inspect') {
      const session = await resolveSession(client, parsed.sessionId, parsed.generation)
      const result = await client.inspect(session)
      if (!isSnapshotResponse(result)) throw new CliFailure('protocol_error', 3)
      writeStdout(result)
      return 0
    }
    if (parsed.command === 'set-values') {
      const input = await readInput('set-values')
      const requestId = `cli-${randomUUID().toLowerCase()}`
      activeRequestId = requestId
      const session = await resolveSession(client, parsed.sessionId, parsed.generation, requestId)
      const result = await client.setValues(session, {
        type: 'set_values',
        requestId,
        values: input.values as Record<string, PicodashJsonValue>,
      })
      if (!isCommandResponse(result, requestId)) throw new CliFailure('protocol_error', 3)
      writeStdout(result)
      return result.type === 'bridge_error'
        ? 4
        : result.outcome.type === 'contract_error' || result.outcome.result.ok === false
          ? 5
          : 0
    }
    const input = await readInput('wait')
    const requestId = `cli-${randomUUID().toLowerCase()}`
    activeRequestId = requestId
    const session = await resolveSession(client, parsed.sessionId, parsed.generation, requestId)
    const abort = new AbortController()
    const onInterrupt = () => abort.abort()
    process.once('SIGINT', onInterrupt)
    try {
      const result = await client.wait(
        session,
        {
          type: 'wait',
          requestId,
          timeoutMs: input.timeoutMs,
          condition: input.condition as PicodashDevBridgeWaitCondition,
        },
        { signal: abort.signal },
      )
      if (!isWaitResponse(result, requestId)) throw new CliFailure('protocol_error', 3)
      writeStdout(result)
      return result.type === 'bridge_error' ? 4 : result.outcome === 'timed_out' ? 6 : 0
    } finally {
      process.off('SIGINT', onInterrupt)
    }
  } catch (error) {
    if (isBridgeError(error)) {
      if (error.error.code === 'internal_error' && error.error.message === 'Bridge request failed.')
        return reportLocal(new CliFailure('protocol_error', 3), activeRequestId)
      writeStdout(error)
      return 4
    }
    if (isPlainObject(error) && error.type === 'bridge_error')
      return reportLocal(new CliFailure('protocol_error', 3), activeRequestId)
    if (error instanceof CliFailure) return reportLocal(error, activeRequestId)
    if (isAbortError(error)) return reportLocal(new CliFailure('aborted', 130), activeRequestId)
    if (error instanceof SyntaxError)
      return reportLocal(new CliFailure('protocol_error', 3), activeRequestId)
    return reportLocal(new CliFailure('transport_error', 3), activeRequestId)
  }
}

function parseArgs(argv: readonly string[]): Parsed {
  if (argv.length === 1 && argv[0] === 'sessions') return { command: 'sessions' }
  const command = argv[0]
  if (command !== 'inspect' && command !== 'set-values' && command !== 'wait')
    throw new CliFailure('usage_error', 2)
  if (argv.length !== 5) throw new CliFailure('usage_error', 2)
  const values = new Map<string, string>()
  for (let index = 1; index < argv.length; index += 2) {
    const flag = argv[index]
    const value = argv[index + 1]
    if ((flag !== '--session-id' && flag !== '--generation') || value === undefined)
      throw new CliFailure('usage_error', 2)
    if (values.has(flag)) throw new CliFailure('usage_error', 2)
    values.set(flag, value)
  }
  if (!values.has('--session-id') || !values.has('--generation'))
    throw new CliFailure('usage_error', 2)
  const sessionId = values.get('--session-id')!
  const generationValue = values.get('--generation')!
  if (!sessionId || !/^\d+$/.test(generationValue)) throw new CliFailure('usage_error', 2)
  const generation = Number(generationValue)
  if (!Number.isSafeInteger(generation) || generation < 1) throw new CliFailure('usage_error', 2)
  return { command, sessionId, generation }
}

function readCredentials() {
  const baseUrl = process.env.PICODASH_DEV_BRIDGE_URL
  const token = process.env.PICODASH_DEV_BRIDGE_TOKEN
  if (typeof baseUrl !== 'string' || typeof token !== 'string')
    throw new CliFailure('configuration_error', 2)
  let parsed: URL
  try {
    parsed = new URL(baseUrl)
  } catch {
    throw new CliFailure('configuration_error', 2)
  }
  if (
    parsed.protocol !== 'http:' ||
    parsed.hostname !== '127.0.0.1' ||
    parsed.pathname !== '/' ||
    parsed.search !== '' ||
    parsed.hash !== '' ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    !/^http:\/\/127\.0\.0\.1:\d+$/.test(baseUrl)
  )
    throw new CliFailure('configuration_error', 2)
  const port = Number(baseUrl.slice(baseUrl.lastIndexOf(':') + 1))
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !TOKEN_PATTERN.test(token))
    throw new CliFailure('configuration_error', 2)
  return { baseUrl, token }
}

async function resolveSession(
  client: PicodashDevBridgeClient,
  sessionId: string,
  generation: number,
  requestId?: string,
) {
  const sessions = await client.listSessions()
  if (!Array.isArray(sessions) || !sessions.every(isSessionDescriptor))
    throw new CliFailure('protocol_error', 3)
  const current = sessions.find((session) => session.sessionId === sessionId)
  if (!current) throw bridgeError('session_not_found', 'Session not found.', requestId)
  if (current.generation !== generation)
    throw bridgeError('generation_mismatch', 'Generation is stale.', requestId)
  return {
    sessionId: current.sessionId,
    generation: current.generation,
    sequence: current.sequence,
  } satisfies PicodashDevBridgeSessionRef
}

function readInput(command: 'set-values'): Promise<{ values: Record<string, unknown> }>
function readInput(command: 'wait'): Promise<{
  timeoutMs: number
  condition: Record<string, unknown>
}>
async function readInput(
  command: 'set-values' | 'wait',
): Promise<
  { values: Record<string, unknown> } | { timeoutMs: number; condition: Record<string, unknown> }
> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of stdin) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += value.byteLength
    if (size > MAX_STDIN_BYTES) throw new CliFailure('input_error', 2)
    chunks.push(value)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new CliFailure('input_error', 2)
  }
  if (!isPlainObject(parsed)) throw new CliFailure('input_error', 2)
  if (command === 'set-values') {
    if (
      !exactKeys(parsed, ['values']) ||
      !isPlainObject(parsed.values) ||
      !jsonValueObject(parsed.values)
    )
      throw new CliFailure('input_error', 2)
    return { values: parsed.values }
  }
  if (
    !exactKeys(parsed, ['timeoutMs', 'condition']) ||
    typeof parsed.timeoutMs !== 'number' ||
    !Number.isSafeInteger(parsed.timeoutMs) ||
    parsed.timeoutMs < 1 ||
    parsed.timeoutMs > 30000 ||
    !validCondition(parsed.condition)
  )
    throw new CliFailure('input_error', 2)
  return { timeoutMs: parsed.timeoutMs, condition: parsed.condition }
}

function validCondition(value: unknown): value is Record<string, any> {
  if (!isPlainObject(value) || typeof value.type !== 'string') return false
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

function validSequence(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= -1
}

function jsonValue(value: unknown): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(jsonValue)
  return isPlainObject(value) && Object.values(value).every(jsonValue)
}

function jsonValueObject(value: Record<string, unknown>) {
  return Object.values(value).every(jsonValue)
}

function isPlainObject(value: unknown): value is Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function exactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
) {
  const keys = Object.keys(value)
  return (
    keys.every((key) => required.includes(key) || optional.includes(key)) &&
    required.every((key) => optional.includes(key) || Object.hasOwn(value, key))
  )
}

function hasControl(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 31 || (code >= 127 && code <= 159)) return true
  }
  return false
}

function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('unsupported output value')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (isPlainObject(value))
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`
  throw new Error('unsupported output value')
}

function sortSessions(sessions: readonly PicodashDevBridgeSessionDescriptor[]) {
  return [...sessions].sort((left, right) => {
    const leftFields = [left.origin, left.registrationId, left.browserTabId, left.sessionId]
    const rightFields = [right.origin, right.registrationId, right.browserTabId, right.sessionId]
    for (let index = 0; index < leftFields.length; index += 1) {
      if (leftFields[index] === rightFields[index]) continue
      return leftFields[index]! < rightFields[index]! ? -1 : 1
    }
    return left.generation === right.generation ? 0 : left.generation < right.generation ? -1 : 1
  })
}

function writeStdout(value: unknown) {
  stdout.write(`${canonical(value)}\n`)
}

function reportLocal(error: CliFailure, requestId?: string) {
  stderr.write(
    `${canonical({
      type: 'cli_error',
      error: { code: error.code, message: error.message },
      ...(requestId === undefined ? {} : { requestId }),
    })}\n`,
  )
  return error.exitCode
}

function bridgeError(
  code: PicodashDevBridgeError['error']['code'],
  message: string,
  requestId?: string,
): PicodashDevBridgeError {
  return {
    type: 'bridge_error',
    error: { code, message },
    ...(requestId === undefined ? {} : { requestId }),
  }
}

function isBridgeError(value: unknown): value is PicodashDevBridgeError {
  return (
    isPlainObject(value) &&
    exactKeys(value, ['type', 'error', 'requestId', 'session'], ['requestId', 'session']) &&
    value.type === 'bridge_error' &&
    isPlainObject(value.error) &&
    exactKeys(value.error, ['code', 'message']) &&
    typeof value.error.code === 'string' &&
    BRIDGE_ERROR_CODES.has(value.error.code) &&
    typeof value.error.message === 'string' &&
    (value.requestId === undefined || typeof value.requestId === 'string') &&
    (value.session === undefined || isSessionRef(value.session))
  )
}

function isSnapshotResponse(
  value: unknown,
): value is { type: 'snapshot'; session: unknown; snapshot: PicodashDevBridgeSnapshot } {
  return (
    isPlainObject(value) &&
    exactKeys(value, ['type', 'session', 'snapshot']) &&
    value.type === 'snapshot' &&
    isSessionDescriptor(value.session) &&
    isSnapshot(value.snapshot)
  )
}

function isCommandResponse(
  value: unknown,
  requestId: string,
): value is PicodashDevBridgeCommandResult | PicodashDevBridgeError {
  return (
    (isBridgeError(value) && (value.requestId === undefined || value.requestId === requestId)) ||
    (isPlainObject(value) &&
      exactKeys(value, [
        'type',
        'requestId',
        'session',
        'beforeSequence',
        'afterSequence',
        'outcome',
      ]) &&
      value.type === 'command_result' &&
      value.requestId === requestId &&
      typeof value.requestId === 'string' &&
      isSessionRef(value.session) &&
      Number.isSafeInteger(value.beforeSequence) &&
      Number.isSafeInteger(value.afterSequence) &&
      isCommandOutcome(value.outcome))
  )
}

function isWaitResponse(
  value: unknown,
  requestId: string,
): value is PicodashDevBridgeWaitResult | PicodashDevBridgeError {
  return (
    (isBridgeError(value) && (value.requestId === undefined || value.requestId === requestId)) ||
    (isPlainObject(value) &&
      exactKeys(value, ['type', 'requestId', 'outcome', 'session', 'snapshot']) &&
      value.type === 'wait_result' &&
      value.requestId === requestId &&
      typeof value.requestId === 'string' &&
      (value.outcome === 'satisfied' || value.outcome === 'timed_out') &&
      isSessionRef(value.session) &&
      isSnapshot(value.snapshot))
  )
}

function isSessionDescriptor(value: unknown): value is PicodashDevBridgeSessionDescriptor {
  return (
    isPlainObject(value) &&
    exactKeys(
      value,
      [
        'sessionId',
        'generation',
        'sequence',
        'registrationId',
        'browserTabId',
        'label',
        'origin',
        'fieldKeys',
        'disclosedValueFields',
        'writableFields',
        'disclosedScopeIds',
        'diagnosticsDisclosed',
        'capabilities',
      ],
      ['label'],
    ) &&
    typeof value.sessionId === 'string' &&
    Number.isSafeInteger(value.generation) &&
    value.generation >= 1 &&
    Number.isSafeInteger(value.sequence) &&
    typeof value.registrationId === 'string' &&
    typeof value.browserTabId === 'string' &&
    typeof value.origin === 'string' &&
    (value.label === undefined || typeof value.label === 'string') &&
    stringArray(value.fieldKeys) &&
    stringArray(value.disclosedValueFields) &&
    stringArray(value.writableFields) &&
    stringArray(value.disclosedScopeIds) &&
    typeof value.diagnosticsDisclosed === 'boolean' &&
    Array.isArray(value.capabilities) &&
    value.capabilities.length === 3 &&
    value.capabilities[0] === 'inspect' &&
    value.capabilities[1] === 'set_values' &&
    value.capabilities[2] === 'wait'
  )
}

function stringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isSessionRef(value: unknown): value is PicodashDevBridgeSessionRef {
  return (
    isPlainObject(value) &&
    exactKeys(value, ['sessionId', 'generation', 'sequence']) &&
    typeof value.sessionId === 'string' &&
    Number.isSafeInteger(value.generation) &&
    value.generation >= 1 &&
    Number.isSafeInteger(value.sequence) &&
    value.sequence >= -1
  )
}

function isSnapshot(value: unknown): value is PicodashDevBridgeSnapshot {
  if (!isPlainObject(value)) return false
  if (!exactKeys(value, ['values', 'scopes', 'diagnostics'], ['values', 'scopes', 'diagnostics']))
    return false
  if (
    value.values !== undefined &&
    (!isPlainObject(value.values) || !jsonValueObject(value.values))
  )
    return false
  if (
    value.scopes !== undefined &&
    (!Array.isArray(value.scopes) ||
      value.scopes.some(
        (scope) =>
          !isPlainObject(scope) ||
          !exactKeys(scope, ['id', 'metadata'], ['metadata']) ||
          typeof scope.id !== 'string' ||
          (scope.metadata !== undefined && !jsonValue(scope.metadata)),
      ))
  )
    return false
  if (
    value.diagnostics !== undefined &&
    (!Array.isArray(value.diagnostics) ||
      value.diagnostics.some(
        (diagnostic) =>
          !isPlainObject(diagnostic) ||
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
          !isPlainObject(diagnostic.identity) ||
          !jsonValueObject(diagnostic.identity) ||
          !Number.isSafeInteger(diagnostic.count) ||
          !Number.isSafeInteger(diagnostic.lastOccurrence),
      ))
  )
    return false
  return true
}

function isCommandOutcome(value: unknown): boolean {
  if (!isPlainObject(value)) return false
  if (value.type === 'contract_error')
    return (
      exactKeys(value, ['type', 'code', 'context']) &&
      typeof value.code === 'string' &&
      isPlainObject(value.context) &&
      Object.values(value.context).every((item) => typeof item === 'string')
    )
  if (value.type !== 'transaction_result' || !exactKeys(value, ['type', 'result'])) return false
  if (!isPlainObject(value.result)) return false
  const result = value.result
  if (result.ok === true)
    return (
      exactKeys(
        result,
        ['ok', 'changedFields', 'changedScopeIds', 'persistence'],
        ['persistence'],
      ) &&
      stringArray(result.changedFields) &&
      stringArray(result.changedScopeIds) &&
      (result.persistence === undefined ||
        result.persistence === 'unchanged' ||
        result.persistence === 'saved' ||
        result.persistence === 'pending')
    )
  return (
    result.ok === false &&
    exactKeys(result, ['ok', 'issues']) &&
    Array.isArray(result.issues) &&
    result.issues.every(jsonValue)
  )
}

function isAbortError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.message === 'This operation was aborted')
  )
}

const entryPath = process.argv[1]
const isDirectEntry =
  entryPath !== undefined &&
  (() => {
    try {
      return realpathSync(entryPath) === realpathSync(fileURLToPath(import.meta.url))
    } catch {
      return false
    }
  })()
if (isDirectEntry) void runPicodashDevBridgeCli().then((code) => (process.exitCode = code))

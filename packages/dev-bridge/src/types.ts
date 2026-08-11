import type {
  CoreTransactionResult,
  PersistentTransactionResult,
  PicodashDiagnostic,
  PicodashJsonValue,
  RootNexus,
  PicodashFieldDefinitions,
  TransactionIssue,
} from '@picodash/nexus'

export const PICODASH_DEV_BRIDGE_PROTOCOL_VERSION = 2 as const
export const PICODASH_DEV_BRIDGE_SUBPROTOCOL = 'picodash.dev-bridge.v2' as const
export type PicodashDevBridgeDisclosure = Readonly<{
  valueFields: readonly string[]
  scopeIds: readonly string[]
  diagnostics: boolean
}>
export type PicodashDevBridgePermissions = Readonly<{ writableFields: readonly string[] }>
export type PicodashDevBridgeSnapshotScope = Readonly<{ id: string; metadata?: PicodashJsonValue }>
export type PicodashDevBridgeSnapshotDiagnostic = Readonly<{
  key: string
  code: string
  severity: 'error' | 'warning'
  message: string
  identity: Readonly<Record<string, PicodashJsonValue>>
  count: number
  lastOccurrence: number
}>
export type PicodashDevBridgeSnapshot = Readonly<{
  values?: Readonly<Record<string, PicodashJsonValue>>
  scopes?: readonly PicodashDevBridgeSnapshotScope[]
  diagnostics?: readonly PicodashDevBridgeSnapshotDiagnostic[]
}>
export type PicodashDevBridgeSessionRef = Readonly<{
  sessionId: string
  generation: number
  sequence: number
}>
export type PicodashDevBridgeSessionDescriptor = PicodashDevBridgeSessionRef &
  Readonly<{
    registrationId: string
    browserTabId: string
    label?: string
    origin: string
    fieldKeys: readonly string[]
    disclosedValueFields: readonly string[]
    writableFields: readonly string[]
    disclosedScopeIds: readonly string[]
    diagnosticsDisclosed: boolean
    capabilities: readonly ['inspect', 'set_values', 'wait']
  }>
export type PicodashDevBridgeNexusOutcome<
  Result extends CoreTransactionResult | PersistentTransactionResult =
    | CoreTransactionResult
    | PersistentTransactionResult,
> =
  | Readonly<{ type: 'transaction_result'; result: Extract<Result, { ok: true }> }>
  | Readonly<{
      type: 'transaction_result'
      result: Extract<Result, { ok: false }> extends { error: infer E }
        ? { ok: false; issues: E extends { issues: infer I } ? I : readonly TransactionIssue[] }
        : { ok: false; issues: readonly TransactionIssue[] }
    }>
  | Readonly<{ type: 'contract_error'; code: string; context: Readonly<Record<string, string>> }>
export type PicodashDevBridgeSetValuesCommand = Readonly<{
  type: 'set_values'
  requestId: string
  values: Readonly<Record<string, PicodashJsonValue>>
}>
export type PicodashDevBridgeWaitCondition =
  | Readonly<{ type: 'sequence_after'; sequence: number }>
  | Readonly<{
      type: 'value_equals'
      field: string
      value: PicodashJsonValue
      afterSequence?: number
    }>
export type PicodashDevBridgeWaitCommand = Readonly<{
  type: 'wait'
  requestId: string
  timeoutMs: number
  condition: PicodashDevBridgeWaitCondition
}>
export type PicodashDevBridgeCommand =
  | PicodashDevBridgeSetValuesCommand
  | PicodashDevBridgeWaitCommand
export type PicodashDevBridgeCommandResult<
  Result extends CoreTransactionResult | PersistentTransactionResult =
    | CoreTransactionResult
    | PersistentTransactionResult,
> = Readonly<{
  type: 'command_result'
  requestId: string
  session: PicodashDevBridgeSessionRef
  beforeSequence: number
  afterSequence: number
  outcome: PicodashDevBridgeNexusOutcome<Result>
}>
export type PicodashDevBridgeWaitResult = Readonly<{
  type: 'wait_result'
  requestId: string
  outcome: 'satisfied' | 'timed_out'
  session: PicodashDevBridgeSessionRef
  snapshot: PicodashDevBridgeSnapshot
}>
export type PicodashDevBridgeErrorCode =
  | 'invalid_request'
  | 'unauthorized'
  | 'capability_denied'
  | 'session_not_found'
  | 'generation_mismatch'
  | 'session_disconnected'
  | 'session_unsynchronized'
  | 'request_in_flight'
  | 'command_timed_out'
  | 'internal_error'
export type PicodashDevBridgeError = Readonly<{
  type: 'bridge_error'
  error: Readonly<{ code: PicodashDevBridgeErrorCode; message: string }>
  requestId?: string
  session?: PicodashDevBridgeSessionRef
}>
export type PicodashDevBridgeClientCredential = Readonly<{ baseUrl: string; token: string }>
export type PicodashDevBridgeBrowserCredential = Readonly<{
  webSocketUrl: string
  origin: string
  token: string
}>
export type PicodashDevBridgeRelay = Readonly<{
  baseUrl: string
  webSocketUrl: string
  agentCredential: PicodashDevBridgeClientCredential
  issueBrowserCredential(origin: string): PicodashDevBridgeBrowserCredential
  close(): Promise<void>
}>
export type PicodashDevBridgeRelayOptions = Readonly<{
  allowedBrowserOrigins: readonly string[]
  port?: number
}>
export type PicodashDevBridgeConnectOptions<
  Fields extends PicodashFieldDefinitions = PicodashFieldDefinitions,
  Result extends CoreTransactionResult | PersistentTransactionResult = CoreTransactionResult,
> = Readonly<{
  nexus: RootNexus<Fields, Result>
  credential: PicodashDevBridgeBrowserCredential
  registrationId: string
  label?: string
  disclosure?: Partial<PicodashDevBridgeDisclosure>
  permissions?: Partial<PicodashDevBridgePermissions>
  browserTabId?: string
}>
export type PicodashDevBridgeBrowserConnection = Readonly<{
  session: PicodashDevBridgeSessionDescriptor
  close(): Promise<void>
}>
export type PicodashDevBridgeRegistration = Readonly<{
  type: 'register'
  protocolVersion: 2
  token: string
  registration: {
    registrationId: string
    browserTabId: string
    label?: string
    fieldKeys: readonly string[]
    disclosure: PicodashDevBridgeDisclosure
    permissions: PicodashDevBridgePermissions
  }
}>
export type PicodashDevBridgeWireFrame =
  | PicodashDevBridgeRegistration
  | Readonly<{ type: 'registered'; session: PicodashDevBridgeSessionDescriptor }>
  | Readonly<{
      type: 'snapshot' | 'resync'
      session: PicodashDevBridgeSessionRef
      sequence: number
      snapshot: PicodashDevBridgeSnapshot
    }>
  | Readonly<{
      type: 'command'
      session: PicodashDevBridgeSessionRef
      command: PicodashDevBridgeCommand
    }>
  | PicodashDevBridgeCommandResult
  | Readonly<{
      type: 'resync_request'
      sessionId: string
      generation: number
      nextSequence: number
    }>
  | PicodashDevBridgeError
export type NexusLike = {
  readonly fields: Record<string, unknown>
  getState(): Readonly<{
    values: Readonly<Record<string, PicodashJsonValue>>
    scopes: ReadonlyMap<string, unknown>
  }>
  subscribe(listener: () => void): () => void
  readonly diagnostics: {
    getState(): Readonly<{ current: ReadonlyMap<string, PicodashDiagnostic> }>
    subscribe(listener: () => void): () => void
  }
  setValues(
    values: Record<string, PicodashJsonValue>,
  ): CoreTransactionResult | PersistentTransactionResult
  scope(scopeId: string): { getState(): Readonly<{ scope?: unknown }> }
}

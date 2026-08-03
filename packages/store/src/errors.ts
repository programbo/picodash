export const PICODASH_DIAGNOSTICS_VERSION = 'v1' as const

export const PICODASH_ERROR_CODES = {
  ASYNC_CONTRACT: 'PICODASH_ASYNC_CONTRACT',
  ATOMIC_WRITE_FAILED: 'PICODASH_ATOMIC_WRITE_FAILED',
  CONFLICTING_BINDING: 'PICODASH_CONFLICTING_BINDING',
  DISMISSIBLE_WITHOUT_TRIGGER: 'PICODASH_DISMISSIBLE_WITHOUT_TRIGGER',
  DUPLICATE_BINDING: 'PICODASH_DUPLICATE_BINDING',
  DUPLICATE_ITEM_ID: 'PICODASH_DUPLICATE_ITEM_ID',
  DUPLICATE_PANEL_ID: 'PICODASH_DUPLICATE_PANEL_ID',
  INCOMPATIBLE_FIELD_DASHLET: 'PICODASH_INCOMPATIBLE_FIELD_DASHLET',
  INVALID_ADAPTER_SNAPSHOT: 'PICODASH_INVALID_ADAPTER_SNAPSHOT',
  INVALID_COMPOUND_MAP: 'PICODASH_INVALID_COMPOUND_MAP',
  INVALID_CONTRACT: 'PICODASH_INVALID_CONTRACT',
  INVALID_IMPORT: 'PICODASH_INVALID_IMPORT',
  MISSING_ACCESSIBLE_LABEL: 'PICODASH_MISSING_ACCESSIBLE_LABEL',
  MISSING_PROVIDER: 'PICODASH_MISSING_PROVIDER',
  MISSING_STYLESHEET: 'PICODASH_MISSING_STYLESHEET',
  NON_SYNCHRONOUS_WRITE: 'PICODASH_NON_SYNCHRONOUS_WRITE',
  REJECTED_WRITE: 'PICODASH_REJECTED_WRITE',
} as const

export type PicodashErrorCode = (typeof PICODASH_ERROR_CODES)[keyof typeof PICODASH_ERROR_CODES]

export type PicodashDiagnosticSeverity = 'error' | 'warning'

export interface PicodashDiagnosticIdentity {
  readonly adapterId?: string
  readonly bindingId?: string
  readonly component?: string
  readonly fieldKey?: string
  readonly importPath?: string
  readonly itemId?: string
  readonly panelId?: string
  readonly scopeId?: string
}

export interface PicodashDiagnosticInput {
  readonly code: PicodashErrorCode
  readonly correction: string
  readonly expectedContract: string
  readonly identity: PicodashDiagnosticIdentity
  readonly severity?: PicodashDiagnosticSeverity
  readonly summary: string
}

export interface PicodashDiagnostic {
  readonly code: PicodashErrorCode
  readonly correction: string
  readonly documentationUrl: string
  readonly expectedContract: string
  readonly fingerprint: string
  readonly identity: PicodashDiagnosticIdentity
  readonly message: string
  readonly severity: PicodashDiagnosticSeverity
  readonly summary: string
  readonly version: typeof PICODASH_DIAGNOSTICS_VERSION
}

const WARNING_CODES = new Set<PicodashErrorCode>([
  PICODASH_ERROR_CODES.DISMISSIBLE_WITHOUT_TRIGGER,
  PICODASH_ERROR_CODES.MISSING_ACCESSIBLE_LABEL,
  PICODASH_ERROR_CODES.MISSING_STYLESHEET,
])

const IDENTITY_KEYS = [
  'panelId',
  'itemId',
  'fieldKey',
  'component',
  'adapterId',
  'bindingId',
  'importPath',
  'scopeId',
] as const satisfies readonly (keyof PicodashDiagnosticIdentity)[]

export function getPicodashDocumentationUrl(code: PicodashErrorCode): string {
  const anchor = code.slice('PICODASH_'.length).toLowerCase().replaceAll('_', '-')
  return `https://picodash.dev/docs/${PICODASH_DIAGNOSTICS_VERSION}/diagnostics/${anchor}`
}

export function createPicodashDiagnostic(input: PicodashDiagnosticInput): PicodashDiagnostic {
  const identity = freezeIdentity(input.identity)
  const documentationUrl = getPicodashDocumentationUrl(input.code)
  const severity = input.severity ?? (WARNING_CODES.has(input.code) ? 'warning' : 'error')
  const fingerprint = createFingerprint(input.code, identity)
  const message = `${input.summary} Expected: ${input.expectedContract} Correction: ${input.correction} Learn more: ${documentationUrl}`

  return Object.freeze({
    code: input.code,
    correction: input.correction,
    documentationUrl,
    expectedContract: input.expectedContract,
    fingerprint,
    identity,
    message,
    severity,
    summary: input.summary,
    version: PICODASH_DIAGNOSTICS_VERSION,
  })
}

export function isPicodashDiagnostic(value: unknown): value is PicodashDiagnostic {
  if (typeof value !== 'object' || value === null) return false

  const candidate = value as Partial<PicodashDiagnostic>
  return (
    typeof candidate.code === 'string' &&
    Object.values(PICODASH_ERROR_CODES).includes(candidate.code as PicodashErrorCode) &&
    typeof candidate.correction === 'string' &&
    typeof candidate.documentationUrl === 'string' &&
    typeof candidate.expectedContract === 'string' &&
    typeof candidate.fingerprint === 'string' &&
    typeof candidate.identity === 'object' &&
    typeof candidate.message === 'string' &&
    (candidate.severity === 'error' || candidate.severity === 'warning') &&
    typeof candidate.summary === 'string' &&
    candidate.version === PICODASH_DIAGNOSTICS_VERSION
  )
}

export function normalizePicodashDiagnostic(
  value: PicodashDiagnostic | PicodashDiagnosticInput,
): PicodashDiagnostic {
  if (!isPicodashDiagnostic(value)) return createPicodashDiagnostic(value)

  return createPicodashDiagnostic({
    code: value.code,
    correction: value.correction,
    expectedContract: value.expectedContract,
    identity: value.identity,
    severity: value.severity,
    summary: value.summary,
  })
}

export class PicodashError extends Error {
  readonly diagnostic: PicodashDiagnostic

  constructor(diagnostic: PicodashDiagnostic, cause?: unknown) {
    super(diagnostic.message)
    this.name = 'PicodashError'
    this.diagnostic = diagnostic
    if (cause !== undefined) {
      Object.defineProperty(this, 'cause', {
        configurable: false,
        enumerable: false,
        value: cause,
        writable: false,
      })
    }
    Object.freeze(this)
  }

  get code(): PicodashErrorCode {
    return this.diagnostic.code
  }
}

export function createPicodashError(
  input: PicodashDiagnosticInput,
  cause?: unknown,
): PicodashError {
  return new PicodashError(createPicodashDiagnostic(input), cause)
}

export function normalizePicodashError(
  value: unknown,
  fallback: PicodashDiagnosticInput,
): PicodashError {
  if (value instanceof PicodashError) return value
  if (isPicodashDiagnostic(value)) return new PicodashError(normalizePicodashDiagnostic(value))
  return createPicodashError(fallback, value)
}

function freezeIdentity(identity: PicodashDiagnosticIdentity): PicodashDiagnosticIdentity {
  const normalized: Partial<Record<keyof PicodashDiagnosticIdentity, string>> = {}

  for (const key of IDENTITY_KEYS) {
    const value = identity[key]
    if (value !== undefined) normalized[key] = value
  }

  return Object.freeze(normalized)
}

function createFingerprint(code: PicodashErrorCode, identity: PicodashDiagnosticIdentity): string {
  const identityParts = IDENTITY_KEYS.map((key) => `${key}=${identity[key] ?? ''}`)
  return [code, ...identityParts].join('|')
}

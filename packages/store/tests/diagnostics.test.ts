import { expect, expectTypeOf, test } from 'vite-plus/test'
import { createPicodashDiagnosticChannel } from '../src/diagnostics.ts'
import {
  createPicodashDiagnostic,
  createPicodashError,
  getPicodashDocumentationUrl,
  normalizePicodashDiagnostic,
  normalizePicodashError,
  PICODASH_ERROR_CODES,
} from '../src/errors.ts'
import type { PicodashErrorCode } from '../src/errors.ts'

const diagnosticInput = {
  code: PICODASH_ERROR_CODES.INCOMPATIBLE_FIELD_DASHLET,
  correction: 'Bind a numeric field or choose a string-compatible Dashlet.',
  expectedContract: 'Slider Dashlets bind to numeric fields.',
  identity: {
    component: 'SliderDashlet',
    fieldKey: 'title',
    itemId: 'title-slider',
    panelId: 'scene',
  },
  summary: 'The field and Dashlet value kinds are incompatible.',
} as const

test('exports stable codes for every diagnostics contract', () => {
  expect(PICODASH_ERROR_CODES).toEqual({
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
  })
  expectTypeOf<
    (typeof PICODASH_ERROR_CODES)[keyof typeof PICODASH_ERROR_CODES]
  >().toEqualTypeOf<PicodashErrorCode>()
})

test('creates immutable structured diagnostics with versioned documentation', () => {
  const sourceIdentity: { component: string; fieldKey: string; itemId: string; panelId: string } = {
    ...diagnosticInput.identity,
  }
  const diagnostic = createPicodashDiagnostic({
    ...diagnosticInput,
    identity: sourceIdentity,
  })
  sourceIdentity.fieldKey = 'changed'

  expect(diagnostic.identity).toEqual(diagnosticInput.identity)
  expect(diagnostic.documentationUrl).toBe(
    'https://picodash.dev/docs/v1/diagnostics/incompatible-field-dashlet',
  )
  expect(diagnostic.message).toContain(diagnostic.expectedContract)
  expect(diagnostic.message).toContain(diagnostic.correction)
  expect(diagnostic.message).toContain(diagnostic.documentationUrl)
  expect(diagnostic.version).toBe('v1')
  expect(Object.isFrozen(diagnostic)).toBe(true)
  expect(Object.isFrozen(diagnostic.identity)).toBe(true)
})

test('uses deterministic default severities and documentation URLs', () => {
  expect(
    createPicodashDiagnostic({
      code: PICODASH_ERROR_CODES.MISSING_STYLESHEET,
      correction: 'Import @picodash/dashpanel/style.css once.',
      expectedContract: 'The Picodash stylesheet is loaded.',
      identity: { component: 'PicodashProvider' },
      summary: 'The Picodash stylesheet is missing.',
    }).severity,
  ).toBe('warning')
  expect(getPicodashDocumentationUrl(PICODASH_ERROR_CODES.ATOMIC_WRITE_FAILED)).toBe(
    'https://picodash.dev/docs/v1/diagnostics/atomic-write-failed',
  )
})

test('creates and normalizes immutable Picodash errors', () => {
  const cause = new Error('adapter threw')
  const error = createPicodashError(diagnosticInput, cause)

  expect(error.name).toBe('PicodashError')
  expect(error.code).toBe(PICODASH_ERROR_CODES.INCOMPATIBLE_FIELD_DASHLET)
  expect(error.cause).toBe(cause)
  expect(Object.isFrozen(error)).toBe(true)
  expect(normalizePicodashError(error, diagnosticInput)).toBe(error)
  expect(normalizePicodashError(cause, diagnosticInput)).toMatchObject({
    cause,
    code: PICODASH_ERROR_CODES.INCOMPATIBLE_FIELD_DASHLET,
  })
})

test('normalizes externally constructed diagnostics into isolated immutable records', () => {
  const canonical = createPicodashDiagnostic(diagnosticInput)
  const external = {
    ...canonical,
    identity: { ...canonical.identity },
  }
  const normalized = normalizePicodashDiagnostic(external)
  external.identity.fieldKey = 'changed'

  expect(normalized).not.toBe(external)
  expect(normalized.identity.fieldKey).toBe('title')
  expect(Object.isFrozen(normalized)).toBe(true)
  expect(Object.isFrozen(normalized.identity)).toBe(true)
})

test('publishes synchronously, deduplicates by code and identity, and supports clearing', () => {
  const channel = createPicodashDiagnosticChannel()
  const snapshots: (readonly string[])[] = []
  const unsubscribe = channel.subscribe((snapshot) => {
    snapshots.push(snapshot.map(({ fingerprint }) => fingerprint))
  })

  const first = channel.publish(diagnosticInput)
  const duplicate = channel.publish({
    ...diagnosticInput,
    summary: 'A differently worded summary for the same failure.',
  })
  const second = channel.publish({
    ...diagnosticInput,
    code: PICODASH_ERROR_CODES.INVALID_COMPOUND_MAP,
  })

  expect(duplicate).toBe(first)
  expect(channel.getSnapshot()).toEqual([first, second])
  expect(Object.isFrozen(channel.getSnapshot())).toBe(true)
  expect(snapshots).toHaveLength(2)

  channel.clear(PICODASH_ERROR_CODES.INCOMPATIBLE_FIELD_DASHLET)
  expect(channel.getSnapshot()).toEqual([second])
  channel.clear()
  expect(channel.getSnapshot()).toEqual([])
  expect(snapshots).toHaveLength(4)

  unsubscribe()
  channel.publish(diagnosticInput)
  expect(snapshots).toHaveLength(4)
})

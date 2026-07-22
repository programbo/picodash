import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import {
  registeredFieldIdsForState,
  registeredWritableFieldIdsForState,
} from './picodash-panel-action-state.js'
import type {
  PicodashPanelState,
  PicodashPanelStore,
  PicodashValue,
} from './picodash-panel-types.js'
import {
  jsonCompatibilityError,
  jsonValuesEqual,
  resolvePicodashFieldValue,
  type PicodashFieldOutput,
} from './picodash-validation.js'

export type PicodashPanelDocumentFormat = 'json' | 'yaml'

export interface PicodashPanelImportChange {
  after: PicodashFieldOutput
  before: PicodashFieldOutput
  errors: readonly string[]
  field: string
}

export interface PicodashPanelImportPlan {
  document: Record<string, PicodashValue>
  outputs: Record<string, PicodashFieldOutput>
}

export type PicodashPanelImportAnalysis =
  | {
      plan: PicodashPanelImportPlan
      status: 'valid'
      values: Record<string, PicodashValue>
    }
  | {
      changes: readonly PicodashPanelImportChange[]
      plan: PicodashPanelImportPlan
      status: 'repair'
      values: Record<string, PicodashValue>
    }
  | {
      errors: Record<string, readonly string[]>
      status: 'invalid'
    }

export class PicodashPanelImportError extends Error {
  readonly errors: Record<string, readonly string[]>

  constructor(errors: Record<string, readonly string[]>) {
    super(formatImportErrors(errors))
    this.name = 'PicodashPanelImportError'
    this.errors = errors
  }
}

export class PicodashPanelRepairRequiredError extends Error {
  readonly analysis: Extract<PicodashPanelImportAnalysis, { status: 'repair' }>

  constructor(analysis: Extract<PicodashPanelImportAnalysis, { status: 'repair' }>) {
    super('Imported panel values require review before they can be applied.')
    this.name = 'PicodashPanelRepairRequiredError'
    this.analysis = analysis
  }
}

export const picodashPanelImportAccept =
  '.json,.yaml,.yml,application/json,application/yaml,application/x-yaml,text/yaml,text/x-yaml'

export function serializePicodashPanelValues(
  state: Pick<PicodashPanelState, 'items' | 'values'>,
  format: PicodashPanelDocumentFormat,
) {
  const document = registeredValuesDocument(state)
  return format === 'json'
    ? `${JSON.stringify(document, null, 2)}\n`
    : stringifyYaml(document, { indent: 2 })
}

export function parsePicodashPanelDocument(
  source: string,
  format: PicodashPanelDocumentFormat,
): unknown {
  try {
    return format === 'json' ? JSON.parse(source) : parseYaml(source)
  } catch (error) {
    throw new Error(
      `Could not parse ${format.toUpperCase()}: ${
        error instanceof Error ? error.message : 'invalid document'
      }`,
    )
  }
}

export function analyzePicodashPanelDocument(
  document: unknown,
  state: Pick<PicodashPanelState, 'fields' | 'items' | 'values'>,
): PicodashPanelImportAnalysis {
  if (!isRecord(document)) {
    return { errors: { $: ['Imported panel values must be a bare object.'] }, status: 'invalid' }
  }
  const jsonError = jsonCompatibilityError(document)
  if (jsonError !== undefined) {
    return { errors: { $: [jsonError.replace(/^Value/, 'Imported value')] }, status: 'invalid' }
  }

  const registeredFieldIds = registeredFieldIdsForState(state)
  const registeredFieldIdSet = new Set(registeredFieldIds)
  const unknownFieldIds = Object.keys(document).filter((field) => !registeredFieldIdSet.has(field))
  if (unknownFieldIds.length > 0) {
    return {
      errors: {
        $: [
          `Unknown panel field${unknownFieldIds.length === 1 ? '' : 's'}: ${unknownFieldIds.join(', ')}.`,
        ],
      },
      status: 'invalid',
    }
  }

  const outputs: Record<string, PicodashFieldOutput> = {}
  const errors: Record<string, readonly string[]> = {}
  const changes: PicodashPanelImportChange[] = []
  for (const field of registeredWritableFieldIdsForState(state)) {
    const hasImportedValue = Object.prototype.hasOwnProperty.call(document, field)
    const hasDefault = state.fields[field]?.defaultValue !== undefined
    const input = hasImportedValue ? document[field] : state.fields[field]?.defaultValue
    const before: PicodashFieldOutput =
      hasImportedValue || hasDefault ? { value: input as PicodashValue } : { unset: true }

    if ('unset' in before) {
      outputs[field] = before
      continue
    }

    const resolution = resolvePicodashFieldValue(state, field, before.value, 'import')
    if (resolution.success) {
      outputs[field] = resolution.output
      if (!jsonValuesEqual(before, resolution.output)) {
        changes.push({
          after: resolution.output,
          before,
          errors: ['The imported value must be normalized.'],
          field,
        })
      }
      continue
    }

    let repair = resolution.repair
    if (repair === undefined && hasImportedValue && hasDefault) {
      const defaultResolution = resolvePicodashFieldValue(
        state,
        field,
        state.fields[field]!.defaultValue,
        'default',
      )
      if (defaultResolution.success) repair = defaultResolution.output
    }
    if (repair === undefined) {
      errors[field] = resolution.errors
      continue
    }
    outputs[field] = repair
    changes.push({ after: repair, before, errors: resolution.errors, field })
  }

  if (Object.keys(errors).length > 0) return { errors, status: 'invalid' }
  const plan = { document, outputs } as PicodashPanelImportPlan
  const values = outputValues(outputs)
  return changes.length > 0
    ? { changes, plan, status: 'repair', values }
    : { plan, status: 'valid', values }
}

export function validatePicodashPanelDocument(
  document: unknown,
  state: Pick<PicodashPanelState, 'fields' | 'items' | 'values'>,
): Record<string, PicodashValue> {
  const analysis = analyzePicodashPanelDocument(document, state)
  if (analysis.status === 'invalid') throw new PicodashPanelImportError(analysis.errors)
  if (analysis.status === 'repair') throw new PicodashPanelRepairRequiredError(analysis)
  return analysis.values
}

export function preparePicodashPanelImport(
  store: PicodashPanelStore,
  source: string,
  format: PicodashPanelDocumentFormat,
) {
  return analyzePicodashPanelDocument(parsePicodashPanelDocument(source, format), store.getState())
}

export function applyPicodashPanelImport(
  store: PicodashPanelStore,
  analysis: Exclude<PicodashPanelImportAnalysis, { status: 'invalid' }>,
) {
  const current = analyzePicodashPanelDocument(analysis.plan.document, store.getState())
  if (current.status === 'invalid') throw new PicodashPanelImportError(current.errors)
  if (!sameOutputs(analysis.plan.outputs, current.plan.outputs)) {
    throw new Error('Panel constraints changed while the import was awaiting review.')
  }
  if (analysis.status === 'valid' && current.status === 'repair') {
    throw new PicodashPanelRepairRequiredError(current)
  }
  store.getState().applyRegisteredFieldOutputs(current.plan.outputs, {
    resetFields: Object.keys(current.plan.outputs).filter(
      (field) => !Object.prototype.hasOwnProperty.call(current.plan.document, field),
    ),
  })
  return current.values
}

export function importPicodashPanelDocument(
  store: PicodashPanelStore,
  source: string,
  format: PicodashPanelDocumentFormat,
): PicodashPanelImportAnalysis {
  const analysis = preparePicodashPanelImport(store, source, format)
  if (analysis.status === 'invalid') throw new PicodashPanelImportError(analysis.errors)
  if (analysis.status === 'valid') applyPicodashPanelImport(store, analysis)
  return analysis
}

export function picodashPanelDocumentFormatFromFilename(
  filename: string,
): PicodashPanelDocumentFormat {
  const normalizedFilename = filename.toLowerCase()
  if (normalizedFilename.endsWith('.json')) return 'json'
  if (normalizedFilename.endsWith('.yaml') || normalizedFilename.endsWith('.yml')) return 'yaml'
  throw new Error('Choose a .json, .yaml, or .yml file.')
}

export function picodashPanelDocumentFilename(
  panelId: string,
  format: PicodashPanelDocumentFormat,
) {
  const sanitizedPanelId =
    panelId
      .trim()
      .replaceAll(/[^a-zA-Z0-9._-]+/g, '-')
      .replaceAll(/^[._-]+|[._-]+$/g, '') || 'panel'
  return `${sanitizedPanelId}.${format}`
}

export function picodashPanelDocumentMimeType(format: PicodashPanelDocumentFormat) {
  return format === 'json' ? 'application/json' : 'application/yaml'
}

function registeredValuesDocument(
  state: Pick<PicodashPanelState, 'items' | 'values'>,
): Record<string, PicodashValue> {
  return Object.fromEntries(
    registeredFieldIdsForState(state)
      .filter((field) => Object.prototype.hasOwnProperty.call(state.values, field))
      .map((field) => [field, state.values[field]!]),
  )
}

function outputValues(outputs: Record<string, PicodashFieldOutput>) {
  return Object.fromEntries(
    Object.entries(outputs)
      .filter(([, output]) => 'value' in output)
      .map(([field, output]) => [field, (output as { value: PicodashValue }).value]),
  )
}

function sameOutputs(
  left: Record<string, PicodashFieldOutput>,
  right: Record<string, PicodashFieldOutput>,
) {
  const fields = Object.keys(left)
  return (
    fields.length === Object.keys(right).length &&
    fields.every(
      (field) => right[field] !== undefined && jsonValuesEqual(left[field]!, right[field]!),
    )
  )
}

function isRecord(value: unknown): value is Record<string, PicodashValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function formatImportErrors(errors: Record<string, readonly string[]>) {
  return Object.entries(errors)
    .flatMap(([field, messages]) =>
      messages.map((message) => (field === '$' ? message : `Field "${field}": ${message}`)),
    )
    .join(' ')
}

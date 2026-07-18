import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import {
  registeredFieldIdsForState,
  registeredWritableFieldIdsForState,
} from './tweaker-panel-action-state.js'
import type { TweakerPanelState, TweakerPanelStore, TweakerValue } from './tweaker-panel-types.js'
import {
  jsonCompatibilityError,
  jsonValuesEqual,
  resolveTweakerFieldValue,
  type TweakerFieldOutput,
} from './tweaker-validation.js'

export type TweakerPanelDocumentFormat = 'json' | 'yaml'

export interface TweakerPanelImportChange {
  after: TweakerFieldOutput
  before: TweakerFieldOutput
  errors: readonly string[]
  field: string
}

export interface TweakerPanelImportPlan {
  document: Record<string, TweakerValue>
  outputs: Record<string, TweakerFieldOutput>
}

export type TweakerPanelImportAnalysis =
  | {
      plan: TweakerPanelImportPlan
      status: 'valid'
      values: Record<string, TweakerValue>
    }
  | {
      changes: readonly TweakerPanelImportChange[]
      plan: TweakerPanelImportPlan
      status: 'repair'
      values: Record<string, TweakerValue>
    }
  | {
      errors: Record<string, readonly string[]>
      status: 'invalid'
    }

export class TweakerPanelImportError extends Error {
  readonly errors: Record<string, readonly string[]>

  constructor(errors: Record<string, readonly string[]>) {
    super(formatImportErrors(errors))
    this.name = 'TweakerPanelImportError'
    this.errors = errors
  }
}

export class TweakerPanelRepairRequiredError extends Error {
  readonly analysis: Extract<TweakerPanelImportAnalysis, { status: 'repair' }>

  constructor(analysis: Extract<TweakerPanelImportAnalysis, { status: 'repair' }>) {
    super('Imported panel values require review before they can be applied.')
    this.name = 'TweakerPanelRepairRequiredError'
    this.analysis = analysis
  }
}

export const tweakerPanelImportAccept =
  '.json,.yaml,.yml,application/json,application/yaml,application/x-yaml,text/yaml,text/x-yaml'

export function serializeTweakerPanelValues(
  state: Pick<TweakerPanelState, 'items' | 'values'>,
  format: TweakerPanelDocumentFormat,
) {
  const document = registeredValuesDocument(state)
  return format === 'json'
    ? `${JSON.stringify(document, null, 2)}\n`
    : stringifyYaml(document, { indent: 2 })
}

export function parseTweakerPanelDocument(
  source: string,
  format: TweakerPanelDocumentFormat,
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

export function analyzeTweakerPanelDocument(
  document: unknown,
  state: Pick<TweakerPanelState, 'fields' | 'items' | 'values'>,
): TweakerPanelImportAnalysis {
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

  const outputs: Record<string, TweakerFieldOutput> = {}
  const errors: Record<string, readonly string[]> = {}
  const changes: TweakerPanelImportChange[] = []
  for (const field of registeredWritableFieldIdsForState(state)) {
    const hasImportedValue = Object.prototype.hasOwnProperty.call(document, field)
    const hasDefault = state.fields[field]?.defaultValue !== undefined
    const input = hasImportedValue ? document[field] : state.fields[field]?.defaultValue
    const before: TweakerFieldOutput =
      hasImportedValue || hasDefault ? { value: input as TweakerValue } : { unset: true }

    if ('unset' in before) {
      outputs[field] = before
      continue
    }

    const resolution = resolveTweakerFieldValue(state, field, before.value, 'import')
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
      const defaultResolution = resolveTweakerFieldValue(
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
  const plan = { document, outputs } as TweakerPanelImportPlan
  const values = outputValues(outputs)
  return changes.length > 0
    ? { changes, plan, status: 'repair', values }
    : { plan, status: 'valid', values }
}

export function validateTweakerPanelDocument(
  document: unknown,
  state: Pick<TweakerPanelState, 'fields' | 'items' | 'values'>,
): Record<string, TweakerValue> {
  const analysis = analyzeTweakerPanelDocument(document, state)
  if (analysis.status === 'invalid') throw new TweakerPanelImportError(analysis.errors)
  if (analysis.status === 'repair') throw new TweakerPanelRepairRequiredError(analysis)
  return analysis.values
}

export function prepareTweakerPanelImport(
  store: TweakerPanelStore,
  source: string,
  format: TweakerPanelDocumentFormat,
) {
  return analyzeTweakerPanelDocument(parseTweakerPanelDocument(source, format), store.getState())
}

export function applyTweakerPanelImport(
  store: TweakerPanelStore,
  analysis: Exclude<TweakerPanelImportAnalysis, { status: 'invalid' }>,
) {
  const current = analyzeTweakerPanelDocument(analysis.plan.document, store.getState())
  if (current.status === 'invalid') throw new TweakerPanelImportError(current.errors)
  if (!sameOutputs(analysis.plan.outputs, current.plan.outputs)) {
    throw new Error('Panel constraints changed while the import was awaiting review.')
  }
  if (analysis.status === 'valid' && current.status === 'repair') {
    throw new TweakerPanelRepairRequiredError(current)
  }
  store.getState().applyRegisteredFieldOutputs(current.plan.outputs, {
    resetFields: Object.keys(current.plan.outputs).filter(
      (field) => !Object.prototype.hasOwnProperty.call(current.plan.document, field),
    ),
  })
  return current.values
}

export function importTweakerPanelDocument(
  store: TweakerPanelStore,
  source: string,
  format: TweakerPanelDocumentFormat,
): TweakerPanelImportAnalysis {
  const analysis = prepareTweakerPanelImport(store, source, format)
  if (analysis.status === 'invalid') throw new TweakerPanelImportError(analysis.errors)
  if (analysis.status === 'valid') applyTweakerPanelImport(store, analysis)
  return analysis
}

export function tweakerPanelDocumentFormatFromFilename(
  filename: string,
): TweakerPanelDocumentFormat {
  const normalizedFilename = filename.toLowerCase()
  if (normalizedFilename.endsWith('.json')) return 'json'
  if (normalizedFilename.endsWith('.yaml') || normalizedFilename.endsWith('.yml')) return 'yaml'
  throw new Error('Choose a .json, .yaml, or .yml file.')
}

export function tweakerPanelDocumentFilename(panelId: string, format: TweakerPanelDocumentFormat) {
  const sanitizedPanelId =
    panelId
      .trim()
      .replaceAll(/[^a-zA-Z0-9._-]+/g, '-')
      .replaceAll(/^[._-]+|[._-]+$/g, '') || 'panel'
  return `${sanitizedPanelId}.${format}`
}

export function tweakerPanelDocumentMimeType(format: TweakerPanelDocumentFormat) {
  return format === 'json' ? 'application/json' : 'application/yaml'
}

function registeredValuesDocument(
  state: Pick<TweakerPanelState, 'items' | 'values'>,
): Record<string, TweakerValue> {
  return Object.fromEntries(
    registeredFieldIdsForState(state)
      .filter((field) => Object.prototype.hasOwnProperty.call(state.values, field))
      .map((field) => [field, state.values[field]!]),
  )
}

function outputValues(outputs: Record<string, TweakerFieldOutput>) {
  return Object.fromEntries(
    Object.entries(outputs)
      .filter(([, output]) => 'value' in output)
      .map(([field, output]) => [field, (output as { value: TweakerValue }).value]),
  )
}

function sameOutputs(
  left: Record<string, TweakerFieldOutput>,
  right: Record<string, TweakerFieldOutput>,
) {
  const fields = Object.keys(left)
  return (
    fields.length === Object.keys(right).length &&
    fields.every(
      (field) => right[field] !== undefined && jsonValuesEqual(left[field]!, right[field]!),
    )
  )
}

function isRecord(value: unknown): value is Record<string, TweakerValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function formatImportErrors(errors: Record<string, readonly string[]>) {
  return Object.entries(errors)
    .flatMap(([field, messages]) =>
      messages.map((message) => (field === '$' ? message : `Field "${field}": ${message}`)),
    )
    .join(' ')
}

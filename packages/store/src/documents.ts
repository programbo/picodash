import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { clonePicodashValue } from './json.js'
import type {
  PicodashJsonValue,
  PicodashParseResult,
  PicodashStore,
  PicodashStoreState,
  PicodashValidationSource,
} from './types.js'

export type PicodashPanelDocumentFormat = 'json' | 'yaml'
export type PicodashPanelDocument = Readonly<Record<string, PicodashJsonValue>>
export type PicodashPanelImportErrors = Readonly<Record<string, readonly string[]>>
export type PicodashPanelFieldOutput =
  | { readonly unset: true }
  | { readonly value: PicodashJsonValue }

export interface PicodashPanelImportChange<TValues extends object> {
  readonly after: PicodashPanelFieldOutput
  readonly before: PicodashPanelFieldOutput
  readonly errors: readonly string[]
  readonly field: Extract<keyof TValues, string>
}

export interface PicodashPanelImportPlan<TValues extends object> {
  readonly document: PicodashPanelDocument
  readonly outputs: Readonly<Record<string, PicodashPanelFieldOutput>>
  readonly resetFields: readonly Extract<keyof TValues, string>[]
}

export type PicodashPanelImportAnalysis<TValues extends object> =
  | {
      readonly plan: PicodashPanelImportPlan<TValues>
      readonly status: 'valid'
      readonly values: Partial<TValues>
    }
  | {
      readonly changes: readonly PicodashPanelImportChange<TValues>[]
      readonly plan: PicodashPanelImportPlan<TValues>
      readonly status: 'repair'
      readonly values: Partial<TValues>
    }
  | {
      readonly errors: PicodashPanelImportErrors
      readonly status: 'invalid'
    }

export type PicodashPanelImportApplyResult<TValues extends object> =
  | {
      readonly analysis: Exclude<PicodashPanelImportAnalysis<TValues>, { status: 'invalid' }>
      readonly success: true
      readonly values: Partial<TValues>
    }
  | {
      readonly analysis: PicodashPanelImportAnalysis<TValues>
      readonly reason: 'invalid' | 'repair-required' | 'stale'
      readonly success: false
    }

type StringKey<TValues extends object> = Extract<keyof TValues, string>

export interface PicodashPanelDocumentResolver<TValues extends object> {
  readonly resolve: (
    field: StringKey<TValues>,
    input: unknown,
    source: Extract<PicodashValidationSource, 'import' | 'reset'>,
  ) => PicodashParseResult<TValues[StringKey<TValues>]>
}

export class PicodashPanelImportError extends Error {
  readonly errors: PicodashPanelImportErrors

  constructor(errors: PicodashPanelImportErrors) {
    super(formatImportErrors(errors))
    this.name = 'PicodashPanelImportError'
    this.errors = errors
  }
}

export class PicodashPanelRepairRequiredError<TValues extends object> extends Error {
  readonly analysis: Extract<PicodashPanelImportAnalysis<TValues>, { status: 'repair' }>

  constructor(analysis: Extract<PicodashPanelImportAnalysis<TValues>, { status: 'repair' }>) {
    super('Imported panel values require review before they can be applied.')
    this.name = 'PicodashPanelRepairRequiredError'
    this.analysis = analysis
  }
}

export const picodashPanelImportAccept =
  '.json,.yaml,.yml,application/json,application/yaml,application/x-yaml,text/yaml,text/x-yaml'

export function serializePicodashPanelValues<TValues extends object>(
  state: Pick<PicodashStoreState<TValues>, 'items' | 'values'>,
  format: PicodashPanelDocumentFormat,
): string {
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

export function analyzePicodashPanelDocument<TValues extends object>(
  document: unknown,
  state: Pick<PicodashStoreState<TValues>, 'analyzePanelDocument'>,
): PicodashPanelImportAnalysis<TValues> {
  return state.analyzePanelDocument(document)
}

export function analyzePicodashPanelDocumentState<TValues extends object>(
  document: unknown,
  state: Pick<PicodashStoreState<TValues>, 'fieldStates' | 'items' | 'values'>,
  resolver: PicodashPanelDocumentResolver<TValues>,
): PicodashPanelImportAnalysis<TValues> {
  if (!isRecord(document)) {
    return immutable({
      errors: { $: ['Imported panel values must be a bare object.'] },
      status: 'invalid',
    })
  }

  let canonicalDocument: Record<string, PicodashJsonValue>
  try {
    canonicalDocument = clonePicodashValue(document as PicodashJsonValue) as Record<
      string,
      PicodashJsonValue
    >
  } catch (error) {
    return immutable({
      errors: {
        $: [
          error instanceof Error
            ? error.message.replace(/^Picodash values/, 'Imported values')
            : 'Imported values must be JSON-compatible.',
        ],
      },
      status: 'invalid',
    })
  }

  const modes = registeredFieldModes(state.items)
  const unknownFields = Object.keys(canonicalDocument).filter((field) => !modes.has(field))
  if (unknownFields.length > 0) {
    return immutable({
      errors: {
        $: [
          `Unknown panel field${unknownFields.length === 1 ? '' : 's'}: ${unknownFields.join(', ')}.`,
        ],
      },
      status: 'invalid',
    })
  }

  const errors: Record<string, readonly string[]> = {}
  for (const [field, mode] of modes) {
    if (
      mode === 'display' &&
      Object.prototype.hasOwnProperty.call(canonicalDocument, field) &&
      !outputsEqual(outputForValue(state.values, field as StringKey<TValues>), {
        value: canonicalDocument[field]!,
      })
    ) {
      errors[field] = ['Registered field is display-only and cannot be imported.']
    }
  }
  if (Object.keys(errors).length > 0) return immutable({ errors, status: 'invalid' })

  const outputs: Record<string, PicodashPanelFieldOutput> = {}
  const resetFields: StringKey<TValues>[] = []
  const changes: PicodashPanelImportChange<TValues>[] = []
  for (const [field, mode] of modes) {
    if (mode === 'display') continue
    const key = field as StringKey<TValues>
    const hasImportedValue = Object.prototype.hasOwnProperty.call(canonicalDocument, field)
    const input = hasImportedValue ? canonicalDocument[field] : state.fieldStates[key].defaultValue
    const before: PicodashPanelFieldOutput = hasImportedValue
      ? { value: input as PicodashJsonValue }
      : outputForValue(state.values, key)
    const resolution = resolver.resolve(key, input, hasImportedValue ? 'import' : 'reset')

    if (resolution.success) {
      outputs[field] = resolution.output as PicodashPanelFieldOutput
      if (!hasImportedValue) resetFields.push(key)
      if (
        hasImportedValue &&
        !outputsEqual(
          { value: input as PicodashJsonValue },
          resolution.output as PicodashPanelFieldOutput,
        )
      ) {
        changes.push({
          after: resolution.output as PicodashPanelFieldOutput,
          before,
          errors: ['The imported value must be normalized.'],
          field: key,
        })
      }
      continue
    }

    const repair = resolution.repair as PicodashPanelFieldOutput | undefined
    if (repair === undefined) {
      errors[field] = resolution.errors
      continue
    }
    outputs[field] = repair
    changes.push({
      after: repair,
      before,
      errors: resolution.errors,
      field: key,
    })
  }

  if (Object.keys(errors).length > 0) return immutable({ errors, status: 'invalid' })
  const plan = {
    document: canonicalDocument,
    outputs,
    resetFields,
  } satisfies PicodashPanelImportPlan<TValues>
  const values = outputValues<TValues>(outputs)
  return immutable(
    changes.length > 0
      ? { changes, plan, status: 'repair', values }
      : { plan, status: 'valid', values },
  )
}

export function validatePicodashPanelDocument<TValues extends object>(
  document: unknown,
  state: Pick<PicodashStoreState<TValues>, 'analyzePanelDocument'>,
): Partial<TValues> {
  const analysis = analyzePicodashPanelDocument(document, state)
  if (analysis.status === 'invalid') throw new PicodashPanelImportError(analysis.errors)
  if (analysis.status === 'repair') throw new PicodashPanelRepairRequiredError(analysis)
  return analysis.values
}

export function preparePicodashPanelImport<TValues extends object>(
  store: PicodashStore<TValues>,
  source: string,
  format: PicodashPanelDocumentFormat,
): PicodashPanelImportAnalysis<TValues> {
  return store.getState().analyzePanelDocument(parsePicodashPanelDocument(source, format))
}

export function applyPicodashPanelImport<TValues extends object>(
  store: PicodashStore<TValues>,
  analysis: Exclude<PicodashPanelImportAnalysis<TValues>, { status: 'invalid' }>,
): Partial<TValues> {
  const result = store.getState().applyPanelImport(analysis)
  if (result.success) return result.values
  if (result.analysis.status === 'invalid') {
    throw new PicodashPanelImportError(result.analysis.errors)
  }
  if (result.reason === 'repair-required' && result.analysis.status === 'repair') {
    throw new PicodashPanelRepairRequiredError(result.analysis)
  }
  throw new Error('Panel constraints changed while the import was awaiting review.')
}

export function importPicodashPanelDocument<TValues extends object>(
  store: PicodashStore<TValues>,
  source: string,
  format: PicodashPanelDocumentFormat,
): PicodashPanelImportAnalysis<TValues> {
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
): string {
  let sanitizedPanelId = ''
  let hasSeparator = false
  for (const character of panelId.trim()) {
    const code = character.charCodeAt(0)
    const isAllowed =
      (code >= 48 && code <= 57) ||
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122) ||
      character === '.' ||
      character === '_' ||
      character === '-'
    if (isAllowed) {
      sanitizedPanelId += character
      hasSeparator = false
    } else if (sanitizedPanelId && !hasSeparator) {
      sanitizedPanelId += '-'
      hasSeparator = true
    }
  }
  let start = 0
  let end = sanitizedPanelId.length
  while (isFilenameBoundary(sanitizedPanelId.charAt(start))) start += 1
  while (isFilenameBoundary(sanitizedPanelId.charAt(end - 1))) end -= 1
  sanitizedPanelId = sanitizedPanelId.slice(start, end)
  if (!sanitizedPanelId) sanitizedPanelId = 'panel'
  return `${sanitizedPanelId}.${format}`
}

export function picodashPanelDocumentMimeType(format: PicodashPanelDocumentFormat): string {
  return format === 'json' ? 'application/json' : 'application/yaml'
}

export function samePicodashPanelImportOutputs<TValues extends object>(
  left: PicodashPanelImportPlan<TValues>['outputs'],
  right: PicodashPanelImportPlan<TValues>['outputs'],
): boolean {
  const fields = Object.keys(left)
  return (
    fields.length === Object.keys(right).length &&
    fields.every(
      (field) =>
        right[field as StringKey<TValues>] !== undefined &&
        outputsEqual(left[field as StringKey<TValues>]!, right[field as StringKey<TValues>]!),
    )
  )
}

function registeredValuesDocument<TValues extends object>(
  state: Pick<PicodashStoreState<TValues>, 'items' | 'values'>,
): Record<string, PicodashJsonValue> {
  const fields = registeredFieldModes(state.items)
  return Object.fromEntries(
    [...fields.keys()]
      .filter((field) => Object.prototype.hasOwnProperty.call(state.values, field))
      .map((field) => [
        field,
        clonePicodashValue(state.values[field as StringKey<TValues>] as PicodashJsonValue),
      ]),
  )
}

function registeredFieldModes<TValues extends object>(
  items: PicodashStoreState<TValues>['items'],
): Map<string, 'display' | 'input'> {
  const modes = new Map<string, 'display' | 'input'>()
  for (const item of Object.values(items)) {
    for (const binding of item.bindings) {
      if (!modes.has(binding.field.key)) modes.set(binding.field.key, binding.mode)
    }
  }
  return modes
}

function outputValues<TValues extends object>(
  outputs: Record<string, PicodashPanelFieldOutput>,
): Partial<TValues> {
  return Object.fromEntries(
    Object.entries(outputs)
      .filter(([, output]) => 'value' in output)
      .map(([field, output]) => [field, (output as { value: PicodashJsonValue }).value]),
  ) as Partial<TValues>
}

function outputForValue<TValues extends object>(
  values: TValues,
  field: StringKey<TValues>,
): PicodashPanelFieldOutput {
  return Object.prototype.hasOwnProperty.call(values, field)
    ? { value: values[field] as PicodashJsonValue }
    : { unset: true }
}

function outputsEqual(left: PicodashPanelFieldOutput, right: PicodashPanelFieldOutput) {
  if ('unset' in left || 'unset' in right) return 'unset' in left && 'unset' in right
  try {
    return jsonValuesEqual(
      clonePicodashValue(left.value as PicodashJsonValue),
      clonePicodashValue(right.value as PicodashJsonValue),
    )
  } catch {
    return false
  }
}

function jsonValuesEqual(left: PicodashJsonValue, right: PicodashJsonValue): boolean {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((entry, index) => jsonValuesEqual(entry, right[index]!))
    )
  }
  if (
    typeof left === 'object' &&
    left !== null &&
    !Array.isArray(left) &&
    typeof right === 'object' &&
    right !== null &&
    !Array.isArray(right)
  ) {
    const leftEntries = Object.entries(left)
    const rightRecord = right as Readonly<Record<string, PicodashJsonValue>>
    return (
      leftEntries.length === Object.keys(right).length &&
      leftEntries.every(
        ([key, value]) =>
          Object.prototype.hasOwnProperty.call(right, key) &&
          jsonValuesEqual(value, rightRecord[key]!),
      )
    )
  }
  return false
}

function immutable<TValue>(value: TValue): TValue {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) immutable(child)
  return Object.freeze(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFilenameBoundary(character: string) {
  return character === '.' || character === '_' || character === '-'
}

function formatImportErrors(errors: PicodashPanelImportErrors) {
  return Object.entries(errors)
    .flatMap(([field, messages]) =>
      messages.map((message) => (field === '$' ? message : `Field "${field}": ${message}`)),
    )
    .join(' ')
}

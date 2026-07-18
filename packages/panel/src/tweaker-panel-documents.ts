import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import {
  registeredFieldIdsForState,
  registeredWritableFieldIdsForState,
} from './tweaker-panel-action-state.js'
import {
  tweakerItemImportAllowedStringValues,
  type TweakerItemRegistration,
  type TweakerPanelState,
  type TweakerPanelStore,
  type TweakerValue,
} from './tweaker-panel-types.js'

export type TweakerPanelDocumentFormat = 'json' | 'yaml'

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

export function validateTweakerPanelDocument(
  document: unknown,
  state: Pick<TweakerPanelState, 'fields' | 'items' | 'values'>,
): Record<string, TweakerValue> {
  if (!isRecord(document)) {
    throw new Error('Imported panel values must be a bare object.')
  }
  assertJsonCompatible(document)

  const registeredFieldIds = registeredFieldIdsForState(state)
  const registeredFieldIdSet = new Set(registeredFieldIds)
  const unknownFieldIds = Object.keys(document).filter(
    (fieldId) => !registeredFieldIdSet.has(fieldId),
  )
  if (unknownFieldIds.length > 0) {
    throw new Error(
      `Unknown panel field${unknownFieldIds.length === 1 ? '' : 's'}: ${unknownFieldIds.join(', ')}.`,
    )
  }

  const writableFieldIdSet = new Set(registeredWritableFieldIdsForState(state))
  const writableDocument = Object.fromEntries(
    Object.entries(document).filter(([fieldId]) => writableFieldIdSet.has(fieldId)),
  )

  for (const [fieldId, value] of Object.entries(writableDocument)) {
    const hasCurrentValue = Object.prototype.hasOwnProperty.call(state.values, fieldId)
    const expectedValue = hasCurrentValue
      ? state.values[fieldId]
      : state.fields[fieldId]?.defaultValue
    if (expectedValue !== undefined) {
      const expectedKind = coarseJsonKind(expectedValue)
      const importedKind = coarseJsonKind(value)
      if (expectedKind !== importedKind) {
        throw new Error(`Field "${fieldId}" expects ${expectedKind}, received ${importedKind}.`)
      }
    }

    const allowedStringValues = importAllowedStringValuesForField(state.items, fieldId)
    if (
      allowedStringValues !== undefined &&
      (typeof value !== 'string' || !allowedStringValues.includes(value))
    ) {
      throw new Error(
        allowedStringValues.length === 0
          ? `Field "${fieldId}" has no registered options.`
          : `Field "${fieldId}" must be one of: ${allowedStringValues
              .map(formatAllowedValue)
              .join(', ')}.`,
      )
    }
  }

  return writableDocument
}

export function importTweakerPanelDocument(
  store: TweakerPanelStore,
  source: string,
  format: TweakerPanelDocumentFormat,
) {
  const values = validateTweakerPanelDocument(
    parseTweakerPanelDocument(source, format),
    store.getState(),
  )
  store.getState().replaceRegisteredFieldValues(values)
  return values
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
      .filter((fieldId) => Object.prototype.hasOwnProperty.call(state.values, fieldId))
      .map((fieldId) => [fieldId, state.values[fieldId]!]),
  )
}

function coarseJsonKind(value: unknown) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value === 'object' ? 'object' : typeof value
}

function importAllowedStringValuesForField(
  items: Record<string, TweakerItemRegistration>,
  fieldId: string,
) {
  const constraints = Object.values(items)
    .filter((item) => item.fieldId === fieldId)
    .map((item) => item[tweakerItemImportAllowedStringValues])
    .filter((values): values is readonly string[] => values !== undefined)
  if (constraints.length === 0) return undefined

  return constraints.reduce<string[]>(
    (allowedValues, values) => allowedValues.filter((value) => values.includes(value)),
    [...constraints[0]!],
  )
}

function formatAllowedValue(value: string) {
  return JSON.stringify(value)
}

function isRecord(value: unknown): value is Record<string, TweakerValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertJsonCompatible(value: unknown) {
  const activeObjects = new WeakSet<object>()

  const visit = (candidate: unknown, path: string): void => {
    if (candidate === null || typeof candidate === 'string' || typeof candidate === 'boolean') {
      return
    }
    if (typeof candidate === 'number') {
      if (Number.isFinite(candidate)) return
      throw new Error(`Imported value at ${path} must be a finite number.`)
    }
    if (typeof candidate !== 'object') {
      throw new Error(`Imported value at ${path} is not JSON-compatible.`)
    }
    if (activeObjects.has(candidate)) {
      throw new Error(`Imported value at ${path} contains a cycle.`)
    }

    activeObjects.add(candidate)
    if (Array.isArray(candidate)) {
      candidate.forEach((entry, index) => visit(entry, `${path}[${index}]`))
    } else {
      for (const [key, entry] of Object.entries(candidate)) {
        visit(entry, `${path}.${key}`)
      }
    }
    activeObjects.delete(candidate)
  }

  visit(value, '$')
}

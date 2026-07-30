import { createStore } from 'zustand/vanilla'
import { createPicodashFields } from './fields.js'
import { clonePicodashValue } from './json.js'
import type {
  PicodashFieldDefinition,
  PicodashFieldDefinitions,
  PicodashInferredStoreOptions,
  PicodashJsonValue,
  PicodashStore,
  PicodashStoreOptions,
  PicodashValuesFromDefinitions,
} from './types.js'

export function createPicodashStore<
  TValues extends object = never,
  const TDefinitions extends Record<string, PicodashFieldDefinition<PicodashJsonValue>> = Record<
    string,
    PicodashFieldDefinition<PicodashJsonValue>
  >,
>(
  options: [TValues] extends [never]
    ? PicodashInferredStoreOptions<TDefinitions>
    : PicodashStoreOptions<NoInfer<TValues>>,
): PicodashStore<[TValues] extends [never] ? PicodashValuesFromDefinitions<TDefinitions> : TValues>
export function createPicodashStore(
  options: PicodashStoreOptions<Record<string, PicodashJsonValue>>,
): PicodashStore<Record<string, PicodashJsonValue>> {
  const values = createInitialValues(options.fields, options.initialValues)
  const store = createStore(() => ({ panelId: options.panelId, values })) as PicodashStore<
    Record<string, PicodashJsonValue>
  >
  const fields = createPicodashFields(options.fields, store)

  return Object.assign(store, { fields })
}

function createInitialValues<TValues extends object>(
  definitions: PicodashFieldDefinitions<TValues>,
  initialValues: PicodashStoreOptions<TValues>['initialValues'],
): TValues {
  const values: Record<string, PicodashJsonValue> = {}

  for (const [key, definition] of Object.entries(
    definitions as Record<string, { readonly defaultValue: PicodashJsonValue }>,
  )) {
    values[key] = clonePicodashValue(definition.defaultValue)
  }

  if (initialValues !== undefined) {
    for (const [key, value] of Object.entries(initialValues)) {
      if (!Object.prototype.hasOwnProperty.call(definitions, key)) {
        throw new TypeError(`Unknown Picodash field "${key}".`)
      }
      values[key] = clonePicodashValue(value as PicodashJsonValue)
    }
  }

  return values as TValues
}

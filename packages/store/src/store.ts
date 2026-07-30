import { createStore, type StoreApi } from 'zustand/vanilla'
import { createPicodashFields, picodashOwnerOwnsField } from './fields.js'
import { clonePicodashValue } from './json.js'
import type {
  PicodashField,
  PicodashFieldDefinition,
  PicodashFieldOutput,
  PicodashInferredFieldDefinition,
  PicodashInferredStoreOptions,
  PicodashJsonValue,
  PicodashRepairChange,
  PicodashRepairProposal,
  PicodashStore,
  PicodashStoreOptions,
  PicodashStoreState,
  PicodashValidationSource,
  PicodashValuesFromDefinitions,
  PicodashWriteErrors,
  PicodashWriteResult,
} from './types.js'
import { resolvePicodashFieldValue } from './validation.js'

type Values = Record<string, PicodashJsonValue>
type State = PicodashStoreState<Values>
type DataState = Pick<State, 'fieldStates' | 'panelId' | 'repairProposal' | 'values'>

export function createPicodashStore<
  TValues extends object = never,
  const TDefinitions extends Record<string, PicodashInferredFieldDefinition> = Record<
    string,
    PicodashInferredFieldDefinition
  >,
>(
  options: [TValues] extends [never]
    ? PicodashInferredStoreOptions<TDefinitions>
    : PicodashStoreOptions<NoInfer<TValues>>,
): PicodashStore<[TValues] extends [never] ? PicodashValuesFromDefinitions<TDefinitions> : TValues>
export function createPicodashStore(untypedOptions: unknown): PicodashStore<Values> {
  const options = untypedOptions as PicodashStoreOptions<Values>
  const owner = Object.freeze({})
  const fields = createPicodashFields(options.fields, owner)
  const definitionEntries = Object.entries(options.fields)
  const definitionKeys = new Set(definitionEntries.map(([key]) => key))
  const definitions = Object.fromEntries(
    definitionEntries.map(([key, definition]) => [
      key,
      {
        allowUnset: definition.allowUnset,
        defaultValue: clonePicodashValue(definition.defaultValue),
        parse: definition.parse,
        validate: definition.validate,
      },
    ]),
  ) as Record<string, PicodashFieldDefinition<PicodashJsonValue>>

  const values: Values = {}
  const fieldStates: Record<
    string,
    {
      defaultValue: PicodashJsonValue
      dirty: boolean
      errors: readonly string[]
      touched: boolean
    }
  > = {}

  for (const key of definitionKeys) {
    const definition = definitions[key]!
    const rawDefault = definition.defaultValue
    const result = resolvePicodashFieldValue(
      definition,
      fields[key]!,
      rawDefault,
      'default',
      undefined,
      rawDefault,
    )
    if (!result.success || 'unset' in result.output) {
      const errors = result.success ? ['A field default cannot resolve to unset.'] : result.errors
      throw new TypeError(`Invalid default for Picodash field "${key}": ${errors.join(' ')}`)
    }
    const defaultValue = clonePicodashValue(result.output.value)
    definitions[key] = { ...definition, defaultValue } as PicodashFieldDefinition<PicodashJsonValue>
    values[key] = clonePicodashValue(defaultValue)
    fieldStates[key] = {
      defaultValue: clonePicodashValue(defaultValue),
      dirty: false,
      errors: [],
      touched: false,
    }
  }

  const initialValues = options.initialValues
  if (initialValues !== undefined) {
    for (const key of Object.keys(initialValues)) {
      if (!definitionKeys.has(key)) throw new TypeError(`Unknown Picodash field "${key}".`)
    }
  }

  let initialData: DataState = {
    fieldStates,
    panelId: options.panelId,
    repairProposal: null,
    values,
  }
  if (initialValues !== undefined) {
    const outputs: Record<string, PicodashFieldOutput<PicodashJsonValue>> = {}
    const fieldErrors: Record<string, readonly string[]> = {}
    const repairs: PicodashRepairChange<Values>[] = []
    for (const [key, input] of Object.entries(initialValues)) {
      const result = resolveFromState(initialData, key, input, 'initial')
      if (result.success) {
        outputs[key] = result.output
      } else if (result.repair !== undefined) {
        repairs.push({
          after: result.repair,
          before: outputForValue(initialData.values, key),
          errors: result.errors,
          field: fields[key]!,
        })
      } else {
        fieldErrors[key] = result.errors
      }
    }
    initialData = applyOutputs(initialData, outputs, 'initial')
    const nextFieldStates = { ...initialData.fieldStates }
    for (const [key, errors] of Object.entries(fieldErrors)) {
      nextFieldStates[key] = { ...nextFieldStates[key]!, errors: [...errors] }
    }
    initialData = {
      ...initialData,
      fieldStates: nextFieldStates,
      repairProposal:
        repairs.length === 0
          ? null
          : ({ changes: repairs, source: 'initial' } satisfies PicodashRepairProposal<Values>),
    }
  }

  let internalStore!: StoreApi<State>
  const actions: Omit<State, keyof DataState> = {
    abortRepairProposal() {
      const proposal = internalStore.getState().repairProposal
      if (proposal === null) return
      internalStore.setState((state) => {
        const nextFieldStates = { ...state.fieldStates }
        for (const change of proposal.changes) {
          const key = change.field.key
          nextFieldStates[key] = {
            ...nextFieldStates[key]!,
            errors: [...change.errors],
          }
        }
        return { fieldStates: nextFieldStates, repairProposal: null }
      })
    },
    acceptRepairProposal() {
      const state = internalStore.getState()
      const proposal = state.repairProposal
      if (proposal === null) return { success: true }
      const outputs: Record<string, PicodashFieldOutput<PicodashJsonValue>> = {}
      const errors: Record<string, readonly string[]> = {}

      for (const change of proposal.changes) {
        const key = change.field.key
        if (!outputsEqual(outputForValue(state.values, key), change.before)) {
          errors[key] = ['Field values changed while the repair was awaiting review.']
          continue
        }
        const result =
          'unset' in change.after
            ? resolveUnset(definitions[key]!)
            : resolveFromState(state, key, change.after.value, 'repair')
        if (!result.success || !outputsEqual(result.output, change.after)) {
          errors[key] = result.success
            ? ['Field contracts changed while the repair was awaiting review.']
            : result.errors
          continue
        }
        outputs[key] = result.output
      }
      if (Object.keys(errors).length > 0) return { errors, success: false }

      internalStore.setState((current) => ({
        ...applyOutputs(current, outputs, 'initial'),
        repairProposal: null,
      }))
      return { success: true }
    },
    resetFieldValue(field) {
      const key = ownedFieldKey(field)
      if (key === undefined) return foreignFieldResult(field)
      const state = internalStore.getState()
      const result = resolveFromState(state, key, state.fieldStates[key]!.defaultValue, 'reset')
      if (!result.success) return failure(key, result.errors)
      internalStore.setState((current) => applyOutputs(current, { [key]: result.output }, 'reset'))
      return { success: true }
    },
    resetFields() {
      const state = internalStore.getState()
      const outputs: Record<string, PicodashFieldOutput<PicodashJsonValue>> = {}
      const errors: Record<string, readonly string[]> = {}
      for (const key of definitionKeys) {
        const result = resolveFromState(state, key, state.fieldStates[key]!.defaultValue, 'reset')
        if (result.success) outputs[key] = result.output
        else errors[key] = result.errors
      }
      if (Object.keys(errors).length > 0) return { errors, success: false }
      internalStore.setState((current) => applyOutputs(current, outputs, 'reset'))
      return { success: true }
    },
    setFieldInput(field, input) {
      const key = ownedFieldKey(field)
      if (key === undefined) return foreignFieldResult(field)
      const result = resolveFromState(internalStore.getState(), key, input, 'interactive')
      if (!result.success) {
        internalStore.setState((current) => ({
          fieldStates: {
            ...current.fieldStates,
            [key]: {
              ...current.fieldStates[key]!,
              draftValue: input,
              errors: [...result.errors],
              touched: true,
            },
          },
        }))
        return failure(key, result.errors)
      }
      internalStore.setState((current) =>
        applyOutputs(current, { [key]: result.output }, 'interactive'),
      )
      return { success: true }
    },
    setFieldValue(field, value) {
      const key = ownedFieldKey(field)
      if (key === undefined) return foreignFieldResult(field)
      return writeValues({ [key]: value }, 'programmatic')
    },
    setFieldValues(candidates) {
      return writeValues(candidates, 'programmatic')
    },
  }

  const initialState = { ...initialData, ...actions }
  internalStore = createStore<State>()(() => initialState)

  return Object.freeze({
    fields,
    getInitialState: internalStore.getInitialState,
    getState: internalStore.getState,
    ownsField: (field: unknown): field is PicodashField<Values, string> =>
      picodashOwnerOwnsField(owner, field),
    subscribe: internalStore.subscribe,
  })

  function ownedFieldKey(field: PicodashField<Values, string>): string | undefined {
    return picodashOwnerOwnsField(owner, field) && definitionKeys.has(field.key)
      ? field.key
      : undefined
  }

  function foreignFieldResult(field: PicodashField<Values, string>): PicodashWriteResult<Values> {
    const key = typeof field?.key === 'string' ? field.key : 'unknown'
    return failure(key, ['Field handle does not belong to this Picodash Store.'])
  }

  function resolveFromState(
    state: DataState,
    key: string,
    input: unknown,
    source: PicodashValidationSource,
  ) {
    return resolvePicodashFieldValue(
      definitions[key]!,
      fields[key]!,
      input,
      source,
      state.values[key],
      state.fieldStates[key]!.defaultValue,
    )
  }

  function writeValues(
    candidates: Partial<Values>,
    source: PicodashValidationSource,
  ): PicodashWriteResult<Values> {
    const state = internalStore.getState()
    const outputs: Record<string, PicodashFieldOutput<PicodashJsonValue>> = {}
    const errors: Record<string, readonly string[]> = {}
    for (const [key, input] of Object.entries(candidates)) {
      if (!definitionKeys.has(key)) {
        errors[key] = [`Unknown Picodash field "${key}".`]
        continue
      }
      const result = resolveFromState(state, key, input, source)
      if (result.success) outputs[key] = result.output
      else errors[key] = result.errors
    }
    if (Object.keys(errors).length > 0) return { errors, success: false }
    if (Object.keys(outputs).length > 0) {
      internalStore.setState((current) => applyOutputs(current, outputs, source))
    }
    return { success: true }
  }
}

function resolveUnset(
  definition: PicodashFieldDefinition<PicodashJsonValue>,
):
  | { readonly output: { readonly unset: true }; readonly success: true }
  | { readonly errors: readonly string[]; readonly success: false } {
  return definition.allowUnset
    ? { output: { unset: true }, success: true }
    : { errors: ['Field does not allow unset values.'], success: false }
}

function failure<TValues extends object>(
  key: string,
  errors: readonly string[],
): PicodashWriteResult<TValues> {
  return {
    errors: { [key]: errors } as PicodashWriteErrors<TValues>,
    success: false,
  }
}

function outputForValue(values: Values, key: string): PicodashFieldOutput<PicodashJsonValue> {
  return Object.prototype.hasOwnProperty.call(values, key)
    ? { value: values[key]! }
    : { unset: true }
}

function applyOutputs(
  state: DataState,
  outputs: Record<string, PicodashFieldOutput<PicodashJsonValue>>,
  source: PicodashValidationSource,
): DataState {
  if (Object.keys(outputs).length === 0) return state
  const values = { ...state.values }
  const fieldStates = { ...state.fieldStates }
  for (const [key, output] of Object.entries(outputs)) {
    const previous = fieldStates[key]!
    if ('unset' in output) delete values[key]
    else values[key] = clonePicodashValue(output.value)
    const nextField = {
      ...previous,
      dirty: !outputsEqual(output, { value: previous.defaultValue }),
      errors: [],
      touched: source === 'reset' ? false : source === 'initial' ? previous.touched : true,
    }
    delete (nextField as { draftValue?: unknown }).draftValue
    fieldStates[key] = nextField
  }
  const changed = new Set(Object.keys(outputs))
  const remainingRepairs =
    state.repairProposal?.changes.filter((change) => !changed.has(change.field.key)) ?? []
  return {
    ...state,
    fieldStates,
    repairProposal:
      state.repairProposal === null || remainingRepairs.length === 0
        ? null
        : { ...state.repairProposal, changes: remainingRepairs },
    values,
  }
}

function outputsEqual(
  left: PicodashFieldOutput<PicodashJsonValue>,
  right: PicodashFieldOutput<PicodashJsonValue>,
): boolean {
  if ('unset' in left || 'unset' in right) return 'unset' in left && 'unset' in right
  return deepEqual(left.value as PicodashJsonValue, right.value as PicodashJsonValue)
}

function deepEqual(left: PicodashJsonValue, right: PicodashJsonValue): boolean {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length && left.every((entry, index) => deepEqual(entry, right[index]!))
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
    const leftRecord = left as Readonly<Record<string, PicodashJsonValue>>
    const rightRecord = right as Readonly<Record<string, PicodashJsonValue>>
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key) =>
          Object.prototype.hasOwnProperty.call(right, key) &&
          deepEqual(leftRecord[key]!, rightRecord[key]!),
      )
    )
  }
  return false
}

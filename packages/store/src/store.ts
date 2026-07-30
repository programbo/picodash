import { createStore, type StoreApi } from 'zustand/vanilla'
import type { PicodashValueAdapter } from './adapter.js'
import { createPicodashDiagnosticChannel } from './diagnostics.js'
import {
  analyzePicodashPanelDocumentState,
  samePicodashPanelImportOutputs,
  type PicodashPanelImportAnalysis,
} from './documents.js'
import { createPicodashFields, picodashOwnerOwnsField } from './fields.js'
import {
  PICODASH_ERROR_CODES,
  type PicodashDiagnostic,
  type PicodashDiagnosticInput,
} from './errors.js'
import {
  initialPicodashInteractionState,
  removePicodashItemInteraction,
  setPicodashDraggingItem,
  setPicodashFocusedItem,
  setPicodashHoveredItem,
  setPicodashInteractionActive,
} from './interaction.js'
import {
  picodashRegisteredItemsEqual,
  picodashRootItemId,
  registeredWritableFields,
  resolvePicodashItemRegistration,
} from './items.js'
import { clonePicodashValue } from './json.js'
import {
  movePicodashItemRelativeTo,
  movePicodashItemToIndex,
  normalizePicodashOrders,
  normalizePicodashParentOrder,
  picodashItemCanReorder,
} from './order.js'
import type {
  PicodashField,
  PicodashFieldDefinition,
  PicodashFieldOutput,
  PicodashInferredFieldDefinition,
  PicodashInferredStoreOptions,
  PicodashItemMetadata,
  PicodashJsonValue,
  PicodashRegisteredItem,
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
type DataState = Pick<
  State,
  | 'diagnostics'
  | 'fieldStates'
  | 'interaction'
  | 'itemMetadata'
  | 'items'
  | 'panelId'
  | 'repairProposal'
  | 'values'
>

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
  const diagnosticChannel = createPicodashDiagnosticChannel()
  const adapter = options.adapter as PicodashValueAdapter<Values> | undefined
  const fields = createPicodashFields(options.fields, owner)
  const knownItems: Record<string, PicodashRegisteredItem<Values>> = {}
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
    diagnostics: diagnosticChannel.getSnapshot(),
    fieldStates,
    interaction: initialPicodashInteractionState,
    itemMetadata: cloneItemMetadata(options.initialItemMetadata),
    items: {},
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

  if (adapter !== undefined) {
    const adapterSnapshot = readAdapterSnapshot(adapter)
    if (adapterSnapshot.success) {
      const resolution = resolveAdapterSnapshot(adapterSnapshot.snapshot, initialData)
      if (resolution.success) {
        initialData = applyOutputs(initialData, resolution.outputs, 'adapter')
      } else {
        initialData = applyInvalidAdapterSnapshot(initialData, resolution)
        diagnosticChannel.publish(invalidAdapterSnapshotDiagnostic(resolution.errors))
      }
    } else {
      diagnosticChannel.publish(adapterSnapshot.diagnostic)
    }
    initialData = { ...initialData, diagnostics: diagnosticChannel.getSnapshot() }
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

      return commitOutputs(outputs, 'repair', new Set(), true)
    },
    analyzePanelDocument(document) {
      return analyzeDocument(document, internalStore.getState())
    },
    applyPanelImport(analysis) {
      const current = analyzeDocument(analysis.plan.document, internalStore.getState())
      if (current.status === 'invalid') {
        return { analysis: current, reason: 'invalid', success: false }
      }
      if (
        !samePicodashPanelImportOutputs(analysis.plan.outputs, current.plan.outputs) ||
        !stringArraysEqual(analysis.plan.resetFields, current.plan.resetFields)
      ) {
        return { analysis: current, reason: 'stale', success: false }
      }
      if (analysis.status === 'valid' && current.status === 'repair') {
        return { analysis: current, reason: 'repair-required', success: false }
      }
      const result = commitOutputs(
        current.plan.outputs as Record<string, PicodashFieldOutput<PicodashJsonValue>>,
        'import',
        new Set(current.plan.resetFields),
      )
      if (!result.success) {
        return { analysis: current, reason: 'stale', success: false }
      }
      return { analysis: current, success: true, values: current.values }
    },
    resetFieldValue(field) {
      const key = ownedFieldKey(field)
      if (key === undefined) return foreignFieldResult(field)
      const state = internalStore.getState()
      const result = resolveFromState(state, key, state.fieldStates[key]!.defaultValue, 'reset')
      if (!result.success) return failure(key, result.errors)
      return commitOutputs({ [key]: result.output }, 'reset')
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
      return commitOutputs(outputs, 'reset')
    },
    resetRegisteredFields() {
      const state = internalStore.getState()
      const outputs: Record<string, PicodashFieldOutput<PicodashJsonValue>> = {}
      const errors: Record<string, readonly string[]> = {}
      for (const field of registeredWritableFields(state.items)) {
        const key = field.key
        const result = resolveFromState(state, key, state.fieldStates[key]!.defaultValue, 'reset')
        if (result.success) outputs[key] = result.output
        else errors[key] = result.errors
      }
      if (Object.keys(errors).length > 0) return { errors, success: false }
      return commitOutputs(outputs, 'reset')
    },
    registerItem(registration) {
      const state = internalStore.getState()
      const result = resolvePicodashItemRegistration(
        registration,
        (field): field is PicodashField<Values, string> => picodashOwnerOwnsField(owner, field),
        state.items,
      )
      if (!result.success) return result

      const item = result.item
      const mountedItem = state.items[item.id]
      if (mountedItem !== undefined) {
        return picodashRegisteredItemsEqual(mountedItem, item)
          ? { success: true }
          : {
              errors: [
                {
                  code: 'duplicate-item-id',
                  itemId: item.id,
                  message: `Item "${item.id}" is already registered with a different contract.`,
                },
              ],
              success: false,
            }
      }
      const previous = knownItems[item.id]
      knownItems[item.id] = item
      internalStore.setState((current) => {
        const items = { ...current.items, [item.id]: item }
        let order = current.itemMetadata.order
        if (previous !== undefined && previous.parentId !== item.parentId) {
          order = {
            ...order,
            [previous.parentId]: (order[previous.parentId] ?? []).filter((id) => id !== item.id),
          }
        }
        if (!(order[item.parentId] ?? []).includes(item.id)) {
          order = {
            ...order,
            [item.parentId]: [...(order[item.parentId] ?? []), item.id],
          }
        }
        order = normalizePicodashOrders(order, items, knownItems)

        let collapsed = current.itemMetadata.collapsed
        if (item.collapsible && !Object.prototype.hasOwnProperty.call(collapsed, item.id)) {
          collapsed = { ...collapsed, [item.id]: item.defaultCollapsed }
        }
        return {
          itemMetadata: { collapsed, order },
          items,
        }
      })
      return { success: true }
    },
    moveItemRelativeTo(itemId, overId, position) {
      internalStore.setState((state) => {
        const order = movePicodashItemRelativeTo(
          state.items,
          state.itemMetadata.order,
          itemId,
          overId,
          position,
        )
        return order === state.itemMetadata.order
          ? state
          : { itemMetadata: { ...state.itemMetadata, order } }
      })
    },
    moveItemToIndex(itemId, index) {
      internalStore.setState((state) => {
        const order = movePicodashItemToIndex(state.items, state.itemMetadata.order, itemId, index)
        return order === state.itemMetadata.order
          ? state
          : { itemMetadata: { ...state.itemMetadata, order } }
      })
    },
    setAllCollapsibleItemsCollapsed(collapsed) {
      internalStore.setState((state) => {
        const itemIds = Object.values(state.items)
          .filter((item) => item.collapsible && !item.hidden)
          .map((item) => item.id)
        if (
          itemIds.every(
            (itemId) =>
              (state.itemMetadata.collapsed[itemId] ??
                state.items[itemId]?.defaultCollapsed ??
                false) === collapsed,
          )
        ) {
          return state
        }
        return {
          itemMetadata: {
            ...state.itemMetadata,
            collapsed: {
              ...state.itemMetadata.collapsed,
              ...Object.fromEntries(itemIds.map((itemId) => [itemId, collapsed])),
            },
          },
        }
      })
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
      return commitOutputs({ [key]: result.output }, 'interactive')
    },
    setFieldValue(field, value) {
      const key = ownedFieldKey(field)
      if (key === undefined) return foreignFieldResult(field)
      return writeValues({ [key]: value }, 'programmatic')
    },
    setFieldValues(candidates) {
      return writeValues(candidates, 'programmatic')
    },
    setFocusedItem(itemId) {
      internalStore.setState((state) => {
        const interaction = setPicodashFocusedItem(state.interaction, itemId)
        return interaction === state.interaction ? state : { interaction }
      })
    },
    setHoveredItem(itemId) {
      internalStore.setState((state) => {
        const interaction = setPicodashHoveredItem(state.interaction, itemId)
        return interaction === state.interaction ? state : { interaction }
      })
    },
    setInteractionActive(interactionId, active) {
      internalStore.setState((state) => {
        const interaction = setPicodashInteractionActive(state.interaction, interactionId, active)
        return interaction === state.interaction ? state : { interaction }
      })
    },
    setItemCollapsed(itemId, collapsed) {
      internalStore.setState((state) => {
        const item = state.items[itemId]
        if (item === undefined || !item.collapsible) return state
        if ((state.itemMetadata.collapsed[itemId] ?? item.defaultCollapsed) === collapsed) {
          return state
        }
        return {
          itemMetadata: {
            ...state.itemMetadata,
            collapsed: { ...state.itemMetadata.collapsed, [itemId]: collapsed },
          },
        }
      })
    },
    setDraggingItem(itemId) {
      internalStore.setState((state) => {
        if (itemId !== null && !picodashItemCanReorder(state.items, itemId)) return state
        const interaction = setPicodashDraggingItem(state.interaction, itemId)
        return interaction === state.interaction ? state : { interaction }
      })
    },
    setItemOrder(parentId, itemIds) {
      internalStore.setState((state) => {
        const nextParentOrder = normalizePicodashParentOrder(itemIds, knownItems, parentId, true)
        const previousParentOrder = state.itemMetadata.order[parentId] ?? []
        if (
          previousParentOrder.length === nextParentOrder.length &&
          previousParentOrder.every((id, index) => nextParentOrder[index] === id)
        ) {
          return state
        }
        return {
          itemMetadata: {
            ...state.itemMetadata,
            order: { ...state.itemMetadata.order, [parentId]: nextParentOrder },
          },
        }
      })
    },
    unregisterItem(itemId) {
      internalStore.setState((state) => {
        if (state.items[itemId] === undefined) return state
        const items = { ...state.items }
        delete items[itemId]
        return {
          interaction: removePicodashItemInteraction(state.interaction, itemId),
          items,
        }
      })
    },
  }

  const initialState = { ...initialData, ...actions }
  internalStore = createStore<State>()(() => initialState)
  diagnosticChannel.subscribe((diagnostics) => {
    internalStore.setState({ diagnostics })
  })
  let handlingAdapterWrite = false
  if (adapter !== undefined) {
    try {
      adapter.subscribe(() => {
        if (handlingAdapterWrite) return
        synchronizeAdapterSnapshot()
      })
    } catch {
      diagnosticChannel.publish({
        code: PICODASH_ERROR_CODES.INVALID_CONTRACT,
        correction: 'Return an unsubscribe function after registering the listener.',
        expectedContract: 'subscribe(listener) synchronously registers a snapshot listener.',
        identity: adapterIdentity(),
        summary: 'The external value adapter threw while Picodash subscribed.',
      })
    }
  }

  return Object.freeze({
    diagnostics: diagnosticChannel,
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

  function analyzeDocument(
    document: unknown,
    state: DataState,
  ): PicodashPanelImportAnalysis<Values> {
    return analyzePicodashPanelDocumentState(document, state, {
      resolve(field, input, source) {
        return resolveFromState(state, field, input, source)
      },
    })
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
    return commitOutputs(outputs, source)
  }

  function commitOutputs(
    outputs: Record<string, PicodashFieldOutput<PicodashJsonValue>>,
    source: PicodashValidationSource,
    resetFields: ReadonlySet<string> = new Set(),
    clearRepair = false,
  ): PicodashWriteResult<Values> {
    if (Object.keys(outputs).length === 0) return { success: true }
    const current = internalStore.getState()
    let next = applyOutputs(current, outputs, source, resetFields)
    if (clearRepair) next = { ...next, repairProposal: null }
    if (adapter !== undefined) {
      const adapterResult = writeAdapterValues(adapter, next.values, current.values, source)
      if (!adapterResult.success) {
        return { diagnostic: adapterResult.diagnostic, errors: {}, success: false }
      }
    }
    diagnosticChannel.clear(PICODASH_ERROR_CODES.INVALID_ADAPTER_SNAPSHOT)
    diagnosticChannel.clear(PICODASH_ERROR_CODES.NON_SYNCHRONOUS_WRITE)
    diagnosticChannel.clear(PICODASH_ERROR_CODES.REJECTED_WRITE)
    internalStore.setState({ ...next, diagnostics: diagnosticChannel.getSnapshot() })
    return { success: true }
  }

  function writeAdapterValues(
    targetAdapter: PicodashValueAdapter<Values>,
    nextValues: Values,
    previousValues: Values,
    source: PicodashValidationSource,
  ):
    | { readonly success: true }
    | { readonly diagnostic: PicodashDiagnostic; readonly success: false } {
    const completeRecord = clonePicodashValue(nextValues) as Values
    let result: boolean | undefined | void | PromiseLike<unknown>
    handlingAdapterWrite = true
    try {
      result = targetAdapter.setValues(completeRecord, {
        panelId: options.panelId,
        previousValues: clonePicodashValue(previousValues) as Values,
        source: source as Exclude<PicodashValidationSource, 'adapter' | 'default' | 'initial'>,
      })
    } catch {
      const diagnostic = publishAdapterWriteDiagnostic(
        PICODASH_ERROR_CODES.REJECTED_WRITE,
        'The external value adapter threw while accepting a complete Picodash value record.',
      )
      return { diagnostic, success: false }
    } finally {
      handlingAdapterWrite = false
    }

    if (isPromiseLike(result)) {
      const diagnostic = publishAdapterWriteDiagnostic(
        PICODASH_ERROR_CODES.NON_SYNCHRONOUS_WRITE,
        'The external value adapter returned a Promise from setValues.',
      )
      return { diagnostic, success: false }
    }
    if (result === false) {
      const diagnostic = publishAdapterWriteDiagnostic(
        PICODASH_ERROR_CODES.REJECTED_WRITE,
        'The external value adapter rejected the complete Picodash value record.',
      )
      return { diagnostic, success: false }
    }

    const snapshotResult = readAdapterSnapshot(targetAdapter)
    if (!snapshotResult.success) {
      diagnosticChannel.publish(snapshotResult.diagnostic)
      return snapshotResult
    }
    const resolution = resolveAdapterSnapshot(snapshotResult.snapshot, internalStore.getState())
    if (!resolution.success) {
      const diagnostic = diagnosticChannel.publish(
        invalidAdapterSnapshotDiagnostic(resolution.errors),
      )
      return { diagnostic, success: false }
    }
    const acknowledged = applyOutputs(
      internalStore.getState(),
      resolution.outputs,
      'adapter',
    ).values
    if (!deepEqual(acknowledged, nextValues)) {
      const diagnostic = publishAdapterWriteDiagnostic(
        PICODASH_ERROR_CODES.REJECTED_WRITE,
        'The external value adapter did not synchronously expose the complete value record it received.',
      )
      return { diagnostic, success: false }
    }
    return { success: true }
  }

  function synchronizeAdapterSnapshot(): void {
    if (adapter === undefined) return
    const snapshotResult = readAdapterSnapshot(adapter)
    if (!snapshotResult.success) {
      diagnosticChannel.publish(snapshotResult.diagnostic)
      return
    }
    const state = internalStore.getState()
    const resolution = resolveAdapterSnapshot(snapshotResult.snapshot, state)
    if (!resolution.success) {
      internalStore.setState(applyInvalidAdapterSnapshot(state, resolution))
      diagnosticChannel.publish(invalidAdapterSnapshotDiagnostic(resolution.errors))
      return
    }
    diagnosticChannel.clear(PICODASH_ERROR_CODES.INVALID_ADAPTER_SNAPSHOT)
    const current = internalStore.getState()
    const next = applyOutputs(current, resolution.outputs, 'adapter')
    if (!deepEqual(next.values, current.values)) internalStore.setState(next)
  }

  function resolveAdapterSnapshot(snapshot: unknown, state: DataState): AdapterSnapshotResolution {
    if (!isRecord(snapshot)) {
      return {
        errors: { adapter: ['Adapter snapshots must be complete value records.'] },
        repairs: [],
        success: false,
      }
    }
    const outputs: Record<string, PicodashFieldOutput<PicodashJsonValue>> = {}
    const errors: Record<string, readonly string[]> = {}
    const repairs: PicodashRepairChange<Values>[] = []
    for (const key of Object.keys(snapshot)) {
      if (!definitionKeys.has(key)) errors[key] = [`Unknown Picodash field "${key}".`]
    }
    for (const key of definitionKeys) {
      if (!Object.prototype.hasOwnProperty.call(snapshot, key)) {
        const unset = resolveUnset(definitions[key]!)
        if (unset.success) outputs[key] = unset.output
        else errors[key] = ['Adapter snapshots must include every required Picodash field.']
        continue
      }
      const result = resolveFromState(state, key, snapshot[key], 'adapter')
      if (result.success) {
        outputs[key] = result.output
      } else if (result.repair !== undefined) {
        errors[key] = result.errors
        repairs.push({
          after: result.repair,
          before: outputForValue(state.values, key),
          errors: result.errors,
          field: fields[key]!,
        })
      } else {
        errors[key] = result.errors
      }
    }
    return Object.keys(errors).length === 0
      ? { outputs, success: true }
      : { errors, repairs, success: false }
  }

  function applyInvalidAdapterSnapshot(
    state: DataState,
    resolution: Extract<AdapterSnapshotResolution, { success: false }>,
  ): DataState {
    const nextFieldStates = { ...state.fieldStates }
    for (const [key, errors] of Object.entries(resolution.errors)) {
      if (nextFieldStates[key] !== undefined) {
        nextFieldStates[key] = { ...nextFieldStates[key]!, errors: [...errors] }
      }
    }
    return {
      ...state,
      fieldStates: nextFieldStates,
      repairProposal:
        resolution.repairs.length === 0 ? null : { changes: resolution.repairs, source: 'adapter' },
    }
  }

  function readAdapterSnapshot(
    targetAdapter: PicodashValueAdapter<Values>,
  ):
    | { readonly snapshot: unknown; readonly success: true }
    | { readonly diagnostic: PicodashDiagnostic; readonly success: false } {
    try {
      const snapshot = targetAdapter.getSnapshot()
      if (isPromiseLike(snapshot)) {
        return {
          diagnostic: diagnosticChannel.publish({
            code: PICODASH_ERROR_CODES.ASYNC_CONTRACT,
            correction: 'Return the current complete value record directly from getSnapshot.',
            expectedContract: 'getSnapshot() is synchronous and never returns a Promise.',
            identity: adapterIdentity(),
            summary: 'The external value adapter returned an asynchronous snapshot.',
          }),
          success: false,
        }
      }
      return { snapshot, success: true }
    } catch {
      return {
        diagnostic: diagnosticChannel.publish({
          code: PICODASH_ERROR_CODES.INVALID_ADAPTER_SNAPSHOT,
          correction: 'Make getSnapshot return the current complete and valid value record.',
          expectedContract: 'getSnapshot() is synchronous, total, and returns a complete record.',
          identity: adapterIdentity(),
          summary: 'The external value adapter threw while reading its snapshot.',
        }),
        success: false,
      }
    }
  }

  function invalidAdapterSnapshotDiagnostic(
    errors: Readonly<Record<string, readonly string[]>>,
  ): PicodashDiagnosticInput {
    const keys = Object.keys(errors).sort()
    return {
      code: PICODASH_ERROR_CODES.INVALID_ADAPTER_SNAPSHOT,
      correction: 'Provide one complete record whose values satisfy every declared field contract.',
      expectedContract: 'getSnapshot() returns a complete, valid Picodash value record.',
      identity: adapterIdentity(),
      summary: `The external value adapter snapshot is invalid${keys.length === 0 ? '' : ` for ${keys.join(', ')}`}.`,
    }
  }

  function publishAdapterWriteDiagnostic(
    code:
      | typeof PICODASH_ERROR_CODES.NON_SYNCHRONOUS_WRITE
      | typeof PICODASH_ERROR_CODES.REJECTED_WRITE,
    summary: string,
  ): PicodashDiagnostic {
    return diagnosticChannel.publish({
      code,
      correction:
        'Accept the complete record synchronously and expose it from getSnapshot before returning.',
      expectedContract:
        'setValues(nextValues, context) is synchronous, atomic, and host-authoritative.',
      identity: adapterIdentity(),
      summary,
    })
  }

  function adapterIdentity() {
    return {
      adapterId: adapter?.id,
      panelId: options.panelId,
    }
  }
}

type AdapterSnapshotResolution =
  | {
      readonly outputs: Record<string, PicodashFieldOutput<PicodashJsonValue>>
      readonly success: true
    }
  | {
      readonly errors: Readonly<Record<string, readonly string[]>>
      readonly repairs: readonly PicodashRepairChange<Values>[]
      readonly success: false
    }

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof (value as { readonly then?: unknown }).then === 'function'
  )
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
  resetFields: ReadonlySet<string> = new Set(),
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
      touched:
        source === 'reset' || resetFields.has(key)
          ? false
          : source === 'initial'
            ? previous.touched
            : true,
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

function stringArraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => right[index] === value)
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

function cloneItemMetadata(metadata: PicodashItemMetadata | undefined): PicodashItemMetadata {
  const collapsed: Record<string, boolean> = {}
  for (const [itemId, value] of Object.entries(metadata?.collapsed ?? {})) {
    if (typeof value !== 'boolean') {
      throw new TypeError(`Invalid collapsed metadata for Picodash item "${itemId}".`)
    }
    collapsed[itemId] = value
  }

  const order: Record<string, readonly string[]> = {
    [picodashRootItemId]: [],
  }
  for (const [parentId, itemIds] of Object.entries(metadata?.order ?? {})) {
    if (!Array.isArray(itemIds) || itemIds.some((itemId) => typeof itemId !== 'string')) {
      throw new TypeError(`Invalid order metadata for Picodash parent "${parentId}".`)
    }
    order[parentId] = [...new Set(itemIds)]
  }
  return { collapsed, order }
}

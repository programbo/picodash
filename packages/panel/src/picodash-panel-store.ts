import { createStore } from 'zustand'
import {
  collapsibleGroupsForState,
  registeredWritableFieldIdsForState,
} from './picodash-panel-action-state.js'
import { bandForItem, itemCanReorder, normalizeAllOrders, rootGroupId } from './picodash-order.js'
import type {
  PicodashFieldState,
  PicodashItemRegistration,
  PicodashPanelState,
  PicodashPanelStore,
  PicodashPin,
  PicodashValue,
} from './picodash-panel-types.js'
import {
  analyzePicodashFieldConstraint,
  jsonValuesEqual,
  resolvePicodashFieldValue,
  type PicodashFieldOutput,
  type PicodashValidationSource,
} from './picodash-validation.js'

export function createPicodashPanelStore({
  initialValues,
  initialMeta,
  panelId,
}: {
  initialValues?: Record<string, PicodashValue>
  initialMeta?: Record<string, PicodashValue>
  panelId: string
}): PicodashPanelStore {
  const isolatedInitialValues = clonePicodashRecord(initialValues)
  const isolatedInitialMeta = clonePicodashRecord(initialMeta)
  let repairToken = 0
  const registrationHistory = new Map<
    string,
    Pick<PicodashItemRegistration, 'defaultValue' | 'field' | 'parentId'>
  >()

  const reconcileFieldAfterContractRemoval = (
    state: PicodashPanelState,
    field: string,
  ): PicodashPanelState => {
    const remainingProposal = repairProposalWithoutField(state.repairProposal, field)
    const defaultConflict = conflictingDefaultError(state.items, field)
    if (defaultConflict !== undefined) {
      return {
        ...state,
        fields: {
          ...state.fields,
          [field]: {
            ...(state.fields[field] ?? emptyField()),
            errors: [defaultConflict],
          },
        },
        repairProposal: remainingProposal,
      }
    }

    const analysis = analyzePicodashFieldConstraint(state, field, 'constraint')
    if (analysis.status === 'invalid') {
      return {
        ...state,
        fields: {
          ...state.fields,
          [field]: {
            ...(state.fields[field] ?? emptyField()),
            errors: [...analysis.errors],
          },
        },
        repairProposal: remainingProposal,
      }
    }
    if (analysis.status === 'repair') {
      return {
        ...state,
        repairProposal: {
          changes: [...(remainingProposal?.changes ?? []), analysis.repair],
          source: 'constraint',
          token: ++repairToken,
        },
      }
    }

    const fieldState = state.fields[field]
    if (
      fieldState !== undefined &&
      Object.prototype.hasOwnProperty.call(fieldState, 'draftValue')
    ) {
      const draftResolution = resolvePicodashFieldValue(
        state,
        field,
        fieldState.draftValue,
        'interactive',
      )
      if (!draftResolution.success) {
        return {
          ...state,
          fields: {
            ...state.fields,
            [field]: { ...fieldState, errors: [...draftResolution.errors] },
          },
          repairProposal: remainingProposal,
        }
      }

      const reconciledField = { ...fieldState, errors: [] }
      delete reconciledField.draftValue
      return {
        ...state,
        fields: { ...state.fields, [field]: reconciledField },
        repairProposal: remainingProposal,
      }
    }
    return {
      ...state,
      fields:
        fieldState !== undefined && fieldState.errors.length > 0
          ? {
              ...state.fields,
              [field]: { ...fieldState, errors: [] },
            }
          : state.fields,
      repairProposal: remainingProposal,
    }
  }

  const store = createStore<PicodashPanelState>()((set) => ({
    collapsedGroups: {},
    fields: {},
    interaction: { activeIds: {}, draggingId: null, focusedId: null, hoveredId: null },
    items: {},
    meta: isolatedInitialMeta,
    order: { [rootGroupId]: [] },
    panelId,
    repairProposal: null,
    values: isolatedInitialValues,
    abortRepairProposal() {
      set((state) => {
        const proposal = state.repairProposal
        if (proposal === null) return state
        const fields = { ...state.fields }
        for (const change of proposal.changes) {
          fields[change.field] = {
            ...(fields[change.field] ?? emptyField()),
            errors: [...change.errors],
          }
        }
        return { fields, repairProposal: null }
      })
    },
    acceptRepairProposal() {
      const state = getStoreState()
      const proposal = state.repairProposal
      if (proposal === null) return { success: true }
      const outputs: Record<string, PicodashFieldOutput> = {}
      const errors: Record<string, readonly string[]> = {}
      for (const expected of proposal.changes) {
        const current = analyzePicodashFieldConstraint(state, expected.field, proposal.source)
        if (
          current.status !== 'repair' ||
          !outputsMatch(current.repair.before, expected.before) ||
          !outputsMatch(current.repair.after, expected.after)
        ) {
          errors[expected.field] = [
            ...(current.status === 'invalid'
              ? current.errors
              : ['Panel constraints or values changed while the repair was awaiting review.']),
          ]
          continue
        }
        outputs[expected.field] = current.repair.after
      }
      if (Object.keys(errors).length > 0) return { errors, success: false }
      set((current) => ({
        ...applyOutputsState(current, outputs, { preserveMeta: true }),
        repairProposal: null,
      }))
      return { success: true }
    },
    registerItem(item) {
      const historicalRegistration = registrationHistory.get(item.id)
      registrationHistory.set(item.id, {
        defaultValue: item.defaultValue,
        field: item.field,
        parentId: item.parentId,
      })

      set((state) => {
        const mountedRegistration = state.items[item.id]
        const previous = mountedRegistration ?? historicalRegistration
        const items = { ...state.items, [item.id]: item }
        let order = state.order

        if (previous?.parentId && previous.parentId !== item.parentId) {
          order = removeFromParentOrder(order, previous.parentId, item.id)
        }

        const parentOrder = order[item.parentId] ?? []
        const reclaimsOrderSlot = mountedRegistration === undefined && parentOrder.includes(item.id)
        if (!parentOrder.includes(item.id)) {
          order = { ...order, [item.parentId]: [...parentOrder, item.id] }
        } else if (order === state.order) {
          order = { ...order }
        }

        if (item.kind === 'group' && !order[item.id]) {
          order[item.id] = []
        }

        const field = itemField(item)
        const previousField = previous?.field
        const fieldState = field === undefined ? undefined : state.fields[field]
        const declaredDefaultChanged =
          previous !== undefined &&
          previousField === field &&
          !defaultsEqual(previous.defaultValue, item.defaultValue)
        const remountingWithSharedField =
          mountedRegistration === undefined &&
          historicalRegistration !== undefined &&
          field !== undefined &&
          Object.values(state.items).some(
            (registeredItem) =>
              registeredItem.id !== item.id && itemField(registeredItem) === field,
          )
        const registeredDefaultValue =
          field === undefined
            ? undefined
            : fieldState === undefined || (declaredDefaultChanged && !remountingWithSharedField)
              ? item.defaultValue
              : fieldState.defaultValue
        const fields =
          field === undefined
            ? state.fields
            : {
                ...state.fields,
                [field]: {
                  ...(fieldState ?? emptyField()),
                  defaultValue: registeredDefaultValue,
                },
              }
        const values =
          field === undefined ||
          Object.prototype.hasOwnProperty.call(state.values, field) ||
          registeredDefaultValue === undefined
            ? state.values
            : { ...state.values, [field]: registeredDefaultValue }

        const nextState = {
          ...state,
          fields,
          items,
          order: reclaimsOrderSlot ? order : normalizeAllOrders(order, items),
          values,
        }
        const reconciledState =
          mountedRegistration !== undefined &&
          previousField !== undefined &&
          previousField !== field
            ? reconcileFieldAfterContractRemoval(nextState, previousField)
            : nextState
        if (field === undefined) return reconciledState
        const remainingProposal = repairProposalWithoutField(reconciledState.repairProposal, field)
        const defaultConflict = conflictingDefaultError(items, field)
        if (defaultConflict !== undefined) {
          return {
            ...reconciledState,
            fields: {
              ...reconciledState.fields,
              [field]: {
                ...(reconciledState.fields[field] ?? emptyField()),
                errors: [defaultConflict],
              },
            },
            repairProposal: remainingProposal,
          }
        }
        const validationSource =
          mountedRegistration === undefined &&
          historicalRegistration === undefined &&
          !Object.values(state.items).some((registeredItem) => itemField(registeredItem) === field)
            ? Object.prototype.hasOwnProperty.call(state.values, field)
              ? 'initial'
              : 'default'
            : 'constraint'
        const analysis = analyzePicodashFieldConstraint(reconciledState, field, validationSource)
        if (analysis.status === 'invalid') {
          return {
            ...reconciledState,
            fields: {
              ...reconciledState.fields,
              [field]: {
                ...(reconciledState.fields[field] ?? emptyField()),
                errors: [...analysis.errors],
              },
            },
            repairProposal: remainingProposal,
          }
        }
        if (analysis.status === 'valid') {
          const registeredFieldState = reconciledState.fields[field]
          return {
            ...reconciledState,
            fields:
              registeredFieldState !== undefined &&
              !Object.prototype.hasOwnProperty.call(registeredFieldState, 'draftValue') &&
              registeredFieldState?.errors.length
                ? {
                    ...reconciledState.fields,
                    [field]: { ...registeredFieldState, errors: [] },
                  }
                : reconciledState.fields,
            repairProposal: remainingProposal,
          }
        }
        return {
          ...reconciledState,
          repairProposal: {
            changes: [...(remainingProposal?.changes ?? []), analysis.repair],
            source: validationSource,
            token: ++repairToken,
          },
        }
      })
    },
    moveItemToIndex(itemId, index) {
      set((state) => {
        const item = state.items[itemId]
        if (!item || !itemCanReorder(state, itemId)) return state

        const parentOrder = state.order[item.parentId] ?? []
        const visibleBandOrder = parentOrder.filter((id) => {
          const orderedItem = state.items[id]
          return (
            orderedItem?.parentId === item.parentId &&
            orderedItem.pin === item.pin &&
            !orderedItem.hidden
          )
        })
        const from = visibleBandOrder.indexOf(itemId)
        if (from < 0) return state

        const maxIndex = Math.max(visibleBandOrder.length - 1, 0)
        const to = Math.min(Math.max(Math.round(index), 0), maxIndex)
        if (from === to) return state

        const nextVisibleBandOrder = [...visibleBandOrder]
        nextVisibleBandOrder.splice(from, 1)
        nextVisibleBandOrder.splice(to, 0, itemId)

        return {
          order: normalizeAllOrders(
            {
              ...state.order,
              [item.parentId]: replaceVisibleBandOrder(
                parentOrder,
                nextVisibleBandOrder,
                state,
                item.parentId,
                item.pin,
              ),
            },
            state.items,
          ),
        }
      })
    },
    moveItemRelativeTo(itemId, overId, position) {
      set((state) => {
        const item = state.items[itemId]
        const over = state.items[overId]
        if (!item || !over || !itemCanReorder(state, itemId)) return state
        if (item.parentId !== over.parentId || item.pin !== over.pin) return state

        const parentOrder = state.order[item.parentId] ?? []
        const visibleBandOrder = parentOrder.filter((id) => {
          const orderedItem = state.items[id]
          return (
            orderedItem?.parentId === item.parentId &&
            orderedItem.pin === item.pin &&
            !orderedItem.hidden
          )
        })
        if (!visibleBandOrder.includes(itemId) || !visibleBandOrder.includes(overId)) return state

        const nextVisibleBandOrder = visibleBandOrder.filter((id) => id !== itemId)
        const overIndex = nextVisibleBandOrder.indexOf(overId)
        if (overIndex < 0) return state

        nextVisibleBandOrder.splice(position === 'after' ? overIndex + 1 : overIndex, 0, itemId)
        if (
          visibleBandOrder.every((id, currentIndex) => nextVisibleBandOrder[currentIndex] === id)
        ) {
          return state
        }

        return {
          order: normalizeAllOrders(
            {
              ...state.order,
              [item.parentId]: replaceVisibleBandOrder(
                parentOrder,
                nextVisibleBandOrder,
                state,
                item.parentId,
                item.pin,
              ),
            },
            state.items,
          ),
        }
      })
    },
    reorderItem(activeId, overId) {
      set((state) => {
        const active = state.items[activeId]
        const over = state.items[overId]
        if (!active || !over) return state
        if (!itemCanReorder(state, activeId) || active.parentId !== over.parentId) return state
        if (bandForItem(active) !== bandForItem(over)) return state

        const parentOrder = state.order[active.parentId] ?? []
        const from = parentOrder.indexOf(activeId)
        const to = parentOrder.indexOf(overId)
        if (from < 0 || to < 0 || from === to) return state

        const nextOrder = [...parentOrder]
        nextOrder.splice(from, 1)
        nextOrder.splice(to, 0, activeId)
        return {
          order: normalizeAllOrders({ ...state.order, [active.parentId]: nextOrder }, state.items),
        }
      })
    },
    resetFieldValue(fieldId) {
      const state = getStoreState()
      if (fieldIsDisplayOnly(state, fieldId)) {
        return {
          errors: { [fieldId]: ['Display fields cannot be edited.'] },
          success: false,
        }
      }
      const field = state.fields[fieldId]
      const result =
        field?.defaultValue === undefined
          ? ({ output: { unset: true }, success: true } as const)
          : resolvePicodashFieldValue(state, fieldId, field.defaultValue, 'reset')
      if (!result.success) {
        return { errors: { [fieldId]: result.errors }, success: false }
      }
      set((current) =>
        applyOutputsState(current, { [fieldId]: result.output }, { resetMeta: true }),
      )
      return { success: true }
    },
    resetFields() {
      const state = getStoreState()
      const outputs: Record<string, PicodashFieldOutput> = {}
      const errors: Record<string, readonly string[]> = {}
      for (const [fieldId, field] of Object.entries(state.fields)) {
        if (fieldIsDisplayOnly(state, fieldId)) continue
        const result =
          field.defaultValue === undefined
            ? ({ output: { unset: true }, success: true } as const)
            : resolvePicodashFieldValue(state, fieldId, field.defaultValue, 'reset')
        if (result.success) outputs[fieldId] = result.output
        else errors[fieldId] = result.errors
      }
      if (Object.keys(errors).length > 0) return { errors, success: false }
      set((current) => applyOutputsState(current, outputs, { resetMeta: true }))
      return { success: true }
    },
    resetRegisteredFields() {
      const state = getStoreState()
      const outputs: Record<string, PicodashFieldOutput> = {}
      const errors: Record<string, readonly string[]> = {}
      for (const fieldId of registeredWritableFieldIdsForState(state)) {
        const defaultValue = state.fields[fieldId]?.defaultValue
        const result =
          defaultValue === undefined
            ? ({ output: { unset: true }, success: true } as const)
            : resolvePicodashFieldValue(state, fieldId, defaultValue, 'reset')
        if (result.success) outputs[fieldId] = result.output
        else errors[fieldId] = result.errors
      }
      if (Object.keys(errors).length > 0) return { errors, success: false }
      set((current) => applyOutputsState(current, outputs, { resetMeta: true }))
      return { success: true }
    },
    applyRegisteredFieldOutputs(outputs, options) {
      set((state) =>
        applyOutputsState(state, outputs, {
          preserveMeta: options?.preserveMeta,
          resetFields: options?.resetFields,
        }),
      )
    },
    replaceRegisteredFieldValues(importedValues) {
      const state = getStoreState()
      const outputs: Record<string, PicodashFieldOutput> = {}
      const errors: Record<string, readonly string[]> = {}
      const resetFields: string[] = []
      for (const fieldId of registeredWritableFieldIdsForState(state)) {
        const hasImportedValue = Object.prototype.hasOwnProperty.call(importedValues, fieldId)
        const candidate = hasImportedValue
          ? importedValues[fieldId]
          : state.fields[fieldId]?.defaultValue
        const result =
          candidate === undefined
            ? ({ output: { unset: true }, success: true } as const)
            : resolvePicodashFieldValue(
                state,
                fieldId,
                candidate,
                hasImportedValue ? 'import' : 'default',
              )
        if (result.success) outputs[fieldId] = result.output
        else errors[fieldId] = result.errors
        if (!hasImportedValue) resetFields.push(fieldId)
      }
      if (Object.keys(errors).length > 0) return { errors, success: false }
      set((current) => applyOutputsState(current, outputs, { resetFields }))
      return { success: true }
    },
    setFieldDefault(fieldId, value) {
      const state = getStoreState()
      const resolution =
        value === undefined
          ? undefined
          : resolvePicodashFieldValue(state, fieldId, value, 'default')
      if (resolution !== undefined && !resolution.success) return

      const resolvedDefault =
        resolution?.success === true
          ? 'unset' in resolution.output
            ? undefined
            : resolution.output.value
          : value
      const insertsValue =
        resolvedDefault !== undefined &&
        !Object.prototype.hasOwnProperty.call(state.values, fieldId)
      set((current) => ({
        fields: {
          ...current.fields,
          [fieldId]: {
            ...(current.fields[fieldId] ?? emptyField()),
            defaultValue: resolvedDefault,
          },
        },
        values:
          !insertsValue || resolution?.success !== true || 'unset' in resolution.output
            ? current.values
            : { ...current.values, [fieldId]: resolution.output.value },
      }))
    },
    setFieldValue(fieldId, value) {
      return writeFieldValues(getStoreState(), { [fieldId]: value }, 'programmatic', set)
    },
    setFieldValues(values) {
      return writeFieldValues(getStoreState(), values, 'programmatic', set)
    },
    setFieldInput(fieldId, value) {
      const state = getStoreState()
      if (fieldIsDisplayOnly(state, fieldId)) {
        return {
          errors: { [fieldId]: ['Display fields cannot be edited.'] },
          success: false,
        }
      }
      const result = resolvePicodashFieldValue(state, fieldId, value, 'interactive')
      if (!result.success) {
        set((current) => ({
          fields: {
            ...current.fields,
            [fieldId]: {
              ...(current.fields[fieldId] ?? emptyField()),
              draftValue: value,
              errors: [...result.errors],
              touched: true,
            },
          },
        }))
        return { errors: { [fieldId]: result.errors }, success: false }
      }
      set((current) => applyOutputsState(current, { [fieldId]: result.output }))
      return { success: true }
    },
    setFocusedItem(itemId) {
      set((state) =>
        state.interaction.focusedId === itemId
          ? state
          : { interaction: { ...state.interaction, focusedId: itemId } },
      )
    },
    setGroupCollapsed(groupId, collapsed) {
      set((state) => ({
        collapsedGroups: { ...state.collapsedGroups, [groupId]: collapsed },
      }))
    },
    setAllCollapsibleGroupsCollapsed(collapsed) {
      set((state) => {
        const groups = collapsibleGroupsForState(state)
        if (groups.every((group) => group.collapsed === collapsed)) {
          return state
        }

        return {
          collapsedGroups: {
            ...state.collapsedGroups,
            ...Object.fromEntries(groups.map((group) => [group.id, collapsed])),
          },
        }
      })
    },
    setHoveredItem(itemId) {
      set((state) =>
        state.interaction.draggingId || state.interaction.hoveredId === itemId
          ? state
          : { interaction: { ...state.interaction, hoveredId: itemId } },
      )
    },
    setInteractionActive(interactionId, active) {
      set((state) => {
        if (state.interaction.draggingId && interactionId.startsWith('pointer:')) return state

        const activeIds = { ...state.interaction.activeIds }
        if (active) activeIds[interactionId] = true
        else delete activeIds[interactionId]
        return { interaction: { ...state.interaction, activeIds } }
      })
    },
    setDraggingItem(itemId) {
      set((state) => {
        if (itemId !== null && !itemCanReorder(state, itemId)) return state

        const activeIds =
          itemId === null
            ? Object.fromEntries(
                Object.entries(state.interaction.activeIds).filter(
                  ([activeId]) => !activeId.startsWith('pointer:'),
                ),
              )
            : state.interaction.activeIds
        return { interaction: { ...state.interaction, activeIds, draggingId: itemId } }
      })
    },
    setMetaValue(key, value) {
      set((state) => ({ meta: { ...state.meta, [key]: value } }))
    },
    setOrder(parentId, itemIds) {
      set((state) => ({
        order: normalizeAllOrders({ ...state.order, [parentId]: itemIds }, state.items),
      }))
    },
    unregisterItem(itemId) {
      set((state) => {
        const item = state.items[itemId]
        if (!item || state.interaction.draggingId) return state

        const items = { ...state.items }
        delete items[itemId]
        // Registrations can unmount transiently while Reorder rebuilds its layout.
        // Keep parent and nested order slots so the same id reclaims its position.
        const field = itemField(item)
        if (field === undefined) return { items }

        const nextState = { ...state, items }
        return reconcileFieldAfterContractRemoval(nextState, field)
      })
    },
  }))

  function getStoreState(): PicodashPanelState {
    return store.getState()
  }

  return store
}

function clonePicodashRecord(
  source: Record<string, PicodashValue> | undefined,
): Record<string, PicodashValue> {
  if (source === undefined) return {}

  const clone: Record<string, PicodashValue> = {}
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) clone[key] = clonePicodashValue(value)
  }
  return clone
}

function clonePicodashValue(value: PicodashValue): PicodashValue {
  if (Array.isArray(value)) return value.map(clonePicodashValue)
  if (value === null || typeof value !== 'object') return value
  return clonePicodashRecord(value)
}

function replaceVisibleBandOrder(
  parentOrder: string[],
  visibleBandOrder: string[],
  state: PicodashPanelState,
  parentId: string,
  pin: PicodashPin | undefined,
) {
  const queuedVisibleBandOrder = [...visibleBandOrder]
  return parentOrder.map((id) => {
    const item = state.items[id]
    return item?.parentId === parentId && item.pin === pin && !item.hidden
      ? (queuedVisibleBandOrder.shift() ?? id)
      : id
  })
}

function emptyField(): PicodashFieldState {
  return { dirty: false, errors: [], touched: false }
}

function itemField(item: PicodashItemRegistration) {
  return item.field
}

function conflictingDefaultError(items: Record<string, PicodashItemRegistration>, field: string) {
  const owners = Object.values(items).filter(
    (item) => itemField(item) === field && item.defaultValue !== undefined,
  )
  const first = owners[0]
  if (
    first === undefined ||
    owners
      .slice(1)
      .every((owner) =>
        jsonValuesEqual({ value: first.defaultValue! }, { value: owner.defaultValue! }),
      )
  ) {
    return undefined
  }
  return `Field "${field}" has conflicting defaults across active items.`
}

function defaultsEqual(left: PicodashValue | undefined, right: PicodashValue | undefined) {
  if (left === undefined || right === undefined) return left === right
  return jsonValuesEqual({ value: left }, { value: right })
}

function repairProposalWithoutField(proposal: PicodashPanelState['repairProposal'], field: string) {
  if (proposal === null) return null
  const changes = proposal.changes.filter((change) => change.field !== field)
  return changes.length === 0 ? null : { ...proposal, changes }
}

function outputsMatch(left: PicodashFieldOutput, right: PicodashFieldOutput) {
  return jsonValuesEqual(left, right)
}

function writeFieldValues(
  state: PicodashPanelState,
  candidates: Record<string, unknown>,
  source: PicodashValidationSource,
  set: (updater: (state: PicodashPanelState) => Partial<PicodashPanelState>) => void,
) {
  const outputs: Record<string, PicodashFieldOutput> = {}
  const errors: Record<string, readonly string[]> = {}
  for (const [field, candidate] of Object.entries(candidates)) {
    if (fieldIsDisplayOnly(state, field)) {
      errors[field] = ['Display fields cannot be edited.']
      continue
    }
    const result = resolvePicodashFieldValue(state, field, candidate, source)
    if (result.success) outputs[field] = result.output
    else errors[field] = result.errors
  }
  if (Object.keys(errors).length > 0) return { errors, success: false } as const
  set((current) => applyOutputsState(current, outputs))
  return { success: true } as const
}

function fieldIsDisplayOnly(state: Pick<PicodashPanelState, 'items'>, field: string) {
  const owners = Object.values(state.items).filter((item) => item.field === field)
  return owners.length > 0 && owners.every((item) => item.valueMode === 'display')
}

function applyOutputsState(
  state: PicodashPanelState,
  outputs: Record<string, PicodashFieldOutput>,
  options: {
    preserveMeta?: boolean
    resetFields?: readonly string[]
    resetMeta?: boolean
  } = {},
) {
  if (Object.keys(outputs).length === 0) return state
  const fields = { ...state.fields }
  const values = { ...state.values }
  const resetFields = new Set(options.resetFields)
  for (const [fieldId, output] of Object.entries(outputs)) {
    const field = fields[fieldId] ?? emptyField()
    const resetMeta = options.resetMeta === true || resetFields.has(fieldId)
    fields[fieldId] = {
      ...field,
      dirty: resetMeta ? false : options.preserveMeta ? field.dirty : true,
      errors: [],
      touched: resetMeta ? false : options.preserveMeta ? field.touched : true,
    }
    delete fields[fieldId].draftValue
    if ('unset' in output) delete values[fieldId]
    else values[fieldId] = output.value
  }
  const changedFields = new Set(Object.keys(outputs))
  const remainingRepairs =
    state.repairProposal?.changes.filter((change) => !changedFields.has(change.field)) ?? []
  return {
    fields,
    repairProposal:
      state.repairProposal === null || remainingRepairs.length === 0
        ? null
        : { ...state.repairProposal, changes: remainingRepairs },
    values,
  }
}

function removeFromParentOrder(order: Record<string, string[]>, parentId: string, itemId: string) {
  return { ...order, [parentId]: (order[parentId] ?? []).filter((id) => id !== itemId) }
}

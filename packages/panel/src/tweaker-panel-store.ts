import { createStore } from 'zustand'
import { bandForItem, normalizeAllOrders, rootGroupId } from './tweaker-order.js'
import type {
  TweakerFieldState,
  TweakerPanelState,
  TweakerPanelStore,
  TweakerPlacement,
  TweakerValue,
} from './tweaker-panel-types.js'

const emptyValues: Record<string, TweakerValue> = {}
const emptyMeta: Record<string, TweakerValue> = {}

export function createTweakerPanelStore({
  defaultValues = emptyValues,
  initialMeta = emptyMeta,
  panelId,
}: {
  defaultValues?: Record<string, TweakerValue>
  initialMeta?: Record<string, TweakerValue>
  panelId: string
}): TweakerPanelStore {
  return createStore<TweakerPanelState>()((set) => ({
    collapsedGroups: {},
    fields: Object.fromEntries(
      Object.entries(defaultValues).map(([fieldId, value]) => [
        fieldId,
        { defaultValue: value, dirty: false, errors: [], touched: false },
      ]),
    ),
    interaction: { activeIds: {}, draggingId: null, focusedId: null, hoveredId: null },
    items: {},
    meta: initialMeta,
    order: { [rootGroupId]: [] },
    panelId,
    values: defaultValues,
    registerItem(item) {
      set((state) => {
        const previous = state.items[item.id]
        const items = { ...state.items, [item.id]: item }
        let order = state.order

        if (previous?.parentId && previous.parentId !== item.parentId) {
          order = removeFromParentOrder(order, previous.parentId, item.id)
        }

        const parentOrder = order[item.parentId] ?? []
        const reclaimsOrderSlot = previous === undefined && parentOrder.includes(item.id)
        if (!parentOrder.includes(item.id)) {
          order = { ...order, [item.parentId]: [...parentOrder, item.id] }
        } else if (order === state.order) {
          order = { ...order }
        }

        if (item.kind === 'group' && !order[item.id]) {
          order[item.id] = []
        }

        const fieldState = item.fieldId === undefined ? undefined : state.fields[item.fieldId]
        const fields =
          item.fieldId === undefined
            ? state.fields
            : {
                ...state.fields,
                [item.fieldId]: {
                  ...(fieldState ?? emptyField()),
                  defaultValue: item.defaultValue,
                },
              }
        const values =
          item.fieldId === undefined ||
          Object.prototype.hasOwnProperty.call(state.values, item.fieldId) ||
          item.defaultValue === undefined
            ? state.values
            : { ...state.values, [item.fieldId]: item.defaultValue }

        return {
          fields,
          items,
          order: reclaimsOrderSlot ? order : normalizeAllOrders(order, items),
          values,
        }
      })
    },
    moveItemToIndex(itemId, index) {
      set((state) => {
        const item = state.items[itemId]
        if (!item?.reorderable) return state

        const parentOrder = state.order[item.parentId] ?? []
        const visibleBandOrder = parentOrder.filter((id) => {
          const orderedItem = state.items[id]
          return (
            orderedItem?.parentId === item.parentId &&
            orderedItem.placement === item.placement &&
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
                item.placement,
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
        if (!item?.reorderable || !over) return state
        if (item.parentId !== over.parentId || item.placement !== over.placement) return state

        const parentOrder = state.order[item.parentId] ?? []
        const visibleBandOrder = parentOrder.filter((id) => {
          const orderedItem = state.items[id]
          return (
            orderedItem?.parentId === item.parentId &&
            orderedItem.placement === item.placement &&
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
                item.placement,
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
        if (!active.reorderable || active.parentId !== over.parentId) return state
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
      set((state) => {
        const field = state.fields[fieldId]
        const values = { ...state.values }
        if (field?.defaultValue === undefined) delete values[fieldId]
        else values[fieldId] = field.defaultValue
        return {
          fields: {
            ...state.fields,
            [fieldId]: { ...(field ?? emptyField()), dirty: false, touched: false },
          },
          values,
        }
      })
    },
    resetFields() {
      set((state) => {
        const values: Record<string, TweakerValue> = {}
        for (const [fieldId, field] of Object.entries(state.fields)) {
          if (field.defaultValue !== undefined) values[fieldId] = field.defaultValue
        }
        return {
          fields: Object.fromEntries(
            Object.entries(state.fields).map(([fieldId, field]) => [
              fieldId,
              { ...field, dirty: false, touched: false },
            ]),
          ),
          values,
        }
      })
    },
    setFieldDefault(fieldId, value) {
      set((state) => ({
        fields: {
          ...state.fields,
          [fieldId]: { ...(state.fields[fieldId] ?? emptyField()), defaultValue: value },
        },
        values: Object.prototype.hasOwnProperty.call(state.values, fieldId)
          ? state.values
          : value === undefined
            ? state.values
            : { ...state.values, [fieldId]: value },
      }))
    },
    setFieldValue(fieldId, value) {
      set((state) => ({
        fields: {
          ...state.fields,
          [fieldId]: { ...(state.fields[fieldId] ?? emptyField()), dirty: true, touched: true },
        },
        values: { ...state.values, [fieldId]: value },
      }))
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
        if (!state.items[itemId] || state.interaction.draggingId) return state

        const items = { ...state.items }
        delete items[itemId]
        // Registrations can unmount transiently while Reorder rebuilds its layout.
        // Keep parent and nested order slots so the same id reclaims its position.
        return { items }
      })
    },
  }))
}

function replaceVisibleBandOrder(
  parentOrder: string[],
  visibleBandOrder: string[],
  state: TweakerPanelState,
  parentId: string,
  placement: TweakerPlacement,
) {
  const queuedVisibleBandOrder = [...visibleBandOrder]
  return parentOrder.map((id) => {
    const item = state.items[id]
    return item?.parentId === parentId && item.placement === placement && !item.hidden
      ? (queuedVisibleBandOrder.shift() ?? id)
      : id
  })
}

function emptyField(): TweakerFieldState {
  return { dirty: false, errors: [], touched: false }
}

function removeFromParentOrder(order: Record<string, string[]>, parentId: string, itemId: string) {
  return { ...order, [parentId]: (order[parentId] ?? []).filter((id) => id !== itemId) }
}

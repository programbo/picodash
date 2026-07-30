import type { PicodashInteractionState } from './types.js'

export const initialPicodashInteractionState = Object.freeze({
  activeIds: Object.freeze({}),
  draggingId: null,
  focusedId: null,
  hoveredId: null,
}) satisfies PicodashInteractionState

export function setPicodashFocusedItem(
  state: PicodashInteractionState,
  itemId: string | null,
): PicodashInteractionState {
  return state.focusedId === itemId ? state : { ...state, focusedId: itemId }
}

export function setPicodashHoveredItem(
  state: PicodashInteractionState,
  itemId: string | null,
): PicodashInteractionState {
  return state.draggingId !== null || state.hoveredId === itemId
    ? state
    : { ...state, hoveredId: itemId }
}

export function setPicodashInteractionActive(
  state: PicodashInteractionState,
  interactionId: string,
  active: boolean,
): PicodashInteractionState {
  if (state.draggingId !== null && interactionId.startsWith('pointer:')) return state
  if ((state.activeIds[interactionId] === true) === active) return state
  const activeIds = { ...state.activeIds }
  if (active) activeIds[interactionId] = true
  else delete activeIds[interactionId]
  return { ...state, activeIds }
}

export function setPicodashDraggingItem(
  state: PicodashInteractionState,
  itemId: string | null,
): PicodashInteractionState {
  if (state.draggingId === itemId) return state
  const activeIds =
    itemId === null
      ? Object.fromEntries(
          Object.entries(state.activeIds).filter(([id]) => !id.startsWith('pointer:')),
        )
      : state.activeIds
  return { ...state, activeIds, draggingId: itemId }
}

export function removePicodashItemInteraction(
  state: PicodashInteractionState,
  itemId: string,
): PicodashInteractionState {
  return {
    activeIds: state.activeIds,
    draggingId: state.draggingId === itemId ? null : state.draggingId,
    focusedId: state.focusedId === itemId ? null : state.focusedId,
    hoveredId: state.hoveredId === itemId ? null : state.hoveredId,
  }
}

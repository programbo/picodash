import { expect, test } from 'vite-plus/test'
import { createPicodashStore } from '../src/index.ts'

test('tracks focus, hover, active, and drag without pointer samples', () => {
  const store = createPicodashStore({
    fields: { first: { defaultValue: 1 }, second: { defaultValue: 2 } },
    panelId: 'interaction',
  })
  store.getState().registerItem({ field: store.fields.first, id: 'first' })
  store.getState().registerItem({ field: store.fields.second, id: 'second' })
  const state = store.getState()

  state.setFocusedItem('first')
  state.setHoveredItem('first')
  state.setInteractionActive('keyboard:increment', true)
  state.setInteractionActive('pointer:scrub', true)
  state.setDraggingItem('first')
  state.setHoveredItem('second')
  state.setInteractionActive('pointer:drag', true)

  expect(store.getState().interaction).toEqual({
    activeIds: {
      'keyboard:increment': true,
      'pointer:scrub': true,
    },
    draggingId: 'first',
    focusedId: 'first',
    hoveredId: 'first',
  })
  expect(Object.keys(store.getState().interaction)).toEqual([
    'activeIds',
    'draggingId',
    'focusedId',
    'hoveredId',
  ])

  store.getState().setDraggingItem(null)
  expect(store.getState().interaction).toEqual({
    activeIds: { 'keyboard:increment': true },
    draggingId: null,
    focusedId: 'first',
    hoveredId: 'first',
  })
})

test('starts drag only for reorderable items with a same-band sibling', () => {
  const store = createPicodashStore({
    fields: { fixed: { defaultValue: 1 }, lone: { defaultValue: 2 }, peer: { defaultValue: 3 } },
    panelId: 'drag',
  })
  store.getState().registerItem({
    field: store.fields.fixed,
    id: 'fixed',
    reorderable: false,
  })
  store.getState().registerItem({ field: store.fields.lone, id: 'lone', pin: 'start' })
  store.getState().registerItem({ field: store.fields.peer, id: 'peer' })

  store.getState().setDraggingItem('fixed')
  store.getState().setDraggingItem('lone')
  expect(store.getState().interaction.draggingId).toBeNull()
  store.getState().setDraggingItem('peer')
  expect(store.getState().interaction.draggingId).toBeNull()

  store.getState().registerItem({ id: 'peer-2' })
  store.getState().setDraggingItem('peer')
  expect(store.getState().interaction.draggingId).toBe('peer')
})

test('persists collapse independently and clears item interaction on unregister', () => {
  const store = createPicodashStore({
    fields: { groupValue: { defaultValue: true } },
    panelId: 'collapse',
  })
  store.getState().registerItem({
    collapsible: true,
    defaultCollapsed: false,
    field: store.fields.groupValue,
    id: 'group',
    kind: 'group',
  })
  store.getState().registerItem({ collapsible: true, id: 'second' })
  store.getState().setAllCollapsibleItemsCollapsed(true)
  store.getState().setFocusedItem('group')
  store.getState().setHoveredItem('group')

  expect(store.getState().itemMetadata.collapsed).toEqual({ group: true, second: true })
  store.getState().unregisterItem('group')
  expect(store.getState().interaction.focusedId).toBeNull()
  expect(store.getState().interaction.hoveredId).toBeNull()
  expect(store.getState().itemMetadata.collapsed.group).toBe(true)
})

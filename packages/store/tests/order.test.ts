import { expect, test } from 'vite-plus/test'
import {
  createPicodashStore,
  orderedPicodashItemIds,
  picodashItemCanReorder,
  visibleOrderedPicodashItemIds,
} from '../src/index.ts'

test('normalizes stable start, auto, and end pin bands', () => {
  const store = createPicodashStore({
    fields: {
      autoA: { defaultValue: 1 },
      autoB: { defaultValue: 2 },
      end: { defaultValue: 3 },
      start: { defaultValue: 4 },
    },
    initialItemMetadata: {
      collapsed: {},
      order: { root: ['end', 'autoB', 'start', 'autoA'] },
    },
    panelId: 'order',
  })
  store.getState().registerItem({ field: store.fields.autoA, id: 'autoA' })
  store.getState().registerItem({ field: store.fields.autoB, id: 'autoB' })
  store.getState().registerItem({ field: store.fields.end, id: 'end', pin: 'end' })
  store.getState().registerItem({ field: store.fields.start, id: 'start', pin: 'start' })

  expect(store.getState().itemMetadata.order.root).toEqual(['start', 'autoB', 'autoA', 'end'])
  expect(
    orderedPicodashItemIds(store.getState().items, store.getState().itemMetadata.order, 'root'),
  ).toEqual(['start', 'autoB', 'autoA', 'end'])
})

test('moves only within a visible same-band sibling set', () => {
  const store = createPicodashStore({
    fields: {
      autoA: { defaultValue: 1 },
      autoB: { defaultValue: 2 },
      hidden: { defaultValue: 3 },
      start: { defaultValue: 4 },
    },
    panelId: 'move',
  })
  store.getState().registerItem({ field: store.fields.start, id: 'start', pin: 'start' })
  store.getState().registerItem({ field: store.fields.autoA, id: 'autoA' })
  store.getState().registerItem({ field: store.fields.hidden, hidden: true, id: 'hidden' })
  store.getState().registerItem({ field: store.fields.autoB, id: 'autoB' })

  expect(picodashItemCanReorder(store.getState().items, 'autoA')).toBe(true)
  expect(picodashItemCanReorder(store.getState().items, 'start')).toBe(false)
  store.getState().moveItemToIndex('autoB', 0)
  expect(store.getState().itemMetadata.order.root).toEqual(['start', 'autoB', 'hidden', 'autoA'])

  store.getState().moveItemRelativeTo('autoA', 'start', 'before')
  expect(store.getState().itemMetadata.order.root).toEqual(['start', 'autoB', 'hidden', 'autoA'])
  expect(
    visibleOrderedPicodashItemIds(
      store.getState().items,
      store.getState().itemMetadata.order,
      'root',
    ),
  ).toEqual(['start', 'autoB', 'autoA'])
})

test('keeps nested compound items at one order position', () => {
  const store = createPicodashStore({
    fields: {
      fps: { defaultValue: 60 },
      threshold: { defaultValue: 30 },
    },
    panelId: 'compound-order',
  })
  store.getState().registerItem({
    fields: { fps: store.fields.fps, threshold: store.fields.threshold },
    id: 'render-health',
  })

  expect(store.getState().itemMetadata.order).toEqual({ root: ['render-health'] })
  expect(JSON.parse(JSON.stringify(store.getState().itemMetadata))).toEqual({
    collapsed: {},
    order: { root: ['render-health'] },
  })
  expect(store.getState()).not.toHaveProperty('pointer')
})

test('does not notify subscribers for no-op order and collapse actions', () => {
  const store = createPicodashStore({
    fields: { first: { defaultValue: 1 }, second: { defaultValue: 2 } },
    panelId: 'no-ops',
  })
  store.getState().registerItem({ field: store.fields.first, id: 'first' })
  store.getState().registerItem({ field: store.fields.second, id: 'second' })
  let notifications = 0
  const unsubscribe = store.subscribe(() => {
    notifications += 1
  })

  store.getState().moveItemToIndex('first', 0)
  store.getState().moveItemRelativeTo('first', 'second', 'before')
  store.getState().setItemOrder('root', ['first', 'second'])
  store.getState().setAllCollapsibleItemsCollapsed(false)
  store.getState().setFocusedItem(null)
  expect(notifications).toBe(0)
  unsubscribe()
})

test('isolates and validates JSON-compatible initial item metadata', () => {
  const metadata = {
    collapsed: { group: true },
    order: { root: ['group', 'group'] },
  }
  const store = createPicodashStore({
    fields: { count: { defaultValue: 1 } },
    initialItemMetadata: metadata,
    panelId: 'metadata',
  })
  metadata.collapsed.group = false
  metadata.order.root.push('other')

  expect(store.getInitialState().itemMetadata).toEqual({
    collapsed: { group: true },
    order: { root: ['group'] },
  })
  expect(() =>
    createPicodashStore({
      fields: { count: { defaultValue: 1 } },
      initialItemMetadata: {
        collapsed: {
          // @ts-expect-error Persisted collapse metadata must be boolean.
          invalid: 'yes',
        },
        order: {},
      },
      panelId: 'invalid-metadata',
    }),
  ).toThrow('Invalid collapsed metadata')
})

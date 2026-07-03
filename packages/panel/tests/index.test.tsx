import { isValidElement } from 'react'
import { expect, test } from 'vite-plus/test'
import {
  createTweakerPanelStore,
  createTweakerStore,
  FeaturePanel,
  panelZIndexForState,
} from '../src/index.ts'
import { orderIndexForItem } from '../src/tweaker-panel.tsx'

test('creates feature panel elements', () => {
  const element = (
    <FeaturePanel
      title="Release Panel"
      metric={{ label: 'Readiness', value: '92%' }}
      items={[{ label: 'Build health', value: 'Passing', status: 'success' }]}
    />
  )

  expect(isValidElement(element)).toBe(true)
  expect(element.props.title).toBe('Release Panel')
  expect(element.props.metric).toEqual({ label: 'Readiness', value: '92%' })
  expect(element.props.items).toEqual([
    { label: 'Build health', value: 'Passing', status: 'success' },
  ])
})

test('tracks registered panels in the global tweaker store', () => {
  const store = createTweakerStore()

  store.getState().registerPanel({ id: 'inspect' })

  expect(store.getState().panels.inspect).toEqual({ id: 'inspect' })
  expect(store.getState().panelOrder).toEqual(['inspect'])

  store.getState().unregisterPanel('inspect')

  expect(store.getState().panels.inspect).toBeUndefined()
  expect(store.getState().panelOrder).toEqual([])
})

test('raises the most recently interacted panel above earlier panels', () => {
  const store = createTweakerStore()

  store.getState().registerPanel({ id: 'scene' })
  store.getState().registerPanel({ id: 'output' })

  expect(panelZIndexForState(store.getState(), 'scene')).toBeLessThan(
    panelZIndexForState(store.getState(), 'output'),
  )

  store.getState().activatePanel('scene')

  expect(store.getState().panelOrder).toEqual(['output', 'scene'])
  expect(panelZIndexForState(store.getState(), 'scene')).toBeGreaterThan(
    panelZIndexForState(store.getState(), 'output'),
  )
})

test('stores panel-local field values', () => {
  const store = createTweakerPanelStore({ panelId: 'inspect' })

  store.getState().setFieldValue('exposure', 1.25)

  expect(store.getState().panelId).toBe('inspect')
  expect(store.getState().values.exposure).toBe(1.25)

  store.getState().resetFieldValue('exposure')

  expect(store.getState().values.exposure).toBeUndefined()
})

test('normalizes panel item order into start, auto, and end bands', () => {
  const store = createTweakerPanelStore({ panelId: 'inspect' })
  const register = (id: string, placement: 'auto' | 'start' | 'end') => {
    store.getState().registerItem({
      id,
      kind: 'control',
      parentId: 'root',
      placement,
      reorderable: true,
    })
  }

  register('quality', 'auto')
  register('summary', 'end')
  register('header', 'start')
  register('exposure', 'auto')

  expect(store.getState().order.root).toEqual(['header', 'quality', 'exposure', 'summary'])

  store.getState().setOrder('root', ['summary', 'exposure', 'header', 'quality'])

  expect(store.getState().order.root).toEqual(['header', 'exposure', 'quality', 'summary'])
})

test('programmatic reorder stays within parent and placement band', () => {
  const store = createTweakerPanelStore({ panelId: 'inspect' })
  const register = (id: string, placement: 'auto' | 'start' | 'end', parentId = 'root') => {
    store.getState().registerItem({
      id,
      kind: 'control',
      parentId,
      placement,
      reorderable: true,
    })
  }

  register('header', 'start')
  register('quality', 'auto')
  register('exposure', 'auto')
  register('summary', 'end')
  register('nested', 'auto', 'group-a')

  store.getState().reorderItem('exposure', 'quality')
  expect(store.getState().order.root).toEqual(['header', 'exposure', 'quality', 'summary'])

  store.getState().reorderItem('summary', 'quality')
  expect(store.getState().order.root).toEqual(['header', 'exposure', 'quality', 'summary'])

  store.getState().reorderItem('nested', 'quality')
  expect(store.getState().order.root).toEqual(['header', 'exposure', 'quality', 'summary'])
})

test('drag commit moves items by visible placement-local index', () => {
  const store = createTweakerPanelStore({ panelId: 'inspect' })
  const register = (id: string, placement: 'auto' | 'start' | 'end', hidden = false) => {
    store.getState().registerItem({
      hidden,
      id,
      kind: 'control',
      parentId: 'root',
      placement,
      reorderable: true,
    })
  }

  register('header', 'start')
  register('quality', 'auto')
  register('advanced', 'auto', true)
  register('exposure', 'auto')
  register('render-scale', 'auto')
  register('summary', 'end')

  expect(orderIndexForItem(store.getState(), 'header')).toBe(0)
  expect(orderIndexForItem(store.getState(), 'quality')).toBe(0)
  expect(orderIndexForItem(store.getState(), 'exposure')).toBe(1)
  expect(orderIndexForItem(store.getState(), 'summary')).toBe(0)

  store.getState().moveItemToIndex('render-scale', 0)

  expect(store.getState().order.root).toEqual([
    'header',
    'render-scale',
    'advanced',
    'quality',
    'exposure',
    'summary',
  ])
})

test('drag commit persists dnd-kit sortable indices without translating them', () => {
  const store = createTweakerPanelStore({ panelId: 'inspect' })
  for (const id of ['quality', 'camera-height', 'render-scale']) {
    store.getState().registerItem({
      id,
      kind: 'control',
      parentId: 'root',
      placement: 'auto',
      reorderable: true,
    })
  }

  store.getState().moveItemToIndex('quality', 1)

  expect(store.getState().order.root).toEqual(['camera-height', 'quality', 'render-scale'])

  store.getState().moveItemToIndex('quality', 2)

  expect(store.getState().order.root).toEqual(['camera-height', 'render-scale', 'quality'])

  store.getState().moveItemToIndex('quality', 0)

  expect(store.getState().order.root).toEqual(['quality', 'camera-height', 'render-scale'])
})

test('pointer reorder can reverse from past two rows back between them', () => {
  const store = createTweakerPanelStore({ panelId: 'inspect' })
  for (const id of ['quality', 'camera-height', 'render-scale']) {
    store.getState().registerItem({
      id,
      kind: 'control',
      parentId: 'root',
      placement: 'auto',
      reorderable: true,
    })
  }

  store.getState().moveItemRelativeTo('quality', 'render-scale', 'after')
  expect(store.getState().order.root).toEqual(['camera-height', 'render-scale', 'quality'])

  store.getState().moveItemRelativeTo('quality', 'render-scale', 'before')
  expect(store.getState().order.root).toEqual(['camera-height', 'quality', 'render-scale'])
})

test('drag commit logs the same label order React will render when the last item moves first', () => {
  const store = createTweakerPanelStore({ panelId: 'inspect' })
  const labelsById = new Map([
    ['quality', 'Quality'],
    ['camera-height', 'Camera height'],
    ['render-scale', 'Render scale'],
  ])

  for (const [id, label] of labelsById) {
    store.getState().registerItem({
      id,
      kind: 'control',
      label,
      parentId: 'root',
      placement: 'auto',
      reorderable: true,
    })
  }

  store.getState().moveItemToIndex('render-scale', 0)

  expect(store.getState().order.root).toEqual(['render-scale', 'quality', 'camera-height'])
  expect(store.getState().order.root.map((id) => labelsById.get(id))).toEqual([
    'Render scale',
    'Quality',
    'Camera height',
  ])
})

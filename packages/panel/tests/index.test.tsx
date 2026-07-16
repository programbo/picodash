import { isValidElement } from 'react'
import { expect, test } from 'vite-plus/test'
import {
  createTweakerPanelStore,
  createTweakerStore,
  FeaturePanel,
  panelLayoutStorageKey,
  panelZIndexForState,
} from '../src/index.ts'
import {
  clampPanelPosition,
  positionForPanelLayout,
  snapPanelPosition,
  type PanelRect,
} from '../src/panel-snapping.ts'
import { orderIndexForItem, reorderValuesForPointer } from '../src/tweaker-panel.tsx'

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

test('hydrates valid persisted panel layouts', () => {
  const storage = installFakeLocalStorage()
  storage.setItem(
    panelLayoutStorageKey,
    JSON.stringify({
      state: { panelLayouts: { inspect: { x: 42, y: -12 } } },
      version: 0,
    }),
  )

  const store = createTweakerStore()

  expect(store.getState().panelLayouts.inspect).toEqual({ dock: null, x: 42, y: -12 })
})

test('ignores invalid persisted panel layouts', () => {
  const storage = installFakeLocalStorage()
  storage.setItem(
    panelLayoutStorageKey,
    JSON.stringify({
      state: { panelLayouts: { inspect: { x: Number.NaN, y: 'bad' } } },
      version: 0,
    }),
  )

  const store = createTweakerStore()

  expect(store.getState().panelLayouts).toEqual({})
})

test('persists manual panel layout without persisting measured rect changes', () => {
  const storage = installFakeLocalStorage()
  const store = createTweakerStore()

  store.getState().setPanelLayout('inspect', { x: 24, y: 32 })
  store.getState().setPanelRect('inspect', rect(24, 32, 100, 80))

  expect(readPersistedPanelLayouts(storage)).toEqual({ inspect: { dock: null, x: 24, y: 32 } })
})

test('persists docked panel layout edges', () => {
  const storage = installFakeLocalStorage()
  const store = createTweakerStore()

  store.getState().setPanelLayout('inspect', {
    dock: { horizontal: 'right', vertical: 'top' },
    x: 700,
    y: 8,
  })

  expect(readPersistedPanelLayouts(storage)).toEqual({
    inspect: { dock: { horizontal: 'right', vertical: 'top' }, x: 700, y: 8 },
  })
})

test('snaps panel position to viewport edges and corners', () => {
  const baseRect = rect(100, 100, 100, 80)
  const containerRect = rect(0, 0, 400, 300)

  expect(
    snapPanelPosition({
      baseRect,
      containerRect,
      position: { x: -94, y: -92 },
    }),
  ).toMatchObject({
    dock: { horizontal: 'left', vertical: 'top' },
    position: { x: -92, y: -92 },
    snappedX: true,
    snappedY: true,
  })
  expect(
    snapPanelPosition({
      baseRect,
      containerRect,
      position: { x: 180, y: 110 },
    }),
  ).toMatchObject({
    dock: { horizontal: 'right', vertical: 'bottom' },
    position: { x: 192, y: 112 },
    snappedX: true,
    snappedY: true,
  })
})

test('does not snap outside the snap threshold', () => {
  const baseRect = rect(100, 100, 100, 80)
  const containerRect = rect(0, 0, 400, 300)

  expect(
    snapPanelPosition({
      baseRect,
      containerRect,
      position: { x: -75, y: -70 },
    }),
  ).toMatchObject({
    dock: null,
    position: { x: -75, y: -70 },
    snappedX: false,
    snappedY: false,
  })
})

test('snaps panel position to peer panel edges', () => {
  const baseRect = rect(100, 100, 100, 80)
  const containerRect = rect(0, 0, 500, 400)
  const peerRects = [rect(250, 200, 120, 90)]

  expect(
    snapPanelPosition({
      baseRect,
      containerRect,
      peerRects,
      position: { x: 144, y: 18 },
    }),
  ).toMatchObject({
    dock: null,
    position: { x: 150, y: 20 },
    snappedX: true,
    snappedY: true,
  })
})

test('docked edge overrides saved coordinates for panel layout position', () => {
  expect(
    positionForPanelLayout({
      baseRect: rect(200, 100, 100, 80),
      containerRect: rect(0, 0, 500, 400),
      layout: {
        dock: { horizontal: 'right', vertical: 'top' },
        x: 240,
        y: 260,
      },
    }),
  ).toEqual({ x: 192, y: -92 })
})

test('chooses the nearest snap candidate on each axis', () => {
  const baseRect = rect(100, 100, 100, 80)
  const containerRect = rect(0, 0, 500, 400)
  const peerRects = [rect(246, 210, 120, 90), rect(252, 214, 120, 90)]

  expect(
    snapPanelPosition({
      baseRect,
      containerRect,
      peerRects,
      position: { x: 149, y: 111 },
    }).position,
  ).toEqual({ x: 146, y: 110 })
})

test('clamps panel position inside the container', () => {
  expect(
    clampPanelPosition({ x: 400, y: -200 }, rect(100, 100, 100, 80), rect(0, 0, 300, 240)),
  ).toEqual({ x: 100, y: -100 })
})

test('stores panel-local field values', () => {
  const store = createTweakerPanelStore({ panelId: 'inspect' })

  store.getState().setFieldValue('exposure', 1.25)

  expect(store.getState().panelId).toBe('inspect')
  expect(store.getState().values.exposure).toBe(1.25)

  store.getState().resetFieldValue('exposure')

  expect(store.getState().values.exposure).toBeUndefined()
})

test('preserves collapsed group state across reorder layout remounts', () => {
  const store = createTweakerPanelStore({ panelId: 'inspect' })
  const group = {
    id: 'preview',
    kind: 'group' as const,
    parentId: 'root',
    placement: 'auto' as const,
    reorderable: true,
  }

  store.getState().registerItem(group)
  store.getState().setGroupCollapsed(group.id, true)
  store.getState().unregisterItem(group.id)
  store.getState().registerItem(group)

  expect(store.getState().collapsedGroups.preview).toBe(true)
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

test('pointer reorder moves an adjacent item down and back up from fixed drag geometry', () => {
  expect(
    reorderValuesForPointer(
      ['channel', 'lock-preview'],
      'channel',
      [
        { id: 'channel', min: 0, max: 42 },
        { id: 'lock-preview', min: 46, max: 86 },
      ],
      25,
    ),
  ).toEqual(['lock-preview', 'channel'])

  expect(
    reorderValuesForPointer(
      ['lock-preview', 'channel'],
      'channel',
      [
        { id: 'lock-preview', min: 0, max: 40 },
        { id: 'channel', min: 44, max: 86 },
      ],
      -25,
    ),
  ).toEqual(['channel', 'lock-preview'])
})

test('pointer reorder targets the second row without requiring a third-row crossover', () => {
  const order = ['quality', 'camera-height', 'shadow-softness']
  const layouts = [
    { id: 'quality', min: 0, max: 42 },
    { id: 'camera-height', min: 46, max: 88 },
    { id: 'shadow-softness', min: 92, max: 132 },
  ]

  expect(reorderValuesForPointer(order, 'quality', layouts, 26)).toEqual([
    'camera-height',
    'quality',
    'shadow-softness',
  ])
  expect(reorderValuesForPointer(order, 'quality', layouts, 71)).toEqual([
    'camera-height',
    'shadow-softness',
    'quality',
  ])
  expect(reorderValuesForPointer(order, 'quality', layouts, 10)).toEqual(order)
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

function rect(left: number, top: number, width: number, height: number): PanelRect {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
  }
}

function installFakeLocalStorage() {
  const values = new Map<string, string>()
  const storage = {
    clear() {
      values.clear()
    },
    getItem(key: string) {
      return values.get(key) ?? null
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null
    },
    get length() {
      return values.size
    },
    removeItem(key: string) {
      values.delete(key)
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
  }

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: storage },
  })

  return storage
}

function readPersistedPanelLayouts(storage: ReturnType<typeof installFakeLocalStorage>) {
  const raw = storage.getItem(panelLayoutStorageKey)
  expect(raw).toBeTruthy()

  return JSON.parse(raw!).state.panelLayouts as unknown
}

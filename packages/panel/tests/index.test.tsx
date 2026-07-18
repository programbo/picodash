import { isValidElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vite-plus/test'
import {
  createTweakerPanelStore,
  createTweakerStore,
  FeaturePanel,
  panelLayoutStorageKey,
  panelZIndexForState,
  tweakerDefaultTheme,
  tweakerGeometryTokens,
  tweakerLayerTokens,
  tweakerMotionTokens,
  tweakerThemeAttribute,
} from '../src/index.ts'
import {
  clampPanelPosition,
  positionForPanelLayout,
  snapPanelPosition,
  translationFromTransform,
  type PanelRect,
} from '../src/panel-snapping.ts'
import {
  orderedItemIdsForParent,
  orderIndexForItem,
  reorderValuesForPointer,
} from '../src/tweaker-panel.tsx'
import { constrainReorderPointerOffset } from '../src/tweaker-reorder-list.tsx'
import { TweakerReorderIndicator } from '../src/tweaker-reorder-indicator.tsx'

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

test('exports the package theme carrier, motion, and layer contracts', () => {
  expect(tweakerThemeAttribute).toBe('data-tweaker-theme')
  expect(tweakerDefaultTheme).toBe('dark')
  expect(tweakerLayerTokens).toEqual({
    panelBase: 1000,
  })
  expect(tweakerGeometryTokens).toEqual({
    menuCollisionPadding: 8,
    menuSideOffset: 4,
    menuSubmenuOffset: 4,
    rangeThumbRadius: 7,
    selectCollisionPadding: 8,
    selectSideOffset: 4,
    xyLabelGap: 5,
  })
  expect(tweakerMotionTokens.dragElastic).toBe(0.01)
  expect(tweakerMotionTokens.reorder).toEqual({
    damping: 30,
    mass: 0.55,
    stiffness: 650,
    type: 'spring',
  })
  expect(tweakerMotionTokens.reorderDrag).toEqual({
    bounceDamping: 28,
    bounceStiffness: 700,
    power: 0.08,
    restDelta: 0.5,
    restSpeed: 12,
    timeConstant: 120,
  })
  expect(tweakerMotionTokens.featureRowAnimate).toEqual({
    height: 'auto',
    opacity: 1,
  })
  expect(tweakerMotionTokens.viewerOverlayAnimate).toEqual({ opacity: 1 })
  expect(tweakerMotionTokens.viewerSurfaceExit).toEqual({
    opacity: 0,
    scale: 0.97,
    transition: {
      duration: 0.16,
      ease: [0.4, 0, 1, 1],
    },
  })
  expect(tweakerMotionTokens.xySpring).toEqual({
    damping: 28,
    mass: 0.35,
    stiffness: 380,
  })
})

test('renders a static square instead of a grip for non-reorderable item slots', () => {
  const staticIndicator = renderToStaticMarkup(<TweakerReorderIndicator reorderable={false} />)
  const reorderGrip = renderToStaticMarkup(<TweakerReorderIndicator reorderable />)

  expect(staticIndicator).toContain('data-tweaker-reorder-indicator="static"')
  expect(staticIndicator).toContain('size-(--tweaker-reorder-static-marker-size)')
  expect(staticIndicator).toContain('bg-(--tweaker-reorder-static-marker-color)')
  expect(staticIndicator).toContain('opacity-(--tweaker-reorder-static-marker-opacity)')
  expect(staticIndicator).not.toContain('<svg')
  expect(reorderGrip).toContain('data-tweaker-reorder-indicator="grip"')
  expect(reorderGrip).toContain('<svg')
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

test('reads the translation actually applied by computed transform matrices', () => {
  expect(translationFromTransform('none')).toEqual({ x: 0, y: 0 })
  expect(translationFromTransform('matrix(1, 0, 0, 1, 216, 168)')).toEqual({ x: 216, y: 168 })
  expect(
    translationFromTransform('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -120.5, 48.25, 0, 1)'),
  ).toEqual({ x: -120.5, y: 48.25 })
  expect(translationFromTransform('matrix(1, 0, 0, 1, NaN, 12)')).toEqual({ x: 0, y: 0 })
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

test('preserves control order slots across transient registration remounts', () => {
  const store = createTweakerPanelStore({ panelId: 'inspect' })
  const register = (id: string) =>
    store.getState().registerItem({
      id,
      kind: 'control',
      parentId: 'root',
      placement: 'auto',
      reorderable: true,
    })

  register('alpha')
  register('beta')
  register('gamma')
  store.getState().setOrder('root', ['gamma', 'alpha', 'beta'])

  store.getState().unregisterItem('alpha')

  expect(store.getState().order.root).toEqual(['gamma', 'alpha', 'beta'])
  expect(orderedItemIdsForParent(store.getState(), 'root')).toEqual(['gamma', 'beta'])

  register('alpha')

  expect(orderedItemIdsForParent(store.getState(), 'root')).toEqual(['gamma', 'alpha', 'beta'])
})

test('preserves stale slots while multiple controls re-register out of order', () => {
  const store = createTweakerPanelStore({ panelId: 'inspect' })
  const register = (id: string) =>
    store.getState().registerItem({
      id,
      kind: 'control',
      parentId: 'root',
      placement: 'auto',
      reorderable: true,
    })

  register('alpha')
  register('beta')
  register('gamma')
  store.getState().setOrder('root', ['gamma', 'alpha', 'beta'])
  store.getState().unregisterItem('alpha')
  store.getState().unregisterItem('beta')

  register('beta')
  expect(store.getState().order.root).toEqual(['gamma', 'alpha', 'beta'])
  expect(orderedItemIdsForParent(store.getState(), 'root')).toEqual(['gamma', 'beta'])

  register('alpha')
  expect(orderedItemIdsForParent(store.getState(), 'root')).toEqual(['gamma', 'alpha', 'beta'])
})

test('preserves group and nested order slots across transient registration remounts', () => {
  const store = createTweakerPanelStore({ panelId: 'inspect' })
  store.getState().registerItem({
    id: 'preview',
    kind: 'group',
    parentId: 'root',
    placement: 'auto',
    reorderable: true,
  })
  store.getState().registerItem({
    id: 'output',
    kind: 'group',
    parentId: 'root',
    placement: 'auto',
    reorderable: true,
  })
  for (const id of ['exposure', 'quality']) {
    store.getState().registerItem({
      id,
      kind: 'control',
      parentId: 'preview',
      placement: 'auto',
      reorderable: true,
    })
  }
  store.getState().setOrder('root', ['output', 'preview'])
  store.getState().setOrder('preview', ['quality', 'exposure'])

  store.getState().unregisterItem('preview')

  expect(store.getState().order.root).toEqual(['output', 'preview'])
  expect(store.getState().order.preview).toEqual(['quality', 'exposure'])
  expect(orderedItemIdsForParent(store.getState(), 'root')).toEqual(['output'])

  store.getState().registerItem({
    id: 'preview',
    kind: 'group',
    parentId: 'root',
    placement: 'auto',
    reorderable: true,
  })

  expect(orderedItemIdsForParent(store.getState(), 'root')).toEqual(['output', 'preview'])
  expect(orderedItemIdsForParent(store.getState(), 'preview')).toEqual(['quality', 'exposure'])
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

test('pointer reorder swaps only after the dragged leading edge passes an adjacent midpoint', () => {
  expect(
    reorderValuesForPointer(
      ['channel', 'lock-preview'],
      'channel',
      [
        { id: 'channel', min: 0, max: 42 },
        { id: 'lock-preview', min: 46, max: 86 },
      ],
      24,
    ),
  ).toEqual(['channel', 'lock-preview'])

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
      -24,
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
  expect(reorderValuesForPointer(order, 'quality', layouts, 25)).toEqual(order)
  expect(reorderValuesForPointer(order, 'quality', layouts, 70)).toEqual([
    'camera-height',
    'quality',
    'shadow-softness',
  ])
})

test('pointer reorder uses the leading edge when a tall item moves above shorter siblings', () => {
  const order = ['first', 'second', 'tall']
  const layouts = [
    { id: 'first', min: 0, max: 40 },
    { id: 'second', min: 44, max: 86 },
    { id: 'tall', min: 90, max: 332 },
  ]

  expect(reorderValuesForPointer(order, 'tall', layouts, -25)).toEqual(order)
  expect(reorderValuesForPointer(order, 'tall', layouts, -26)).toEqual(['first', 'tall', 'second'])
  expect(reorderValuesForPointer(order, 'tall', layouts, -71)).toEqual(['tall', 'first', 'second'])
})

test('pointer reorder uses the leading edge when a tall item moves below shorter siblings', () => {
  const order = ['tall', 'second', 'third']
  const layouts = [
    { id: 'tall', min: 0, max: 242 },
    { id: 'second', min: 246, max: 286 },
    { id: 'third', min: 290, max: 330 },
  ]

  expect(reorderValuesForPointer(order, 'tall', layouts, 24)).toEqual(order)
  expect(reorderValuesForPointer(order, 'tall', layouts, 25)).toEqual(['second', 'tall', 'third'])
  expect(reorderValuesForPointer(order, 'tall', layouts, 68)).toEqual(['second', 'tall', 'third'])
  expect(reorderValuesForPointer(order, 'tall', layouts, 69)).toEqual(['second', 'third', 'tall'])
})

test('pointer reorder recalculates from fixed geometry after reversing across multiple items', () => {
  const order = ['first', 'second', 'source', 'fourth', 'fifth']
  const layouts = [
    { id: 'first', min: 0, max: 40 },
    { id: 'second', min: 44, max: 92 },
    { id: 'source', min: 96, max: 138 },
    { id: 'fourth', min: 142, max: 182 },
    { id: 'fifth', min: 186, max: 238 },
  ]

  expect(reorderValuesForPointer(order, 'source', layouts, 24)).toEqual(order)
  expect(reorderValuesForPointer(order, 'source', layouts, 25)).toEqual([
    'first',
    'second',
    'fourth',
    'source',
    'fifth',
  ])
  expect(reorderValuesForPointer(order, 'source', layouts, 75)).toEqual([
    'first',
    'second',
    'fourth',
    'fifth',
    'source',
  ])
  expect(reorderValuesForPointer(order, 'source', layouts, -29)).toEqual([
    'first',
    'source',
    'second',
    'fourth',
    'fifth',
  ])
  expect(reorderValuesForPointer(order, 'source', layouts, -77)).toEqual([
    'source',
    'first',
    'second',
    'fourth',
    'fifth',
  ])
})

test('pointer reorder constraints preserve in-bounds offsets and apply symmetric elastic overshoot', () => {
  expect(constrainReorderPointerOffset(-40, -100, 200)).toBe(-40)
  expect(constrainReorderPointerOffset(125, -100, 200)).toBe(125)

  const below = constrainReorderPointerOffset(-125, -100, 200)
  const above = constrainReorderPointerOffset(225, -100, 200)
  expect(below).toBe(-100.25)
  expect(above).toBe(200.25)
  expect(-100 - below).toBe(above - 200)

  expect(constrainReorderPointerOffset(-1_000, -100, 200)).toBe(-101)
  expect(constrainReorderPointerOffset(1_000, -100, 200)).toBe(201)
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

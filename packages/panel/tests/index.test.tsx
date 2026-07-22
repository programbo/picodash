import { isValidElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vite-plus/test'
import * as advancedApi from '../src/advanced.ts'
import * as publicApi from '../src/index.ts'
import * as uiApi from '../src/ui.ts'
import { createPicodashPanelStore, FeaturePanel } from '../src/index.ts'
import { panelLayoutStorageKey } from '../src/panel-persistence.ts'
import { installFakeLocalStorage, readPersistedPanelLayouts } from './helpers.ts'
import {
  clampPanelPosition,
  dockForSnapPosition,
  intersectPanelRects,
  normalizePicodashPanelPlacement,
  placementForPanelLayout,
  positionForFloatingCorner,
  positionForPanelLayout,
  resolvePicodashPanelBoundary,
  snapPositionForDock,
  snapPanelPosition,
  translationFromTransform,
  type PanelRect,
} from '../src/panel-snapping.ts'
import {
  hasVisibleReorderableSibling,
  itemCanReorder,
  orderedItemIdsForParent,
  orderIndexForItem,
  panelShellDragProps,
  reorderValuesForPointer,
} from '../src/picodash-panel.tsx'
import {
  orderSnapshotForParent,
  orderPicodashChildren,
  partitionPicodashChildrenByBand,
} from '../src/picodash-order.tsx'
import {
  createPicodashStore,
  modalZIndexForState,
  panelZIndexForState,
  portalLayerZIndexForState,
  portalLayerZIndexValue,
} from '../src/picodash-provider.tsx'
import {
  constrainReorderPointerOffset,
  restoreKeyboardReorderOrder,
} from '../src/picodash-reorder-list.tsx'
import { PicodashReorderIndicator } from '../src/picodash-reorder-indicator.tsx'
import {
  picodashDefaultTheme,
  picodashGeometryTokens,
  picodashLayerTokens,
  picodashMotionTokens,
  picodashThemeAttribute,
} from '../src/theme.ts'

test('keeps the public and advanced hook surfaces explicit', () => {
  expect(publicApi.usePicodashPanel).toBeTypeOf('function')
  expect(publicApi.usePicodashPanelStoreSelector).toBeTypeOf('function')
  expect(publicApi.usePicodashTheme).toBeTypeOf('function')
  expect('usePicodashPanelSelector' in publicApi).toBe(false)

  expect(advancedApi.usePicodashPanelSelector).toBeTypeOf('function')
  expect(advancedApi.usePicodashPanelStoreApi).toBeTypeOf('function')
  expect(advancedApi.usePicodashProviderSelector).toBeTypeOf('function')
  expect(advancedApi.usePicodashProviderStoreApi).toBeTypeOf('function')
  expect('usePicodashGroupContext' in advancedApi).toBe(false)
  expect('usePicodashPanel' in advancedApi).toBe(false)
  expect('usePicodashPanelState' in advancedApi).toBe(false)
  expect('usePicodashProviderContext' in advancedApi).toBe(false)
  expect('usePicodashSelector' in advancedApi).toBe(false)
  expect('usePicodashStoreApi' in advancedApi).toBe(false)
})

test('renders the shared Select without PicodashProvider', () => {
  const markup = renderToStaticMarkup(
    <uiApi.Select aria-label="Standalone choice" defaultSelectedKey="first">
      <uiApi.SelectTrigger>
        <uiApi.SelectValue />
      </uiApi.SelectTrigger>
      <uiApi.SelectContent>
        <uiApi.SelectItem id="first">First</uiApi.SelectItem>
        <uiApi.SelectItem id="second">Second</uiApi.SelectItem>
      </uiApi.SelectContent>
    </uiApi.Select>,
  )

  expect(markup).toContain('aria-label="Standalone choice"')
  expect(markup).toContain('data-picodash-theme="dark"')
  expect(markup).toContain('data-slot="select-trigger"')
})

test('forwards drag behavior to the movable shell only for non-fixed panels', () => {
  const onDirectionLock = () => undefined
  const onDragTransitionEnd = () => undefined
  const dragProps = {
    dragDirectionLock: true,
    dragPropagation: true,
    dragSnapToOrigin: 'x' as const,
    dragTransition: { bounceDamping: 12 },
    onDirectionLock,
    onDragTransitionEnd,
    whileDrag: { scale: 1.03 },
  }

  expect(panelShellDragProps(false, dragProps)).toBe(dragProps)
  expect(panelShellDragProps(true, dragProps)).toEqual({})
})

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
  expect(picodashThemeAttribute).toBe('data-picodash-theme')
  expect(picodashDefaultTheme).toBe('dark')
  expect(picodashLayerTokens).toEqual({
    panelBase: 1000,
  })
  expect(picodashGeometryTokens).toEqual({
    menuCollisionPadding: 8,
    menuSideOffset: 4,
    menuSubmenuOffset: 4,
    rangeThumbRadius: 7,
    selectCollisionPadding: 8,
    selectSideOffset: 4,
    xyLabelGap: 5,
  })
  expect(picodashMotionTokens.dragElastic).toBe(0.01)
  expect(picodashMotionTokens.reorder).toEqual({
    damping: 30,
    mass: 0.55,
    stiffness: 650,
    type: 'spring',
  })
  expect(picodashMotionTokens.reorderDrag).toEqual({
    bounceDamping: 28,
    bounceStiffness: 700,
    power: 0.08,
    restDelta: 0.5,
    restSpeed: 12,
    timeConstant: 120,
  })
  expect(picodashMotionTokens.featureRowAnimate).toEqual({
    height: 'auto',
    opacity: 1,
  })
  expect(picodashMotionTokens.viewerOverlayAnimate).toEqual({ opacity: 1 })
  expect(picodashMotionTokens.viewerSurfaceExit).toEqual({
    opacity: 0,
    scale: 0.97,
    transition: {
      duration: 0.16,
      ease: [0.4, 0, 1, 1],
    },
  })
  expect(picodashMotionTokens.xySpring).toEqual({
    damping: 28,
    mass: 0.35,
    stiffness: 380,
  })
})

test('renders a static square instead of a grip for non-reorderable item slots', () => {
  const staticIndicator = renderToStaticMarkup(<PicodashReorderIndicator reorderable={false} />)
  const reorderGrip = renderToStaticMarkup(<PicodashReorderIndicator reorderable />)

  expect(staticIndicator).toContain('data-picodash-reorder-indicator="static"')
  expect(staticIndicator).toContain('size-(--picodash-space-1-5)')
  expect(staticIndicator).toContain('bg-picodash-muted')
  expect(staticIndicator).toContain('opacity-(--picodash-opacity-subtle)')
  expect(staticIndicator).not.toContain('<svg')
  expect(reorderGrip).toContain('data-picodash-reorder-indicator="grip"')
  expect(reorderGrip).toContain('<svg')
})

test('tracks registered panels in the global picodash store', () => {
  const store = createPicodashStore()

  store.getState().registerPanel({ id: 'inspect' })

  expect(store.getState().panels.inspect).toEqual({
    boundary: null,
    id: 'inspect',
    placement: { mode: 'floating', position: 'top-right' },
    visible: true,
  })
  expect(store.getState().panelOrder).toEqual(['inspect'])

  store.getState().unregisterPanel('inspect')

  expect(store.getState().panels.inspect).toBeUndefined()
  expect(store.getState().panelOrder).toEqual([])
})

test('raises the most recently interacted panel above earlier panels', () => {
  const store = createPicodashStore()

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
  expect(modalZIndexForState(store.getState())).toBeGreaterThan(
    panelZIndexForState(store.getState(), 'scene'),
  )
  expect(modalZIndexForState(store.getState())).toBeGreaterThan(
    panelZIndexForState(store.getState(), 'output'),
  )
  expect(portalLayerZIndexForState(store.getState(), 1)).toBeGreaterThan(
    panelZIndexForState(store.getState(), 'scene'),
  )
  expect(portalLayerZIndexValue('--picodash-layer-menu', 1003)).toBe(
    'max(var(--picodash-layer-menu), 1003)',
  )
})

test('controls transient panel visibility without changing stacking order', () => {
  const store = createPicodashStore()

  store.getState().registerPanel({ id: 'scene' })
  store.getState().registerPanel({ id: 'output', visible: false })

  expect(store.getState().panels.scene.visible).toBe(true)
  expect(store.getState().panels.output.visible).toBe(false)

  store.getState().setPanelVisible('scene', false)
  expect(store.getState().panels.scene.visible).toBe(false)
  expect(store.getState().panelOrder).toEqual(['scene', 'output'])

  store.getState().togglePanel('scene')
  expect(store.getState().panels.scene.visible).toBe(true)
  expect(store.getState().panelOrder).toEqual(['scene', 'output'])

  store.getState().setPanelVisible('scene', true)
  expect(store.getState().panels.scene.visible).toBe(true)
})

test('shows and raises a hidden panel when activated', () => {
  const store = createPicodashStore()

  store.getState().registerPanel({ id: 'scene', visible: false })
  store.getState().registerPanel({ id: 'output' })
  store.getState().activatePanel('scene')

  expect(store.getState().panels.scene.visible).toBe(true)
  expect(store.getState().panelOrder).toEqual(['output', 'scene'])
})

test('ignores visibility actions for unknown or unregistered panels', () => {
  const store = createPicodashStore()
  const initialState = store.getState()

  initialState.setPanelVisible('missing', false)
  initialState.togglePanel('missing')
  initialState.activatePanel('missing')

  expect(store.getState()).toBe(initialState)

  store.getState().registerPanel({ id: 'scene' })
  const staleActions = store.getState()
  staleActions.unregisterPanel('scene')
  staleActions.setPanelVisible('scene', false)
  staleActions.togglePanel('scene')
  staleActions.activatePanel('scene')

  expect(store.getState().panels.scene).toBeUndefined()
  expect(store.getState().panelOrder).toEqual([])
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

  const store = createPicodashStore()

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

  const store = createPicodashStore()

  expect(store.getState().panelLayouts).toEqual({})
})

test('ignores persisted fixed placements with unsupported positions', () => {
  const storage = installFakeLocalStorage()
  storage.setItem(
    panelLayoutStorageKey,
    JSON.stringify({
      state: {
        panelLayouts: {
          inspect: {
            dock: null,
            placement: { mode: 'fixed', position: 'top' },
            x: 0,
            y: 0,
          },
        },
      },
      version: 0,
    }),
  )

  expect(createPicodashStore().getState().panelLayouts).toEqual({})
})

test('persists manual panel layout without persisting measured rect changes', () => {
  const storage = installFakeLocalStorage()
  const store = createPicodashStore()

  store.getState().setPanelLayout('inspect', { x: 24, y: 32 })
  store.getState().setPanelRect('inspect', rect(24, 32, 100, 80))

  expect(readPersistedPanelLayouts(storage, panelLayoutStorageKey)).toEqual({
    inspect: { dock: null, x: 24, y: 32 },
  })
})

test('persists docked panel layout edges', () => {
  const storage = installFakeLocalStorage()
  const store = createPicodashStore()

  store.getState().setPanelLayout('inspect', {
    dock: { horizontal: 'right', vertical: 'top' },
    x: 700,
    y: 8,
  })

  expect(readPersistedPanelLayouts(storage, panelLayoutStorageKey)).toEqual({
    inspect: { dock: { horizontal: 'right', vertical: 'top' }, x: 700, y: 8 },
  })
})

test('persists fixed placement while retaining the last non-fixed coordinates', () => {
  const storage = installFakeLocalStorage()
  const store = createPicodashStore()
  store.getState().registerPanel({ id: 'inspect' })
  store.getState().setPanelLayout('inspect', { x: 24, y: 32 })

  store.getState().setPanelPlacement('inspect', { mode: 'fixed', position: 'right' })

  expect(store.getState().panels.inspect.placement).toEqual({
    mode: 'fixed',
    position: 'right',
  })
  expect(readPersistedPanelLayouts(storage, panelLayoutStorageKey)).toEqual({
    inspect: {
      dock: null,
      placement: { mode: 'fixed', position: 'right' },
      x: 24,
      y: 32,
    },
  })

  store.getState().setPanelPlacement('inspect', { mode: 'floating' })

  expect(store.getState().panelLayouts.inspect).toEqual({
    dock: null,
    placement: { mode: 'floating' },
    x: 24,
    y: 32,
  })
})

test('uses the measured panel position when runtime placement has no saved layout', () => {
  const store = createPicodashStore({ persistLayout: false })
  store.getState().registerPanel({ id: 'inspect' })
  store.getState().setPanelRect('inspect', rect(240, 96, 100, 80))

  store.getState().setPanelPlacement('inspect', { mode: 'magnetic', position: 'top' })

  expect(store.getState().panelLayouts.inspect).toEqual({
    dock: { vertical: 'top' },
    placement: { mode: 'magnetic', position: 'top' },
    x: 240,
    y: 96,
  })
})

test('moves runtime floating corner placement within the panel boundary', () => {
  expect(
    positionForFloatingCorner('bottom-right', { height: 80, width: 100 }, rect(50, 20, 500, 300)),
  ).toEqual({ x: 434, y: 224 })
})

test('retains an explicit floating corner request while a retracted fixed panel is unmeasured', () => {
  const store = createPicodashStore({ persistLayout: false })
  store.getState().registerPanel({ id: 'inspect' })
  store.getState().setPanelLayout('inspect', { x: 24, y: 32 })
  store.getState().setPanelPlacement('inspect', { mode: 'fixed', position: 'right' })
  store.getState().setPanelRect('inspect', null)

  store.getState().setPanelPlacement('inspect', { mode: 'floating', position: 'bottom-right' })

  expect(store.getState().panelLayouts.inspect).toEqual({
    dock: null,
    placement: { mode: 'floating', position: 'bottom-right' },
    x: 24,
    y: 32,
  })
})

test('hydrates legacy docks as magnetic placement when a panel registers', () => {
  const storage = installFakeLocalStorage()
  storage.setItem(
    panelLayoutStorageKey,
    JSON.stringify({
      state: {
        panelLayouts: {
          inspect: {
            dock: { horizontal: 'left', vertical: 'bottom' },
            x: 8,
            y: 312,
          },
        },
      },
      version: 0,
    }),
  )
  const store = createPicodashStore()

  store.getState().registerPanel({ id: 'inspect' })

  expect(store.getState().panels.inspect.placement).toEqual({
    mode: 'magnetic',
    position: 'bottom-left',
  })
})

test('keeps legacy undocked layouts floating when a declaration now has a fixed default', () => {
  const storage = installFakeLocalStorage()
  storage.setItem(
    panelLayoutStorageKey,
    JSON.stringify({
      state: { panelLayouts: { inspect: { dock: null, x: 42, y: 24 } } },
      version: 0,
    }),
  )
  const store = createPicodashStore()

  store
    .getState()
    .registerPanel({ id: 'inspect', defaultPlacement: { mode: 'fixed', position: 'right' } })

  expect(store.getState().panels.inspect.placement).toEqual({ mode: 'floating' })
})

test('normalizes placement and converts magnetic edges without dock terminology in public types', () => {
  expect(normalizePicodashPanelPlacement('bottom-right')).toEqual({
    mode: 'floating',
    position: 'bottom-right',
  })
  expect(dockForSnapPosition('top-right')).toEqual({ horizontal: 'right', vertical: 'top' })
  expect(snapPositionForDock({ horizontal: 'left' })).toBe('left')
  expect(
    placementForPanelLayout({
      dock: { horizontal: 'right', vertical: 'bottom' },
      x: 0,
      y: 0,
    }),
  ).toEqual({ mode: 'magnetic', position: 'bottom-right' })
})

test('tracks panel boundary identity separately from persisted layout', () => {
  const store = createPicodashStore({ persistLayout: false })
  const boundary = { getBoundingClientRect: () => ({}) } as unknown as Element
  store.getState().registerPanel({ boundary, id: 'inspect' })
  store.getState().setPanelRect('inspect', rect(8, 8, 100, 80))

  expect(store.getState().panels.inspect.boundary).toBe(boundary)
  store.getState().setPanelBoundary('inspect', null)
  expect(store.getState().panels.inspect.boundary).toBeNull()
  expect(store.getState().panelRects.inspect).toBeUndefined()
})

test('resolves direct and referenced panel boundaries with provider fallback and viewport reset', () => {
  const providerBoundary = { getBoundingClientRect: () => ({}) } as unknown as Element
  const panelBoundary = { getBoundingClientRect: () => ({}) } as unknown as Element

  expect(resolvePicodashPanelBoundary(undefined, providerBoundary)).toBe(providerBoundary)
  expect(resolvePicodashPanelBoundary(null, providerBoundary)).toBeNull()
  expect(resolvePicodashPanelBoundary({ current: panelBoundary }, providerBoundary)).toBe(
    panelBoundary,
  )
  expect(resolvePicodashPanelBoundary({ current: null }, providerBoundary)).toBe(providerBoundary)
  expect(intersectPanelRects(rect(-20, 10, 100, 100), rect(0, 0, 60, 80))).toEqual(
    rect(0, 10, 60, 70),
  )
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
  const store = createPicodashPanelStore({ panelId: 'inspect' })

  store.getState().setFieldValue('exposure', 1.25)

  expect(store.getState().panelId).toBe('inspect')
  expect(store.getState().values.exposure).toBe(1.25)

  store.getState().resetFieldValue('exposure')

  expect(store.getState().values.exposure).toBeUndefined()
})

test('preserves collapsed group state across reorder layout remounts', () => {
  const store = createPicodashPanelStore({ panelId: 'inspect' })
  const group = {
    id: 'preview',
    kind: 'group' as const,
    parentId: 'root',
    reorderable: true,
  }

  store.getState().registerItem(group)
  store.getState().setGroupCollapsed(group.id, true)
  store.getState().unregisterItem(group.id)
  store.getState().registerItem(group)

  expect(store.getState().collapsedGroups.preview).toBe(true)
})

test('preserves control order slots across transient registration remounts', () => {
  const store = createPicodashPanelStore({ panelId: 'inspect' })
  const register = (id: string) =>
    store.getState().registerItem({
      id,
      kind: 'control',
      parentId: 'root',
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

test('snapshots dormant order slots for reversible keyboard reordering', () => {
  const store = createPicodashPanelStore({ panelId: 'inspect' })
  const register = (id: string) =>
    store.getState().registerItem({
      id,
      kind: 'control',
      parentId: 'root',
      reorderable: true,
    })

  register('alpha')
  register('beta')
  register('gamma')
  store.getState().setOrder('root', ['gamma', 'alpha', 'beta'])
  store.getState().unregisterItem('alpha')

  const snapshot = orderSnapshotForParent(store.getState(), 'root')
  store.getState().moveItemRelativeTo('gamma', 'beta', 'after')
  expect(store.getState().order.root).toEqual(['beta', 'gamma'])

  restoreKeyboardReorderOrder(store, 'root', snapshot)
  expect(store.getState().order.root).toEqual(['gamma', 'alpha', 'beta'])
})

test('uses a field-backed item field as its default ordering ID', () => {
  const children = [
    <TestItem field="exposure" label="Exposure" />,
    <TestItem id="summary" label="Summary" />,
  ]
  const ordered = orderPicodashChildren(children, ['summary', 'exposure'])

  expect(
    ordered.map((child) => (isValidElement<{ label: string }>(child) ? child.props.label : null)),
  ).toEqual(['Summary', 'Exposure'])
})

test('partitions only root children into their registered pin bands', () => {
  const partition = partitionPicodashChildrenByBand(
    [
      <TestItem id="toolbar" label="Toolbar" />,
      <TestItem field="exposure" label="Exposure" />,
      <TestItem id="status" label="Status" />,
      <span>Unregistered content</span>,
    ],
    { exposure: 'auto', status: 'end', toolbar: 'start' },
  )
  const labels = (children: typeof partition.auto) =>
    children.map((child) =>
      isValidElement<{ children?: string; label?: string }>(child)
        ? (child.props.label ?? child.props.children)
        : null,
    )

  expect(labels(partition.start)).toEqual(['Toolbar'])
  expect(labels(partition.auto)).toEqual(['Exposure', 'Unregistered content'])
  expect(labels(partition.end)).toEqual(['Status'])
})

test('preserves stale slots while multiple controls re-register out of order', () => {
  const store = createPicodashPanelStore({ panelId: 'inspect' })
  const register = (id: string) =>
    store.getState().registerItem({
      id,
      kind: 'control',
      parentId: 'root',
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
  const store = createPicodashPanelStore({ panelId: 'inspect' })
  store.getState().registerItem({
    id: 'preview',
    kind: 'group',
    parentId: 'root',
    reorderable: true,
  })
  store.getState().registerItem({
    id: 'output',
    kind: 'group',
    parentId: 'root',
    reorderable: true,
  })
  for (const id of ['exposure', 'quality']) {
    store.getState().registerItem({
      id,
      kind: 'control',
      parentId: 'preview',
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
    reorderable: true,
  })

  expect(orderedItemIdsForParent(store.getState(), 'root')).toEqual(['output', 'preview'])
  expect(orderedItemIdsForParent(store.getState(), 'preview')).toEqual(['quality', 'exposure'])
})

test('normalizes panel item order into start, unpinned, and end bands', () => {
  const store = createPicodashPanelStore({ panelId: 'inspect' })
  const register = (id: string, pin?: 'start' | 'end') => {
    store.getState().registerItem({
      id,
      kind: 'control',
      parentId: 'root',
      pin,
      reorderable: true,
    })
  }

  register('quality')
  register('summary', 'end')
  register('header', 'start')
  register('exposure')

  expect(store.getState().order.root).toEqual(['header', 'quality', 'exposure', 'summary'])

  store.getState().setOrder('root', ['summary', 'exposure', 'header', 'quality'])

  expect(store.getState().order.root).toEqual(['header', 'exposure', 'quality', 'summary'])
})

test('programmatic reorder stays within parent and pin band', () => {
  const store = createPicodashPanelStore({ panelId: 'inspect' })
  const register = (id: string, pin: 'start' | 'end' | undefined, parentId = 'root') => {
    store.getState().registerItem({
      id,
      kind: 'control',
      parentId,
      pin,
      reorderable: true,
    })
  }

  register('header', 'start')
  register('quality', undefined)
  register('exposure', undefined)
  register('summary', 'end')
  register('nested', undefined, 'group-a')

  store.getState().reorderItem('exposure', 'quality')
  expect(store.getState().order.root).toEqual(['header', 'exposure', 'quality', 'summary'])

  store.getState().reorderItem('summary', 'quality')
  expect(store.getState().order.root).toEqual(['header', 'exposure', 'quality', 'summary'])

  store.getState().reorderItem('nested', 'quality')
  expect(store.getState().order.root).toEqual(['header', 'exposure', 'quality', 'summary'])
})

test('requires a visible reorderable sibling in the same parent and pin band', () => {
  const store = createPicodashPanelStore({ panelId: 'inspect' })
  const register = ({
    hidden = false,
    id,
    parentId = 'root',
    pin,
    reorderable = true,
  }: {
    hidden?: boolean
    id: string
    parentId?: string
    pin?: 'start' | 'end'
    reorderable?: boolean
  }) => {
    store.getState().registerItem({
      hidden,
      id,
      kind: 'control',
      parentId,
      pin,
      reorderable,
    })
  }

  register({ id: 'quality' })
  register({ id: 'header', pin: 'start' })
  register({ id: 'fixed', reorderable: false })
  register({ hidden: true, id: 'hidden' })
  register({ id: 'nested', parentId: 'group-a' })

  expect(itemCanReorder(store.getState(), 'quality')).toBe(false)
  expect(itemCanReorder(store.getState(), 'header')).toBe(false)
  expect(itemCanReorder(store.getState(), 'fixed')).toBe(false)
  expect(itemCanReorder(store.getState(), 'hidden')).toBe(false)
  expect(itemCanReorder(store.getState(), 'nested')).toBe(false)
  expect(
    hasVisibleReorderableSibling(store.getState(), {
      id: 'quality',
      parentId: 'root',
      pin: undefined,
    }),
  ).toBe(false)

  register({ id: 'exposure' })

  expect(itemCanReorder(store.getState(), 'quality')).toBe(true)
  expect(itemCanReorder(store.getState(), 'exposure')).toBe(true)
  expect(itemCanReorder(store.getState(), 'fixed')).toBe(false)
})

test('reorder mutations reject an item whose only visible band sibling is fixed', () => {
  const store = createPicodashPanelStore({ panelId: 'inspect' })
  const register = (id: string, reorderable: boolean) => {
    store.getState().registerItem({
      id,
      kind: 'control',
      parentId: 'root',
      reorderable,
    })
  }

  register('quality', true)
  register('fixed', false)

  store.getState().moveItemToIndex('quality', 1)
  store.getState().moveItemRelativeTo('quality', 'fixed', 'after')
  store.getState().reorderItem('quality', 'fixed')
  store.getState().setDraggingItem('quality')

  expect(store.getState().order.root).toEqual(['quality', 'fixed'])
  expect(store.getState().interaction.draggingId).toBeNull()

  register('exposure', true)
  store.getState().moveItemToIndex('quality', 2)

  expect(store.getState().order.root).toEqual(['fixed', 'exposure', 'quality'])
})

test('drag commit moves items by visible pin-local index', () => {
  const store = createPicodashPanelStore({ panelId: 'inspect' })
  const register = (id: string, pin: 'start' | 'end' | undefined, hidden = false) => {
    store.getState().registerItem({
      hidden,
      id,
      kind: 'control',
      parentId: 'root',
      pin,
      reorderable: true,
    })
  }

  register('header', 'start')
  register('quality', undefined)
  register('advanced', undefined, true)
  register('exposure', undefined)
  register('render-scale', undefined)
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
  const store = createPicodashPanelStore({ panelId: 'inspect' })
  for (const id of ['quality', 'camera-height', 'render-scale']) {
    store.getState().registerItem({
      id,
      kind: 'control',
      parentId: 'root',
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
  const store = createPicodashPanelStore({ panelId: 'inspect' })
  for (const id of ['quality', 'camera-height', 'render-scale']) {
    store.getState().registerItem({
      id,
      kind: 'control',
      parentId: 'root',
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
  const store = createPicodashPanelStore({ panelId: 'inspect' })
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

function TestItem(_props: { field?: string; id?: string; label: string }) {
  return null
}

import { isValidElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vite-plus/test'
import * as advancedApi from '../src/advanced.ts'
import * as publicApi from '../src/index.ts'
import * as uiApi from '../src/ui.ts'
import { FeaturePanel } from '../src/index.ts'
import { formatNumericValue } from '../src/lib/formatting/number-format.ts'
import { panelLayoutStorageKey } from '../src/state/persistence/panel-persistence.ts'
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
} from '../src/geometry/panel-snapping.ts'
import { panelShellDragProps } from '../src/components/panel/PicodashPanel.tsx'
import {
  createPicodashProviderStore,
  modalZIndexForState,
  panelZIndexForState,
  portalLayerZIndexForState,
  portalLayerZIndexValue,
} from '../src/state/provider/picodash-provider.tsx'
import { PicodashReorderIndicator } from '../src/components/panel/reorder/PicodashReorderIndicator.tsx'
import {
  picodashDefaultTheme,
  picodashGeometryTokens,
  picodashLayerTokens,
  picodashMotionTokens,
  picodashThemeAttribute,
} from '../src/lib/theme/theme.ts'

test('keeps the public and advanced hook surfaces explicit', () => {
  expect(publicApi.usePicodashPanel).toBeTypeOf('function')
  expect(publicApi.usePicodashTheme).toBeTypeOf('function')
  expect('usePicodashPanelStoreSelector' in publicApi).toBe(false)
  expect('usePicodashPanelSelector' in publicApi).toBe(false)

  expect(advancedApi.createPicodashProviderStore).toBeTypeOf('function')
  expect(advancedApi.usePicodashPanelSelector).toBeTypeOf('function')
  expect(advancedApi.usePicodashPanelStoreApi).toBeTypeOf('function')
  expect(advancedApi.usePicodashProviderSelector).toBeTypeOf('function')
  expect(advancedApi.usePicodashProviderStoreApi).toBeTypeOf('function')
  expect('createPicodashStore' in advancedApi).toBe(false)
  expect('usePicodashGroupContext' in advancedApi).toBe(false)
  expect('usePicodashPanel' in advancedApi).toBe(false)
  expect('usePicodashPanelState' in advancedApi).toBe(false)
  expect('usePicodashProviderContext' in advancedApi).toBe(false)
  expect('usePicodashSelector' in advancedApi).toBe(false)
  expect('usePicodashStoreApi' in advancedApi).toBe(false)
})

test('preserves classic Zod composition on the advanced persistence schema', () => {
  const partialSchema = advancedApi.picodashPersistedStateSchema.partial()

  expect(partialSchema.safeParse({}).success).toBe(true)
  expect(
    advancedApi.picodashPersistedStateSchema.safeParse({
      panelLayouts: {
        inspect: {
          placement: { disposition: { kind: 'free' }, mode: 'hybrid' },
          preferredCoordinates: { x: 24, y: 32 },
        },
      },
    }).success,
  ).toBe(true)
})

test('renders the shared Select without creating a nested theme boundary', () => {
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
  expect(markup).not.toContain('data-picodash-theme')
  expect(markup).toContain('data-slot="select-trigger"')
})

test('clamps inferred number-format fraction digits to Intl support', () => {
  expect(() => formatNumericValue(1e-101)).not.toThrow()
  expect(formatNumericValue(1e-101)).toBe('0')
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

test('creates feature panel elements without creating a nested theme boundary', () => {
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
  expect(FeaturePanel(element.props).props['data-picodash-theme']).toBeUndefined()
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

test('tracks registered panels in the Picodash provider store', () => {
  const store = createPicodashProviderStore()

  store.getState().registerPanel({ id: 'inspect' })

  expect(store.getState().panels.inspect).toEqual({
    boundary: null,
    id: 'inspect',
    placement: {
      disposition: { kind: 'snapped', position: 'top-right' },
      mode: 'floating',
    },
    visible: true,
  })
  expect(store.getState().panelOrder).toEqual(['inspect'])

  store.getState().unregisterPanel('inspect')

  expect(store.getState().panels.inspect).toBeUndefined()
  expect(store.getState().panelOrder).toEqual([])
})

test('raises the most recently interacted panel above earlier panels', () => {
  const store = createPicodashProviderStore()

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
  const store = createPicodashProviderStore()

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
  const store = createPicodashProviderStore()

  store.getState().registerPanel({ id: 'scene', visible: false })
  store.getState().registerPanel({ id: 'output' })
  store.getState().activatePanel('scene')

  expect(store.getState().panels.scene.visible).toBe(true)
  expect(store.getState().panelOrder).toEqual(['output', 'scene'])
})

test('ignores visibility actions for unknown or unregistered panels', () => {
  const store = createPicodashProviderStore()
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

test('hydrates canonical persisted panel layouts', () => {
  const storage = installFakeLocalStorage()
  storage.setItem(
    panelLayoutStorageKey,
    JSON.stringify({
      state: {
        panelLayouts: {
          inspect: {
            placement: { disposition: { kind: 'free' }, mode: 'floating' },
            preferredCoordinates: { x: 42, y: -12 },
          },
        },
      },
      version: 0,
    }),
  )

  const store = createPicodashProviderStore()

  expect(store.getState().panelLayouts.inspect).toEqual({
    placement: { disposition: { kind: 'free' }, mode: 'floating' },
    preferredCoordinates: { x: 42, y: -12 },
  })
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

  const store = createPicodashProviderStore()

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

  expect(createPicodashProviderStore().getState().panelLayouts).toEqual({})
})

test('persists manual panel layout without persisting measured rect changes', () => {
  const storage = installFakeLocalStorage()
  const store = createPicodashProviderStore()

  store.getState().setPanelLayout('inspect', {
    placement: { disposition: { kind: 'free' }, mode: 'floating' },
    preferredCoordinates: { x: 24, y: 32 },
  })
  store.getState().setPanelRect('inspect', rect(24, 32, 100, 80))

  expect(readPersistedPanelLayouts(storage, panelLayoutStorageKey)).toEqual({
    inspect: {
      placement: { disposition: { kind: 'free' }, mode: 'floating' },
      preferredCoordinates: { x: 24, y: 32 },
    },
  })
})

test('persists docked panel placement and preferred coordinates', () => {
  const storage = installFakeLocalStorage()
  const store = createPicodashProviderStore()

  store.getState().setPanelLayout('inspect', {
    placement: {
      disposition: { kind: 'docked', position: 'top-right' },
      mode: 'hybrid',
    },
    preferredCoordinates: { x: 700, y: 8 },
  })

  expect(readPersistedPanelLayouts(storage, panelLayoutStorageKey)).toEqual({
    inspect: {
      placement: {
        disposition: { kind: 'docked', position: 'top-right' },
        mode: 'hybrid',
      },
      preferredCoordinates: { x: 700, y: 8 },
    },
  })
})

test('keeps explicitly floating edge snaps floating', () => {
  const store = createPicodashProviderStore({ persistLayout: false })
  store.getState().registerPanel({ id: 'inspect' })

  store.getState().setPanelLayout('inspect', {
    placement: {
      disposition: { kind: 'snapped', position: 'top-left' },
      mode: 'floating',
    },
    preferredCoordinates: { x: 8, y: 8 },
  })

  expect(store.getState().panels.inspect.placement).toEqual({
    disposition: { kind: 'snapped', position: 'top-left' },
    mode: 'floating',
  })
})

test('persists fixed placement while retaining preferred coordinates', () => {
  const storage = installFakeLocalStorage()
  const store = createPicodashProviderStore()
  store.getState().registerPanel({ id: 'inspect' })
  store.getState().setPanelLayout('inspect', {
    placement: { disposition: { kind: 'free' }, mode: 'floating' },
    preferredCoordinates: { x: 24, y: 32 },
  })

  store.getState().setPanelPlacement('inspect', {
    disposition: { kind: 'docked', position: 'full-right' },
    mode: 'fixed',
  })

  expect(store.getState().panels.inspect.placement).toEqual({
    disposition: { kind: 'docked', position: 'full-right' },
    mode: 'fixed',
  })
  expect(readPersistedPanelLayouts(storage, panelLayoutStorageKey)).toEqual({
    inspect: {
      placement: {
        disposition: { kind: 'docked', position: 'full-right' },
        mode: 'fixed',
      },
      preferredCoordinates: { x: 24, y: 32 },
    },
  })

  store.getState().setPanelPlacement('inspect', { disposition: { kind: 'free' }, mode: 'floating' })

  expect(store.getState().panelLayouts.inspect).toEqual({
    placement: { disposition: { kind: 'free' }, mode: 'floating' },
    preferredCoordinates: { x: 24, y: 32 },
  })
})

test('uses the measured panel position when runtime placement has no saved layout', () => {
  const store = createPicodashProviderStore({ persistLayout: false })
  store.getState().registerPanel({ id: 'inspect' })
  store.getState().setPanelRect('inspect', rect(240, 96, 100, 80))

  store.getState().setPanelPlacement('inspect', {
    disposition: { kind: 'snapped', position: 'top' },
    mode: 'hybrid',
  })

  expect(store.getState().panelLayouts.inspect).toEqual({
    placement: {
      disposition: { kind: 'snapped', position: 'top' },
      mode: 'hybrid',
    },
    preferredCoordinates: { x: 240, y: 96 },
  })
})

test('keeps detached runtime hybrid placement free', () => {
  const store = createPicodashProviderStore({ persistLayout: false })
  store.getState().registerPanel({ id: 'inspect' })
  store.getState().setPanelLayout('inspect', {
    placement: {
      disposition: { kind: 'docked', position: 'full-left' },
      mode: 'hybrid',
    },
    preferredCoordinates: { x: 0, y: 96 },
  })

  store.getState().setPanelPlacement('inspect', { disposition: { kind: 'free' }, mode: 'hybrid' })

  expect(store.getState().panelLayouts.inspect).toEqual({
    placement: { disposition: { kind: 'free' }, mode: 'hybrid' },
    preferredCoordinates: { x: 0, y: 96 },
  })
  expect(store.getState().panels.inspect.placement).toEqual({
    disposition: { kind: 'free' },
    mode: 'hybrid',
  })
})

test('moves runtime floating corner placement within the panel boundary', () => {
  expect(
    positionForFloatingCorner('bottom-right', { height: 80, width: 100 }, rect(50, 20, 500, 300)),
  ).toEqual({ x: 442, y: 232 })
})

test('retains an explicit floating corner request while a retracted fixed panel is unmeasured', () => {
  const store = createPicodashProviderStore({ persistLayout: false })
  store.getState().registerPanel({ id: 'inspect' })
  store.getState().setPanelLayout('inspect', {
    placement: { disposition: { kind: 'free' }, mode: 'floating' },
    preferredCoordinates: { x: 24, y: 32 },
  })
  store.getState().setPanelPlacement('inspect', {
    disposition: { kind: 'docked', position: 'full-right' },
    mode: 'fixed',
  })
  store.getState().setPanelRect('inspect', null)

  store.getState().setPanelPlacement('inspect', {
    disposition: { kind: 'snapped', position: 'bottom-right' },
    mode: 'floating',
  })

  expect(store.getState().panelLayouts.inspect).toEqual({
    placement: {
      disposition: { kind: 'snapped', position: 'bottom-right' },
      mode: 'floating',
    },
    preferredCoordinates: { x: 24, y: 32 },
  })
})

test('ignores obsolete dock records when a panel registers', () => {
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
  const store = createPicodashProviderStore()

  store.getState().registerPanel({ id: 'inspect' })

  expect(store.getState().panels.inspect.placement).toEqual({
    disposition: { kind: 'snapped', position: 'top-right' },
    mode: 'floating',
  })
  expect(store.getState().panelLayouts).toEqual({})
})

test('uses the declared default when an obsolete undocked record cannot hydrate', () => {
  const storage = installFakeLocalStorage()
  storage.setItem(
    panelLayoutStorageKey,
    JSON.stringify({
      state: { panelLayouts: { inspect: { dock: null, x: 42, y: 24 } } },
      version: 0,
    }),
  )
  const store = createPicodashProviderStore()

  store.getState().registerPanel({
    id: 'inspect',
    defaultPlacement: {
      disposition: { kind: 'docked', position: 'full-right' },
      mode: 'fixed',
    },
  })

  expect(store.getState().panels.inspect.placement).toEqual({
    disposition: { kind: 'docked', position: 'full-right' },
    mode: 'fixed',
  })
  expect(store.getState().panelLayouts).toEqual({})
})

test('normalizes canonical placement without public dock aliases', () => {
  const placement = {
    disposition: { kind: 'snapped' as const, position: 'bottom-right' as const },
    mode: 'floating' as const,
  }
  expect(normalizePicodashPanelPlacement(placement)).toBe(placement)
  expect(dockForSnapPosition('top-right')).toEqual({ horizontal: 'right', vertical: 'top' })
  expect(snapPositionForDock({ horizontal: 'left' })).toBe('left')
  expect(
    placementForPanelLayout({
      placement: {
        disposition: { kind: 'docked', position: 'bottom-right' },
        mode: 'hybrid',
      },
      preferredCoordinates: { x: 0, y: 0 },
    }),
  ).toEqual({
    disposition: { kind: 'docked', position: 'bottom-right' },
    mode: 'hybrid',
  })
})

test('tracks panel boundary identity separately from persisted layout', () => {
  const store = createPicodashProviderStore({ persistLayout: false })
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
        placement: {
          disposition: { kind: 'docked', position: 'top-right' },
          mode: 'hybrid',
        },
        preferredCoordinates: { x: 240, y: 260 },
      },
    }),
  ).toEqual({ x: 200, y: -100 })
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

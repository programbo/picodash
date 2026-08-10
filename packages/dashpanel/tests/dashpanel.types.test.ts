import { createElement, type CSSProperties, type RefObject } from 'react'
import { describe, it } from 'vite-plus/test'
import type { DashPanelPlacementRecord } from '@picodash/store'
import { createPicodashStore } from '@picodash/store'
import {
  ActionMenu,
  ActionMenuItem,
  ActionMenuSeparator,
  ActionSubmenu,
  DashHeader,
  DashPanel,
  DashPanelActionItems,
  DashPanelLauncher,
  DashPanelProvider,
  DashPanelTrigger,
  type DashPanelLauncherProps,
  type ActionMenuConfirmationGuard,
  type DashPanelRemoveRequest,
  type DashPanelCommandResult,
  type DashPanelController,
  type DashPanelLayoutCommandResult,
  type DashPanelProps,
  type DashPanelProviderProps,
  type DashPanelTriggerProps,
  type DashPanelBoundary,
  type DashPanelBoundaryInset,
  type DashPanelDefaultLayout,
  type DashPanelDockPosition,
  type DashPanelPlacement,
  type DashPanelPlacementOptions,
  type DashPanelPresentation,
  type DashPanelSnapPosition,
  type DashPanelStyle,
} from '../src/index.tsx'
import {
  DashPanelIntegrationProvider,
  type DashPanelDefaultActionItems,
  type DashPanelDefaultActionItemsProps,
  type DashPanelIntegrationProviderProps,
} from '../src/integration.tsx'

const store = createPicodashStore({ valueOwner: 'store', fields: { value: { defaultValue: 1 } } })

describe('@picodash/dashpanel public types', () => {
  it('exposes the frozen provider/panel shell and rejects retired or reserved props', () => {
    const boundary = {} as Element
    const guard: ActionMenuConfirmationGuard = {
      fingerprint: 'panel:v1',
      getFingerprint: () => 'panel:v1',
      subscribe: () => () => undefined,
    }
    void guard
    const providerProps: DashPanelProviderProps = {
      store,
      children: null,
      boundary,
      boundaryInset: [8, 16],
      dockPositions: ['top-left', 'center-left'],
      portalContainer: boundary as HTMLElement,
    }
    const viewportProviderProps: DashPanelProviderProps = { ...providerProps, boundary: null }
    void viewportProviderProps
    const panelProps: DashPanelProps = {
      id: 'inspector',
      title: 'Inspector',
      'aria-label': 'Inspector',
      style: { opacity: 0.8, '--consumer-token': 'ok' } as DashPanelStyle,
      width: '24rem',
      defaultCollapsed: true,
      defaultVisible: false,
      collapsible: true,
      showCloseButton: false,
      onVisibilityChange: () => {},
      onRequestRemove: (details: DashPanelRemoveRequest) => details.scopeId,
      actionMenu: [],
      onCollapsedChange: () => {},
      boundary,
      boundaryInset: 8,
      dockPositions: ['top-left'],
      defaultLayout: {
        placement: { mode: 'floating', disposition: { kind: 'snapped', position: 'top-right' } },
        preferredPosition: { x: 0, y: 0 },
      },
      placementOptions: { snapOffset: 8, snapProximity: 16, detachDistance: 40 },
      presentation: { kind: 'panel' },
    }
    const customThemePanelProps: DashPanelProps<'operator'> = {
      id: 'operator-inspector',
      title: 'Operator inspector',
      theme: 'operator',
    }
    const ref: RefObject<HTMLElement | null> = { current: null }
    void createElement(DashPanelProvider, providerProps)
    void createElement(DashPanel, { ...panelProps, ref })
    void createElement(DashPanel, customThemePanelProps)
    const trigger: DashPanelTriggerProps = { panelId: 'inspector', action: 'toggle' }
    const launcher: DashPanelLauncherProps = {
      label: 'Panels',
      items: [{ panelId: 'inspector', label: 'Inspector', disabled: false }],
    }
    const iconLauncher: DashPanelLauncherProps = {
      label: 'Panels',
      items: [
        {
          panelId: 'inspector',
          label: createElement('span', { 'aria-hidden': true }, 'I'),
          accessibleName: 'Inspector',
        },
      ],
    }
    const unnamedIconLauncher: DashPanelLauncherProps = {
      label: 'Panels',
      items: [
        // @ts-expect-error non-text launcher labels require an explicit accessible name.
        { panelId: 'inspector', label: createElement('span', null, 'I') },
      ],
    }
    void createElement(DashPanelTrigger, trigger)
    void createElement(DashPanelLauncher, launcher)
    void createElement(DashPanelLauncher, iconLauncher)
    const controller = {} as DashPanelController
    const commandResult = {} as DashPanelCommandResult
    const layoutResult = {} as DashPanelLayoutCommandResult
    void controller
    void commandResult
    void layoutResult
    void unnamedIconLauncher
    void DashHeader
    void DashPanelActionItems
    void DashPanelIntegrationProvider
    void ActionMenu
    void ActionMenuItem
    void ActionMenuSeparator
    void ActionSubmenu

    // @ts-expect-error scoped Stores cannot satisfy the Provider root Store contract.
    const scoped: DashPanelProviderProps = { store: store.scope('scope'), children: null }
    void scoped

    // @ts-expect-error width is controlled by the width prop.
    const directWidth: DashPanelProps = { ...panelProps, style: { width: '1px' } }
    void directWidth

    // @ts-expect-error inlineSize is controlled by the width prop.
    const directInlineSize: DashPanelProps = { ...panelProps, style: { inlineSize: '1px' } }
    void directInlineSize

    // @ts-expect-error visibility attributes are owned by the lifecycle runtime.
    const nativeHidden: DashPanelProps = { ...panelProps, hidden: true }
    // @ts-expect-error visibility attributes are owned by the lifecycle runtime.
    const nativeInert: DashPanelProps = { ...panelProps, inert: true }
    // @ts-expect-error visibility attributes are owned by the lifecycle runtime.
    const nativeAriaHidden: DashPanelProps = { ...panelProps, 'aria-hidden': true }
    void nativeHidden
    void nativeInert
    void nativeAriaHidden

    // @ts-expect-error Provider does not own persistence or placement policy in this cut.
    const retiredProvider: DashPanelProviderProps = { ...providerProps, storageKey: 'old' }
    void retiredProvider

    // @ts-expect-error boundary accepts Elements or RefObjects, not selectors.
    const selectorBoundary: DashPanelProviderProps = { ...providerProps, boundary: '#panel' }
    void selectorBoundary
    // @ts-expect-error null is reserved for explicit viewport boundary selection, not inset values.
    const nullInset: DashPanelProviderProps = { ...providerProps, boundaryInset: null }
    void nullInset
    const unknownDock: DashPanelProviderProps = {
      ...providerProps,
      // @ts-expect-error dock positions must use canonical literals.
      dockPositions: ['middle-left'],
    }
    void unknownDock

    // @ts-expect-error Panel does not expose prototype compatibility props.
    const retiredPanel: DashPanelProps = { ...panelProps, contentMode: 'plain' }
    void retiredPanel

    // @ts-expect-error controlled visibility remains excluded from this cut.
    const retiredVisibility: DashPanelProps = { ...panelProps, visible: false }
    void retiredVisibility

    const invalidTrigger: DashPanelTriggerProps = {
      panelId: 'inspector',
      // @ts-expect-error trigger actions are limited to show and toggle.
      action: 'hide',
    }
    void invalidTrigger

    const panelBoundary: DashPanelProps = { ...panelProps, boundary: null }
    const panelInset: DashPanelProps = { ...panelProps, boundaryInset: [1, 2, 3, 4] }
    const panelDocks: DashPanelProps = { ...panelProps, dockPositions: [] }
    void panelBoundary
    void panelInset
    void panelDocks
  })

  it('exposes the narrow action contribution and removal contracts', () => {
    const Contributor: DashPanelDefaultActionItems = ({
      scopeId,
    }: DashPanelDefaultActionItemsProps) => createElement('span', null, scopeId)
    const integrationProps: DashPanelIntegrationProviderProps = {
      children: null,
      defaultActionItems: Contributor,
    }
    const remove: DashPanelRemoveRequest = { scopeId: 'inspector' }
    void integrationProps
    void remove
  })

  it('keeps the style type aligned with React CSSProperties except reserved sizing keys', () => {
    const style: DashPanelStyle = { color: 'red', minWidth: 0 } as CSSProperties
    void style
    // @ts-expect-error width is intentionally omitted from DashPanelStyle.
    const width: DashPanelStyle = { width: '1rem' }
    void width
    // @ts-expect-error inlineSize is intentionally omitted from DashPanelStyle.
    const inlineSize: DashPanelStyle = { inlineSize: '1rem' }
    void inlineSize
  })

  it('exports placement vocabulary compatible with Store records in both directions', () => {
    const snap: DashPanelSnapPosition = 'top-right'
    const dock: DashPanelDockPosition = 'center-bottom'
    const placement: DashPanelPlacement = {
      mode: 'hybrid',
      disposition: { kind: 'docked', position: dock },
    }
    const record: DashPanelPlacementRecord = placement
    const roundTrip: DashPanelPlacement = record
    const layout: DashPanelDefaultLayout = {
      placement: roundTrip,
      preferredPosition: { x: -1, y: 2 },
    }
    const options: DashPanelPlacementOptions = { snapOffset: 0 }
    const presentation: DashPanelPresentation = { kind: 'drawer', edge: 'left' }
    void snap
    void layout
    void options
    void presentation

    // @ts-expect-error fixed Panels cannot use free dispositions.
    const fixedFree: DashPanelPlacement = { mode: 'fixed', disposition: { kind: 'free' } }
    void fixedFree
    // @ts-expect-error hybrid snaps are limited to the top and bottom edges.
    const hybridLeft: DashPanelPlacement = {
      mode: 'hybrid',
      disposition: { kind: 'snapped', position: 'left' },
    }
    void hybridLeft
    // @ts-expect-error middle-left is not a canonical snap position.
    const retiredSnap: DashPanelSnapPosition = 'middle-left'
    void retiredSnap
  })

  it('exports boundary references and exact inset tuple shapes without runtime additions', () => {
    const element = {} as Element
    const ref: DashPanelBoundary = { current: element }
    const direct: DashPanelBoundary = element
    const scalar: DashPanelBoundaryInset = 8
    const pair: DashPanelBoundaryInset = [8, 16]
    const triple: DashPanelBoundaryInset = [1, 2, 3]
    const quad: DashPanelBoundaryInset = [1, 2, 3, 4]
    void ref
    void direct
    void scalar
    void pair
    void triple
    void quad

    // @ts-expect-error boundary references are Elements or RefObjects, not selectors.
    const selector: DashPanelBoundary = '#panel'
    void selector
    // @ts-expect-error inset tuples must contain two, three, or four numbers.
    const oneInset: DashPanelBoundaryInset = [8]
    void oneInset
    // @ts-expect-error inset tuples must contain two, three, or four numbers.
    const fiveInset: DashPanelBoundaryInset = [1, 2, 3, 4, 5]
    void fiveInset
  })
})

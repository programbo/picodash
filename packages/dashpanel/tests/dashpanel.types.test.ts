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
  DashPanelProvider,
  type DashPanelProps,
  type DashPanelProviderProps,
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

const store = createPicodashStore({ valueOwner: 'store', fields: { value: { defaultValue: 1 } } })

describe('@picodash/dashpanel public types', () => {
  it('exposes the frozen provider/panel shell and rejects retired or reserved props', () => {
    const providerProps: DashPanelProviderProps = { store, children: null }
    const panelProps: DashPanelProps = {
      id: 'inspector',
      title: 'Inspector',
      'aria-label': 'Inspector',
      style: { opacity: 0.8, '--consumer-token': 'ok' } as DashPanelStyle,
      width: '24rem',
      defaultCollapsed: true,
      collapsible: true,
      onCollapsedChange: () => {},
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
    void DashHeader
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

    // @ts-expect-error Provider does not own persistence or placement policy in this cut.
    const retiredProvider: DashPanelProviderProps = { ...providerProps, storageKey: 'old' }
    void retiredProvider

    // @ts-expect-error Panel does not expose prototype compatibility props.
    const retiredPanel: DashPanelProps = { ...panelProps, contentMode: 'plain' }
    void retiredPanel

    // @ts-expect-error visibility/controller props remain excluded from this cut.
    const retiredVisibility: DashPanelProps = { ...panelProps, visible: false }
    void retiredVisibility
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

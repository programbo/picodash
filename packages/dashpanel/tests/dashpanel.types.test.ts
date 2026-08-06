import { createElement, type CSSProperties, type RefObject } from 'react'
import { describe, it } from 'vite-plus/test'
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
})

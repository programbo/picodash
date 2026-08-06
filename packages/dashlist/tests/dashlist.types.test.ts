import { createElement, type RefObject } from 'react'
import { describe, it } from 'vite-plus/test'
import { createPicodashStore } from '@picodash/store'
import {
  ActionMenu,
  DashGroup,
  DashHeader,
  DashList,
  Dashlet,
  type DashListProps,
  type DashletProps,
} from '../src/index.tsx'

const store = createPicodashStore({ valueOwner: 'store', fields: { value: { defaultValue: 1 } } })
type Fields = { value: { defaultValue: number } }

describe('@picodash/dashlist public types', () => {
  it('exposes only the shell props and shared identity types', () => {
    const root: DashListProps = {
      id: 'settings',
      store,
      title: 'Settings',
      headingLevel: 2,
      theme: 'dark',
      density: 'compact',
      'aria-label': 'Settings list',
    }
    const scoped: DashListProps = { store: store.scope('settings') }
    const customTheme: DashListProps<Fields, 'operator'> = {
      id: 'operator',
      store,
      theme: 'operator',
    }
    const ref: RefObject<HTMLDivElement | null> = { current: null }
    void createElement(DashList, { ...root, ref })
    void createElement(DashList, scoped)
    void createElement(DashList, customTheme)
    void createElement(DashGroup, { id: 'group', label: 'Group' })
    void createElement(Dashlet, { id: 'item', label: 'Item', children: 'Value' })
    void DashHeader
    void ActionMenu

    // @ts-expect-error root Store resolution requires an explicit id.
    const rootless: DashListProps = { store }
    void rootless
    // @ts-expect-error visible is not part of the alpha shell.
    const visible: DashListProps = { ...root, visible: true }
    void visible
    // @ts-expect-error fields/bindings are not part of the alpha shell.
    const field: Parameters<typeof Dashlet>[0] = { id: 'bound', field: {} as never }
    void field
    // @ts-expect-error registered shells reserve semantic ARIA relationships.
    const reserved: DashletProps = { id: 'reserved', label: 'Reserved', 'aria-invalid': true }
    void reserved
  })
})

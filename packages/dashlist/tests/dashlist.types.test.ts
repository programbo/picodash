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
  type CompoundDashletProps,
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
    const field: Parameters<typeof Dashlet>[0] = { id: 'bound', field: {} as never }
    void field
    // @ts-expect-error registered shells reserve semantic ARIA relationships.
    const reserved: DashletProps = { id: 'reserved', label: 'Reserved', 'aria-invalid': true }
    void reserved

    type Values = { value: number }
    const display: DashletProps<Values, 'value', 'display'> = {
      id: 'display',
      label: 'Display',
      field: store.fields.value,
      mode: 'display',
      children(context) {
        const mode: 'display' = context.binding.mode
        const value: number = context.binding.value
        // @ts-expect-error display bindings expose no mutation command.
        void context.binding.setInput
        return `${mode}:${value}`
      },
    }
    void display

    const compoundFields = {
      readout: { field: store.fields.value, mode: 'display' as const },
      editor: store.fields.value,
    } as const
    const compound: CompoundDashletProps<Values, typeof compoundFields> = {
      id: 'compound',
      label: 'Compound',
      fields: compoundFields,
      children(context) {
        const readoutMode: 'display' = context.bindings.readout.mode
        const editorMode: 'input' = context.bindings.editor.mode
        const value: number = context.bindings.readout.value
        // @ts-expect-error a literal display descriptor has no input command.
        void context.bindings.readout.discardInput
        context.bindings.editor.setInput(value)
        return `${readoutMode}:${editorMode}`
      },
    }
    void compound

    // @ts-expect-error unbound Dashlets cannot declare a top-level mode.
    const unboundMode: DashletProps<Values> = { id: 'bad-mode', mode: 'display' }
    void unboundMode
    const compoundMode: CompoundDashletProps<Values, typeof compoundFields> = {
      id: 'bad-compound-mode',
      fields: compoundFields,
      // @ts-expect-error compound Dashlets cannot declare a top-level mode.
      mode: 'input',
    }
    void compoundMode
    const presentation: DashletProps<Values, 'value'> = {
      id: 'presentation',
      field: store.fields.value,
      // @ts-expect-error the deferred generic presentation contract is not public.
      presentation: {},
    }
    void presentation
  })
})

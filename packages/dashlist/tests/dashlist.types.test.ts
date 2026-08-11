import { createElement, type RefObject } from 'react'
import { describe, it } from 'vite-plus/test'
import { createPicodashNexus } from '@picodash/nexus'
import {
  ActionMenu,
  DashGroup,
  DashHeader,
  DashList,
  Dashlet,
  DashListActionItems,
  DashListCollapseAllItem,
  DashListExpandAllItem,
  DashListResetListItem,
  DashListResetSubmenu,
  DashListResetValuesItem,
  useDashListActions,
  type DashListProps,
  type ActionMenuConfirmationGuard,
  type CompoundDashletProps,
  type DashletProps,
} from '../src/index.tsx'

const nexus = createPicodashNexus({ valueOwner: 'nexus', fields: { value: { defaultValue: 1 } } })
type Fields = { value: { defaultValue: number } }

describe('@picodash/dashlist public types', () => {
  it('exposes only the shell props and shared identity types', () => {
    const root: DashListProps = {
      id: 'settings',
      nexus,
      title: 'Settings',
      headingLevel: 2,
      theme: 'dark',
      density: 'compact',
      'aria-label': 'Settings list',
      reorderable: true,
    }
    const scoped: DashListProps = { nexus: nexus.scope('settings') }
    const customTheme: DashListProps<Fields, 'operator'> = {
      id: 'operator',
      nexus,
      theme: 'operator',
    }
    const ref: RefObject<HTMLDivElement | null> = { current: null }
    const guard: ActionMenuConfirmationGuard = {
      fingerprint: 'list:v1',
      getFingerprint: () => 'list:v1',
      subscribe: () => () => undefined,
    }
    void guard
    void createElement(DashList, { ...root, ref })
    void createElement(DashList, scoped)
    void createElement(DashList, customTheme)
    void createElement(DashGroup, {
      id: 'group',
      label: 'Group',
      collapsible: true,
      defaultCollapsed: false,
      reorderable: false,
      pin: 'start',
      disabled: false,
      readOnly: false,
    })
    // @ts-expect-error collapse is Nexus-controlled and cannot be supplied as a controlled prop.
    void createElement(DashGroup, { id: 'controlled', label: 'Controlled', collapsed: true })
    void createElement(Dashlet, { id: 'item', label: 'Item', pin: 'end', children: 'Value' })
    void DashHeader
    void ActionMenu
    void DashListActionItems
    void DashListExpandAllItem
    void DashListCollapseAllItem
    void DashListResetSubmenu
    void DashListResetValuesItem
    void DashListResetListItem
    void useDashListActions
    void createElement(DashListExpandAllItem, { scopeId: 'settings' })
    // @ts-expect-error action items target Nexus context, not a supplied Nexus prop.
    void createElement(DashListExpandAllItem, { nexus })

    // @ts-expect-error root Nexus resolution requires an explicit id.
    const rootless: DashListProps = { nexus }
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
      field: nexus.fields.value,
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
      readout: { field: nexus.fields.value, mode: 'display' as const },
      editor: nexus.fields.value,
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
        // @ts-expect-error stale overwrite plans remain shell-owned and are not render-context API.
        void context.bindings.editor.createStaleInputOverwritePlan
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
      field: nexus.fields.value,
      // @ts-expect-error the deferred generic presentation contract is not public.
      presentation: {},
    }
    void presentation
  })
})

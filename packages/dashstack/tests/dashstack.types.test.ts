import { createElement, type RefObject } from 'react'
import { describe, it } from 'vite-plus/test'
import { createPicodashNexus } from '@picodash/nexus'
import {
  ActionMenu,
  DashGroup,
  DashHeader,
  DashStack,
  Dashlet,
  DashStackActionItems,
  DashStackCollapseAllItem,
  DashStackExpandAllItem,
  DashStackResetStackItem,
  DashStackResetSubmenu,
  DashStackResetValuesItem,
  useDashStackActions,
  type DashStackProps,
  type ActionMenuConfirmationGuard,
  type CompoundDashletProps,
  type DashletProps,
} from '../src/index.tsx'

const nexus = createPicodashNexus({ valueOwner: 'nexus', fields: { value: { defaultValue: 1 } } })
type Fields = { value: { defaultValue: number } }

describe('@picodash/dashstack public types', () => {
  it('exposes only the shell props and shared identity types', () => {
    void createElement(Dashlet, {
      id: 'authored',
      label: 'Authored',
      band: true,
      glow: '#ffcc00',
      tint: 'var(--brand)',
    })
    void createElement(Dashlet, { id: 'off', label: 'Off', band: false, glow: false, tint: false })
    // @ts-expect-error emphasis accepts booleans or CSS colors, not numeric amounts.
    void createElement(Dashlet, { id: 'invalid-emphasis', label: 'Invalid', band: 0.5 })
    const root: DashStackProps = {
      id: 'settings',
      nexus,
      title: 'Settings',
      headingLevel: 2,
      theme: 'dark',
      density: 'compact',
      'aria-label': 'Settings list',
      reorderable: true,
    }
    const scoped: DashStackProps = { nexus: nexus.scope('settings') }
    const customTheme: DashStackProps<Fields, 'operator'> = {
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
    void createElement(DashStack, { ...root, ref })
    void createElement(DashStack, scoped)
    void createElement(DashStack, customTheme)
    void createElement(DashGroup, {
      id: 'group',
      label: 'Group',
      labelColor: 'var(--brand-accent)',
      collapsible: true,
      defaultCollapsed: false,
      reorderable: false,
      pin: 'start',
      disabled: false,
      readOnly: false,
    })
    // @ts-expect-error collapse is Nexus-controlled and cannot be supplied as a controlled prop.
    void createElement(DashGroup, { id: 'controlled', label: 'Controlled', collapsed: true })
    const primaryFocusRef: RefObject<HTMLElement | null> = { current: null }
    void createElement(Dashlet, {
      id: 'item',
      label: 'Item',
      pin: 'end',
      help: 'Help text',
      primaryFocusRef,
      children: 'Value',
    })
    void DashHeader
    void ActionMenu
    void DashStackActionItems
    void DashStackExpandAllItem
    void DashStackCollapseAllItem
    void DashStackResetSubmenu
    void DashStackResetValuesItem
    void DashStackResetStackItem
    void useDashStackActions
    void createElement(DashStackExpandAllItem, { scopeId: 'settings' })
    // @ts-expect-error action items target Nexus context, not a supplied Nexus prop.
    void createElement(DashStackExpandAllItem, { nexus })

    // @ts-expect-error root Nexus resolution requires an explicit id.
    const rootless: DashStackProps = { nexus }
    void rootless
    // @ts-expect-error visible is not part of the alpha shell.
    const visible: DashStackProps = { ...root, visible: true }
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

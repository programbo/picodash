'use client'

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import {
  DashList,
  DashGroup,
  Dashlet,
  DashListResetValuesItem,
  DashListResetListItem,
  DisplayDashlet,
  NumberDashlet,
  SwitchDashlet,
  TextDashlet,
} from '@picodash/dashlist'
import { ActionMenu, Button, PicodashThemeProvider, type PicodashThemeOption } from '@picodash/ui'
import type {
  PicodashDevBridgeDisclosure,
  PicodashDevBridgePermissions,
} from '@picodash/dev-bridge'
import { ReorderLab } from './reorder-lab'
import { ContractLabDevBridgeConnector } from './dev-bridge-connector'
import { renderComposedValueBindings } from './composed-value-bindings'
import { createValueBindingNexus, type ValueBindingNexus } from './value-binding-model'
import { useContractLabDiagnosticCount } from './nexus-diagnostics'

const disclosure: PicodashDevBridgeDisclosure = {
  valueFields: ['name', 'interval', 'enabled'],
  scopeIds: ['binding-ready-made', 'binding-composed', 'binding-reordering'],
  diagnostics: false,
}
const permissions: PicodashDevBridgePermissions = {
  writableFields: ['name', 'interval', 'enabled'],
}
const themes = ['light', 'dark', 'system', 'ocean'] as const

interface ValueBindingLabProps {
  readonly onReady: () => void
  readonly onDiagnosticCountChange: (count: number) => void
}

export function ValueBindingLab(props: ValueBindingLabProps) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ready'; nexus: ValueBindingNexus }
    | { status: 'unavailable' }
  >({ status: 'loading' })
  useEffect(() => {
    let active = true
    let root: ValueBindingNexus | undefined
    queueMicrotask(() => {
      if (!active) return
      try {
        root = createValueBindingNexus()
        setState({ status: 'ready', nexus: root })
      } catch (error) {
        if (error instanceof Error && error.name === 'PicodashInitializationError') {
          setState({ status: 'unavailable' })
          return
        }
        throw error
      }
    })
    return () => {
      active = false
      const ownedRoot = root
      if (ownedRoot) queueMicrotask(() => ownedRoot.destroy({ discardUnpersisted: true }))
    }
  }, [])
  useEffect(() => {
    if (state.status === 'unavailable') props.onReady()
  }, [state.status, props.onReady])
  if (state.status === 'unavailable')
    return (
      <p role="alert">
        Saved values could not be opened. Check browser storage or use Reset lab to clear this
        example.
      </p>
    )
  return state.status === 'ready' ? <ValueBindingContent {...props} nexus={state.nexus} /> : null
}

function ValueBindingContent({
  nexus,
  onReady,
  onDiagnosticCountChange,
}: ValueBindingLabProps & {
  readonly nexus: ValueBindingNexus
}) {
  const [theme, setTheme] = useState<PicodashThemeOption<'ocean'>>('system')
  const [disabled, setDisabled] = useState(false)
  const [writeStatus, setWriteStatus] = useState('')
  const subscribe = useCallback(
    (listener: () => void) => nexus.persistence.subscribe(listener),
    [nexus],
  )
  const getPersistence = useCallback(() => nexus.persistence.getState(), [nexus])
  const persistence = useSyncExternalStore(subscribe, getPersistence, getPersistence)
  const saveMessage = {
    clean: 'Saved in this browser.',
    pending: 'Changes are not yet saved.',
    error: 'Changes could not be saved.',
    conflict: 'Saved values changed elsewhere. Changes are not saved.',
  }[persistence.status]
  const sources = useMemo(() => [nexus], [nexus])
  const diagnosticCount = useContractLabDiagnosticCount(sources)

  useEffect(onReady, [onReady])
  useEffect(() => {
    onDiagnosticCountChange(diagnosticCount)
    return () => onDiagnosticCountChange(0)
  }, [diagnosticCount, onDiagnosticCountChange])

  return (
    <PicodashThemeProvider<'ocean'> theme={theme}>
      <ContractLabDevBridgeConnector
        nexus={nexus}
        registrationId="contract-lab-value-binding"
        label="Contract Lab standalone value binding"
        disclosure={disclosure}
        permissions={permissions}
      />
      <section
        aria-label="Standalone value binding"
        className="mx-5 mb-5 rounded-lg border border-(--picodash-color-border) bg-(--picodash-color-canvas) p-4 text-(--picodash-color-text) sm:p-6"
      >
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Binding theme">
          {themes.map((value) => (
            <Button
              key={value}
              size="sm"
              variant={theme === value ? 'primary' : 'outline'}
              aria-pressed={theme === value}
              onPress={() => setTheme(value)}
            >
              {value === 'ocean' ? 'Ocean' : value.charAt(0).toUpperCase() + value.slice(1)}
            </Button>
          ))}
        </div>
        <div className="my-4 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={disabled ? 'primary' : 'outline'}
            aria-pressed={disabled}
            onPress={() => setDisabled(!disabled)}
          >
            Disable controls
          </Button>
          <Button
            size="sm"
            onPress={() => {
              const result = nexus.setValues({ name: 'Evening', interval: 15, enabled: false })
              setWriteStatus(
                result.ok ? 'Applied Evening, 15 seconds, live updates off.' : 'Update rejected.',
              )
            }}
          >
            Apply example values
          </Button>
          <output aria-label="Programmatic update" className="text-sm" aria-live="polite">
            {writeStatus}
          </output>
        </div>
        <p role="status" aria-label="Save status">
          {saveMessage}
        </p>
        <p className="mb-5 text-sm text-(--picodash-color-text-muted)">
          Both Lists share three fields. Edit either List or apply the example values to see them
          stay in sync. Clearing a name or entering an interval outside 1–60 keeps the last valid
          value. Valid values survive refresh; invalid drafts do not. Collapse Workspace settings to
          focus on the readout, or use a row’s reorder handle to put frequently used controls first.
          Each List saves its own arrangement.
        </p>
        <div className="grid min-w-0 gap-6 xl:grid-cols-2">
          <DashList
            nexus={nexus}
            id="binding-ready-made"
            title="Ready-made Dashlets"
            headingLevel={2}
            reorderable
          >
            <DashGroup id="settings" label="Workspace settings" collapsible>
              <TextDashlet
                id="name"
                label="Workspace name"
                field={nexus.fields.name}
                disabled={disabled}
              />
              <NumberDashlet
                id="interval"
                label="Refresh interval"
                description="1–60 seconds"
                field={nexus.fields.interval}
                disabled={disabled}
              />
              <SwitchDashlet
                id="enabled"
                label="Live updates"
                field={nexus.fields.enabled}
                disabled={disabled}
              />
            </DashGroup>
            <DisplayDashlet
              id="readout"
              label="Current interval"
              field={nexus.fields.interval}
              formatValue={(value) => `${value} seconds`}
            />
            <Dashlet id="actions" label="List actions" pin="end">
              <ActionMenu label="List actions">
                <DashListResetValuesItem />
                <DashListResetListItem />
              </ActionMenu>
            </Dashlet>
          </DashList>
          <DashList
            nexus={nexus}
            id="binding-composed"
            title="Composed controls"
            headingLevel={2}
            reorderable
          >
            {renderComposedValueBindings({ nexus, disabled })}
            <Dashlet id="actions" label="List actions" pin="end">
              <ActionMenu label="List actions">
                <DashListResetValuesItem />
                <DashListResetListItem />
              </ActionMenu>
            </Dashlet>
          </DashList>
        </div>
        <ReorderLab nexus={nexus} />
      </section>
    </PicodashThemeProvider>
  )
}

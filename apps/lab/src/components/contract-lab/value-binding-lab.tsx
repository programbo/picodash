'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  DashList,
  DisplayDashlet,
  NumberDashlet,
  SwitchDashlet,
  TextDashlet,
} from '@picodash/dashlist'
import { Button, PicodashThemeProvider, type PicodashThemeOption } from '@picodash/ui'
import type {
  PicodashDevBridgeDisclosure,
  PicodashDevBridgePermissions,
} from '@picodash/dev-bridge'
import { ContractLabDevBridgeConnector } from './dev-bridge-connector'
import { renderComposedValueBindings } from './composed-value-bindings'
import { createValueBindingNexus, type ValueBindingNexus } from './value-binding-model'
import { useContractLabDiagnosticCount } from './nexus-diagnostics'

const disclosure: PicodashDevBridgeDisclosure = {
  valueFields: ['name', 'interval', 'enabled'],
  scopeIds: [],
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
  const [nexus, setNexus] = useState<ValueBindingNexus | null>(null)
  useEffect(() => {
    const root = createValueBindingNexus()
    setNexus(root)
    // Descendant List and binding leases release before the application-owned root.
    return () => queueMicrotask(() => root.destroy())
  }, [])

  return nexus ? <ValueBindingContent {...props} nexus={nexus} /> : null
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
        <p className="mb-5 text-sm text-(--picodash-color-text-muted)">
          Both Lists share three fields. Edit either List or apply the example values to see them
          stay in sync. Clearing a name or entering an interval outside 1–60 keeps the last valid
          value.
        </p>
        <div className="grid min-w-0 gap-6 xl:grid-cols-2">
          <DashList
            nexus={nexus}
            id="binding-ready-made"
            title="Ready-made Dashlets"
            headingLevel={2}
            reorderable={false}
          >
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
            <DisplayDashlet
              id="readout"
              label="Current interval"
              field={nexus.fields.interval}
              formatValue={(value) => `${value} seconds`}
            />
          </DashList>
          <DashList
            nexus={nexus}
            id="binding-composed"
            title="Composed controls"
            headingLevel={2}
            reorderable={false}
          >
            {renderComposedValueBindings({ nexus, disabled })}
          </DashList>
        </div>
      </section>
    </PicodashThemeProvider>
  )
}

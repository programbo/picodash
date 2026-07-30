import { useEffect, useRef } from 'react'
import { createPicodashStore } from '@picodash/store'
import { PicodashItem, PicodashPanel, PicodashProvider } from '@picodash/panel'
import * as Dashlet from '@picodash/panel/dashlet'
import { Button } from '@picodash/panel/ui'
import type { ContractLabPreset, ContractLabPresetId } from '@lab/lib/contract-lab'
import { useContractLabDiagnosticCount } from './store-diagnostics'

const consoleStore = createPicodashStore({
  fields: {},
  panelId: 'contract-lab-console',
})

export interface ContractLabConsoleProps {
  readonly activePreset: ContractLabPresetId
  readonly onDiagnosticCountChange: (count: number) => void
  readonly onLoadPreset: (preset: ContractLabPresetId) => void
  readonly onReset: () => void
  readonly onToggleSpecimen: () => void
  readonly presets: readonly ContractLabPreset[]
  readonly specimenAvailable: boolean
}

export function ContractLabConsole({
  activePreset,
  onDiagnosticCountChange,
  onLoadPreset,
  onReset,
  onToggleSpecimen,
  presets,
  specimenAvailable,
}: ContractLabConsoleProps) {
  const boundaryRef = useRef<HTMLDivElement>(null)
  const diagnosticCount = useContractLabDiagnosticCount([consoleStore])

  useEffect(() => {
    onDiagnosticCountChange(diagnosticCount)
  }, [diagnosticCount, onDiagnosticCountChange])

  return (
    <div
      ref={boundaryRef}
      className="border-border/70 bg-card/25 relative min-h-[46rem] overflow-hidden rounded-xl border border-dashed"
      data-contract-lab-console
    >
      <span className="text-muted-foreground absolute right-3 bottom-3 font-mono text-[0.625rem] uppercase">
        stable provider boundary
      </span>
      <PicodashProvider panelBoundary={boundaryRef} persistLayout={false} theme="dark">
        <PicodashPanel
          actionMenu={false}
          close={false}
          collapsible
          defaultPlacement={{
            disposition: { kind: 'docked', position: 'full-left' },
            mode: 'fixed',
          }}
          store={consoleStore}
          title="Lab Console"
          width="100%"
        >
          <PicodashItem id="contract-presets" label="Contract presets" contentLayout="full">
            <Dashlet.Frame>
              <Dashlet.Description>
                The Console has its own stable Provider and Store. Loading a specimen never remounts
                this Panel.
              </Dashlet.Description>
              <Dashlet.Body>
                <div
                  aria-label="Contract preset"
                  className="grid gap-(--picodash-space-1)"
                  role="group"
                >
                  {presets.map((preset, index) => {
                    const active = preset.id === activePreset
                    return (
                      <Button
                        key={preset.id}
                        aria-pressed={active}
                        aria-label={`${preset.label}: ${preset.description}`}
                        className="h-auto min-h-10 justify-start px-(--picodash-space-2) py-(--picodash-space-1-5) text-left"
                        data-active={active}
                        data-preset={preset.id}
                        size="sm"
                        variant={active ? 'secondary' : 'ghost'}
                        onPress={() => onLoadPreset(preset.id)}
                      >
                        <span className="text-picodash-muted font-mono text-(length:--picodash-font-size-sm)">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="font-(--picodash-font-medium)">{preset.label}</span>
                      </Button>
                    )
                  })}
                </div>
              </Dashlet.Body>
            </Dashlet.Frame>
          </PicodashItem>
          <PicodashItem id="lab-lifecycle" label="Lab lifecycle" contentLayout="full">
            <Dashlet.Toolbar aria-label="Contract Lab lifecycle">
              <Button size="sm" variant="outline" onPress={onReset}>
                Reset lab
              </Button>
              <Button size="sm" variant="outline" onPress={onToggleSpecimen}>
                {specimenAvailable ? 'Take offline' : 'Reopen specimen'}
              </Button>
            </Dashlet.Toolbar>
          </PicodashItem>
        </PicodashPanel>
      </PicodashProvider>
    </div>
  )
}

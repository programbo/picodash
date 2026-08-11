'use client'

import { useEffect, useRef } from 'react'
import { DashList, Dashlet } from '@picodash/dashlist'
import { DashPanel, DashPanelProvider } from '@picodash/dashpanel'
import { createPicodashNexus } from '@picodash/nexus'
import type { ContractLabPreset, ContractLabPresetId } from '@lab/lib/contract-lab'
import { useContractLabDiagnosticCount } from './nexus-diagnostics'

const consoleNexus = createPicodashNexus({ valueOwner: 'nexus', fields: {} })

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
  const diagnosticCount = useContractLabDiagnosticCount([consoleNexus])

  useEffect(() => {
    onDiagnosticCountChange(diagnosticCount)
  }, [diagnosticCount, onDiagnosticCountChange])

  return (
    <div
      ref={boundaryRef}
      className="border-border/70 bg-card/25 relative min-h-[32rem] overflow-hidden rounded-xl border border-dashed"
      data-contract-lab-console
    >
      <DashPanelProvider nexus={consoleNexus} boundary={boundaryRef} theme="dark">
        <DashPanel id="contract-lab-console-panel" title="Lab Console" collapsible={false}>
          <DashList aria-label="Contract Lab Console">
            <Dashlet id="contract-lab-controls" label="Contract Lab controls" layout="full">
              <div className="grid gap-4 p-4">
                <p className="text-muted-foreground text-sm leading-6">
                  The Console owns its Nexus and Provider. Preset changes replace only the specimen.
                </p>
                <div aria-label="Contract preset" className="grid gap-2" role="group">
                  {presets.map((preset, index) => {
                    const active = preset.id === activePreset
                    return (
                      <button
                        key={preset.id}
                        aria-label={`${preset.label}: ${preset.description}`}
                        aria-pressed={active}
                        className="border-border bg-background hover:bg-accent focus-visible:ring-ring flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-left text-sm outline-none focus-visible:ring-2"
                        data-active={active}
                        data-preset={preset.id}
                        type="button"
                        onClick={() => onLoadPreset(preset.id)}
                      >
                        <span className="text-muted-foreground font-mono text-xs">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="font-medium">{preset.label}</span>
                      </button>
                    )
                  })}
                </div>
                <div className="border-border/70 grid gap-2 border-t pt-4">
                  <button
                    className="border-border bg-background hover:bg-accent focus-visible:ring-ring min-h-10 rounded-md border px-3 text-left text-sm font-medium outline-none focus-visible:ring-2"
                    type="button"
                    onClick={onReset}
                  >
                    Reset lab
                  </button>
                  <button
                    className="border-border bg-background hover:bg-accent focus-visible:ring-ring min-h-10 rounded-md border px-3 text-left text-sm font-medium outline-none focus-visible:ring-2"
                    type="button"
                    onClick={onToggleSpecimen}
                  >
                    {specimenAvailable ? 'Take specimen offline' : 'Reopen primary specimen'}
                  </button>
                </div>
              </div>
            </Dashlet>
          </DashList>
        </DashPanel>
      </DashPanelProvider>
    </div>
  )
}

import type { ReactNode } from 'react'
import type { ContractLabPreset, ContractLabPresetId } from '@lab/lib/contract-lab'

export interface ContractLabConsoleProps {
  readonly activePreset: ContractLabPresetId
  readonly onLoadPreset: (preset: ContractLabPresetId) => void
  readonly onReset: () => void
  readonly onToggleSpecimen: () => void
  readonly presets: readonly ContractLabPreset[]
  readonly specimenAvailable: boolean
}

export function ContractLabConsole({
  activePreset,
  onLoadPreset,
  onReset,
  onToggleSpecimen,
  presets,
  specimenAvailable,
}: ContractLabConsoleProps) {
  return (
    <aside
      aria-labelledby="contract-lab-console-title"
      className="border-border/80 bg-card text-card-foreground relative z-20 grid min-h-0 overflow-hidden rounded-xl border shadow-2xl shadow-black/20"
      data-contract-lab-console
    >
      <header className="border-border/70 flex items-start justify-between gap-4 border-b px-4 py-3">
        <div>
          <p className="text-muted-foreground font-mono text-[0.625rem] tracking-[0.16em] uppercase">
            Stable host surface
          </p>
          <h2 id="contract-lab-console-title" className="mt-1 text-sm font-semibold">
            Lab Console
          </h2>
        </div>
        <span className="border-border text-muted-foreground rounded-full border px-2 py-1 font-mono text-[0.625rem] uppercase">
          v1
        </span>
      </header>

      <div className="scroll-fade min-h-0 overflow-y-auto p-3">
        <fieldset>
          <legend className="text-muted-foreground px-1 pb-2 font-mono text-[0.625rem] tracking-[0.14em] uppercase">
            Contract preset
          </legend>
          <div className="grid gap-1.5" role="radiogroup" aria-label="Contract preset">
            {presets.map((preset, index) => {
              const active = preset.id === activePreset

              return (
                <button
                  key={preset.id}
                  aria-checked={active}
                  className="border-border/70 hover:bg-accent focus-visible:ring-ring data-[active=true]:border-foreground/30 data-[active=true]:bg-accent grid min-h-11 grid-cols-[1.75rem_1fr] gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors outline-none focus-visible:ring-2 motion-reduce:transition-none"
                  data-active={active}
                  data-preset={preset.id}
                  role="radio"
                  type="button"
                  onClick={() => onLoadPreset(preset.id)}
                >
                  <span className="text-muted-foreground pt-0.5 font-mono text-[0.625rem]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold">{preset.label}</span>
                    <span className="text-muted-foreground mt-0.5 block text-[0.6875rem] leading-4">
                      {preset.description}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>
      </div>

      <footer className="border-border/70 grid grid-cols-2 gap-2 border-t p-3">
        <ConsoleButton onClick={onReset}>Reset lab</ConsoleButton>
        <ConsoleButton onClick={onToggleSpecimen}>
          {specimenAvailable ? 'Take offline' : 'Reopen specimen'}
        </ConsoleButton>
      </footer>
    </aside>
  )
}

function ConsoleButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      className="border-border bg-background hover:bg-accent focus-visible:ring-ring min-h-10 rounded-md border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-2 motion-reduce:transition-none"
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

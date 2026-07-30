import type { ContractLabOperation } from '@lab/lib/contract-lab'

export interface ContractLabStatusStripProps {
  readonly diagnosticCount: number
  readonly lastOperation: ContractLabOperation
  readonly presetLabel: string
  readonly primaryPanelVisible: boolean
  readonly ready: boolean
  readonly specimenAvailable: boolean
}

export function ContractLabStatusStrip({
  diagnosticCount,
  lastOperation,
  presetLabel,
  primaryPanelVisible,
  ready,
  specimenAvailable,
}: ContractLabStatusStripProps) {
  return (
    <section
      aria-label="Contract Lab status"
      className="border-border/80 bg-background/95 text-foreground sticky top-0 z-1000 border-b px-4 py-2 backdrop-blur sm:px-6"
      data-contract-lab-status
      data-ready={ready}
    >
      <dl className="mx-auto grid max-w-[110rem] grid-cols-2 gap-x-6 gap-y-2 font-mono text-[0.6875rem] tracking-[0.08em] uppercase sm:flex sm:items-center">
        <StatusDatum label="Preset" value={presetLabel} />
        <StatusDatum label="Readiness" value={ready ? 'ready' : 'loading'} state={ready} />
        <StatusDatum
          label="Specimen"
          value={specimenAvailable ? 'available' : 'offline'}
          state={specimenAvailable}
        />
        <StatusDatum
          label="Primary panel"
          value={primaryPanelVisible ? 'open' : 'hidden'}
          state={primaryPanelVisible}
        />
        <StatusDatum label="Last operation" value={lastOperation.replace('-', ' ')} />
        <StatusDatum
          label="Diagnostics"
          value={diagnosticCount === 0 ? 'clear' : String(diagnosticCount)}
          state={diagnosticCount === 0}
        />
      </dl>
    </section>
  )
}

function StatusDatum({ label, state, value }: { label: string; state?: boolean; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5 font-semibold">
        {state === undefined ? null : (
          <span
            aria-hidden="true"
            className={
              state ? 'size-1.5 rounded-full bg-emerald-400' : 'size-1.5 rounded-full bg-amber-400'
            }
          />
        )}
        <span className="truncate">{value}</span>
      </dd>
    </div>
  )
}

import type { ContractLabPreset } from '@lab/lib/contract-lab'
import { ContractLabSpecimen } from './specimens'

export interface ContractLabSpecimenHostProps {
  readonly preset: ContractLabPreset
  readonly revision: number
}

export function ContractLabSpecimenHost({ preset, revision }: ContractLabSpecimenHostProps) {
  return (
    <section
      aria-labelledby="contract-lab-specimen-title"
      className="border-border/80 bg-card/90 text-card-foreground relative min-h-[32rem] overflow-hidden rounded-xl border shadow-2xl shadow-black/20"
      data-contract-lab-specimen
      data-preset={preset.id}
      data-revision={revision}
    >
      <header className="border-border/70 flex items-start justify-between gap-4 border-b px-4 py-3">
        <div>
          <p className="text-muted-foreground font-mono text-[0.625rem] tracking-[0.16em] uppercase">
            Specimen provider
          </p>
          <h1 id="contract-lab-specimen-title" className="mt-1 text-sm font-semibold">
            Primary Specimen Panel
          </h1>
        </div>
        <span className="border-border text-muted-foreground rounded-full border px-2 py-1 font-mono text-[0.625rem] uppercase">
          ready
        </span>
      </header>
      <div className="p-5 sm:p-7">
        <ContractLabSpecimen key={`${preset.id}:${revision}`} preset={preset.id} />
      </div>
    </section>
  )
}

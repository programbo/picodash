import { usePicodashNexusSelector } from '@picodash/nexus/react'
import type { ValueBindingNexus } from './value-binding-model'

const records = {
  Builds: ['Build #184 passed', 'Build #183 passed', 'Build #182 failed'],
  Deployments: [
    'Preview deployment ready',
    'Staging deployment ready',
    'Production deployment approved',
  ],
  Checks: ['Type checks passed', 'Component tests passed', 'Browser checks passed'],
}

export function ActivityPreview({ nexus }: { readonly nexus: ValueBindingNexus }) {
  const source = usePicodashNexusSelector(nexus, (state) => state.values.activitySource)
  const detail = usePicodashNexusSelector(nexus, (state) => state.values.detail)
  const entries =
    source === 'Deployments'
      ? records.Deployments
      : source === 'Checks'
        ? records.Checks
        : records.Builds
  return (
    <section
      aria-label="Activity preview"
      className="mt-4 border border-(--picodash-color-border) bg-(--picodash-color-well) p-4"
    >
      <h3 className="font-semibold">
        {source} · {detail}
      </h3>
      <p className="mb-3 text-sm text-(--picodash-color-text-muted)">
        Sample records for comparing the controls.
      </p>
      <ul className="space-y-2 text-sm">
        {(detail === 'Details' ? entries : entries.slice(0, 1)).map((entry) => (
          <li key={entry}>{entry}</li>
        ))}
      </ul>
    </section>
  )
}

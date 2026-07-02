import { useMemo, useState } from 'react'
import { FeaturePanel, type FeaturePanelItem } from 'panel'

const releaseItems: FeaturePanelItem[] = [
  { label: 'Build health', value: 'Passing', status: 'success' },
  { label: 'Open risks', value: '2 watched', status: 'warning' },
  { label: 'Review queue', value: '5 changes', status: 'info' },
]

export function App() {
  const [compact, setCompact] = useState(false)
  const currentItems = useMemo(
    () =>
      compact
        ? releaseItems.slice(0, 2)
        : [
            ...releaseItems,
            { label: 'Launch window', value: 'Thu 14:00', status: 'neutral' as const },
          ],
    [compact],
  )

  return (
    <main className="min-h-svh bg-zinc-950 text-zinc-100">
      <div className="mx-auto grid min-h-svh max-w-6xl items-center gap-8 px-6 py-10 md:grid-cols-[0.9fr_1.1fr] md:px-10">
        <section className="space-y-6">
          <div className="inline-flex rounded-md border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-sm font-medium text-emerald-200">
            Vite+ React workspace
          </div>
          <div className="space-y-4">
            <h1 className="max-w-xl text-4xl leading-tight font-semibold tracking-normal text-white md:text-6xl">
              Demo app consuming the panel package
            </h1>
            <p className="max-w-lg text-base leading-7 text-zinc-300">
              The component on this page is imported from the local workspace package.
            </p>
          </div>
          <div className="inline-flex rounded-md border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              className="rounded px-3 py-2 text-sm font-medium text-zinc-300 transition hover:text-white data-[active=true]:bg-white data-[active=true]:text-zinc-950"
              data-active={!compact}
              aria-pressed={!compact}
              onClick={() => setCompact(false)}
            >
              Standard
            </button>
            <button
              type="button"
              className="rounded px-3 py-2 text-sm font-medium text-zinc-300 transition hover:text-white data-[active=true]:bg-white data-[active=true]:text-zinc-950"
              data-active={compact}
              aria-pressed={compact}
              onClick={() => setCompact(true)}
            >
              Compact
            </button>
          </div>
        </section>

        <FeaturePanel
          eyebrow="Workspace package"
          title="Release Panel"
          summary="Live status from a reusable React component library."
          metric={{ label: 'Readiness', value: compact ? '86%' : '92%', trend: '+6 this week' }}
          items={currentItems}
          footer={
            <span>
              Imported from{' '}
              <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-zinc-100">panel</code>
            </span>
          }
        />
      </div>
    </main>
  )
}

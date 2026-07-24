import { GuideSideNav } from '@/components/docs/guide-side-nav'

const exampleLinks = [
  { href: '#example-dependent-controls', label: 'Dependent controls' },
  { href: '#example-custom-editors', label: 'Custom editors' },
  { href: '#example-live-data', label: 'Live data displays' },
  { href: '#example-import-validation', label: 'Import and validation' },
] as const

const exampleSections = [
  {
    description:
      'Coordinate ranges, visibility, and disabled states across several fields without mirroring panel state in React.',
    id: 'example-dependent-controls',
    title: 'Dependent controls',
  },
  {
    description:
      'Compose an application-specific editor that keeps draft input separate from accepted store values.',
    id: 'example-custom-editors',
    title: 'Custom editors',
  },
  {
    description:
      'Pair stable panel settings with high-frequency charts and readouts that remain outside persisted state.',
    id: 'example-live-data',
    title: 'Live data displays',
  },
  {
    description:
      'Preview repairs, validate a complete batch, and commit imported settings as one atomic update.',
    id: 'example-import-validation',
    title: 'Import and validation',
  },
] as const

export function MoreExamples() {
  return (
    <div
      className="max-h-[calc(100svh-15rem)] min-w-0 overflow-y-auto overscroll-contain scroll-smooth motion-reduce:scroll-auto"
      data-more-examples
    >
      <div className="mx-auto grid max-w-5xl gap-8 p-4 sm:p-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10 lg:p-8">
        <GuideSideNav
          ariaLabel="More examples"
          description="Complex compositions will build on the same application-owned store model."
          links={exampleLinks}
          title="More examples"
        />

        <article className="min-w-0">
          <header className="border-b border-white/10 pb-8">
            <h1 className="text-2xl font-medium tracking-tight text-zinc-50 sm:text-3xl">
              More complex Picodash compositions
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              This section will collect complete examples that combine multiple items, application
              rules, and custom rendering into one working pattern.
            </p>
          </header>

          <div className="divide-y divide-white/10">
            {exampleSections.map((section, index) => (
              <section key={section.id} className="scroll-mt-6 py-9 first:pt-8" id={section.id}>
                <div className="grid items-baseline gap-4 sm:grid-cols-[2.5rem_minmax(0,1fr)]">
                  <span className="font-mono text-xs text-amber-200/70">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <h2 className="text-lg font-medium text-zinc-100">{section.title}</h2>
                      <span className="border border-amber-200/20 bg-amber-200/5 px-2 py-1 font-mono text-[10px] tracking-wider text-amber-200/70 uppercase">
                        Coming soon
                      </span>
                    </div>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                      {section.description}
                    </p>
                  </div>
                </div>
              </section>
            ))}
          </div>
        </article>
      </div>
    </div>
  )
}

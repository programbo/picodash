import Link from 'next/link'

import { picodashCatalog, type PicodashCatalogEntry } from '@picodash/picodash/catalog'

import {
  type CatalogReferencePageConfig,
  getCapabilityLabels,
  getCatalogReferencePages,
  toDelimitedList,
} from './catalog-reference-helpers'

export function CatalogReferencePage({
  config,
  entries,
}: {
  config: CatalogReferencePageConfig
  entries: readonly PicodashCatalogEntry[]
}) {
  const relatedPages = getCatalogReferencePages(config.key)
  const configuredEntryOrder = new Map(entries.map((entry, index) => [entry.id, index]))
  const referenceEntries = picodashCatalog
    .filter((entry) => entry.referenceAnchor.startsWith(`${config.href}#`))
    .toSorted((left, right) => {
      const leftIndex = configuredEntryOrder.get(left.id)
      const rightIndex = configuredEntryOrder.get(right.id)

      if (leftIndex !== undefined && rightIndex !== undefined) return leftIndex - rightIndex
      if (leftIndex !== undefined) return -1
      if (rightIndex !== undefined) return 1
      return left.exportName.localeCompare(right.exportName)
    })

  return (
    <main className="bg-picodash-canvas text-picodash-text min-h-screen" data-docs-reference>
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-5 py-10 sm:px-8 md:gap-7 md:px-10 md:py-14">
        <header className="grid gap-5">
          <p className="text-picodash-muted font-mono text-[11px] tracking-[0.28em] uppercase">
            Picodash · Documentation references
          </p>

          <h1 className="text-picodash-text text-2xl font-semibold tracking-tight sm:text-3xl">
            {config.title}
          </h1>

          <p className="text-picodash-muted max-w-2xl text-sm leading-6">{config.summary}</p>
          <p className="text-picodash-muted max-w-2xl text-sm leading-6">{config.note}</p>

          <nav aria-label="Reference pages" className="grid gap-3 text-sm leading-6 sm:grid-cols-3">
            {relatedPages.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                className="border-picodash-border rounded-picodash-control bg-picodash-surface text-picodash-text hover:bg-picodash-surface-muted focus-visible:ring-picodash-focus border px-4 py-3 outline-none focus-visible:ring-2"
              >
                <p className="text-picodash-muted text-[11px] uppercase">Reference</p>
                <p className="mt-1 font-medium">{page.title}</p>
                <p className="text-picodash-muted mt-1 text-[11px]">{page.summary}</p>
              </Link>
            ))}
          </nav>
        </header>

        <section
          aria-label="Component contract ledger"
          className="rounded-picodash-surface border-picodash-border bg-picodash-surface overflow-auto border"
        >
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">Machine-readable component contracts</caption>

            <thead>
              <tr className="bg-picodash-surface-muted/80 border-picodash-border text-picodash-muted border-b text-xs tracking-wide uppercase">
                <th scope="col" className="px-4 py-3 whitespace-nowrap">
                  Contract (export)
                </th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">
                  Category
                </th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">
                  Value kinds
                </th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">
                  Capabilities
                </th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">
                  A11y + nesting
                </th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">
                  Props
                </th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">
                  Variants + recipes
                </th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">
                  Theme contract
                </th>
              </tr>
            </thead>

            <tbody>
              {referenceEntries.map((entry) => {
                const capabilityLabels = getCapabilityLabels(entry.capabilities)
                const requiredThemes = toDelimitedList(entry.theme.requirements)
                const referenceId = entry.referenceAnchor.slice(
                  entry.referenceAnchor.indexOf('#') + 1,
                )

                return (
                  <tr
                    id={referenceId}
                    key={entry.id}
                    className="border-picodash-border scroll-mt-6 border-b border-dashed last:border-b-0"
                  >
                    <td className="min-w-[13rem] px-4 py-3 align-top">
                      <p className="text-picodash-strong font-medium">{entry.exportName}</p>
                      <code className="text-picodash-muted mt-1 block font-mono text-[11px]">
                        {entry.id}
                      </code>
                      <Link
                        href={entry.referenceAnchor}
                        className="text-picodash-muted hover:text-picodash-text focus-visible:ring-picodash-focus mt-1 block w-fit rounded-sm font-mono text-[11px] outline-none focus-visible:ring-2"
                      >
                        {entry.referenceAnchor}
                      </Link>
                    </td>
                    <td className="text-picodash-muted min-w-[8rem] px-4 py-3 align-top">
                      {entry.category}
                    </td>
                    <td className="min-w-[11rem] px-4 py-3 align-top">
                      <code className="break-anywhere text-picodash-muted font-mono text-[11px]">
                        {toDelimitedList(entry.compatibleValueKinds)}
                      </code>
                    </td>
                    <td className="text-picodash-muted min-w-[10rem] px-4 py-3 align-top">
                      {capabilityLabels.length ? capabilityLabels.join(', ') : 'none'}
                    </td>
                    <td className="max-w-xl px-4 py-3 align-top">
                      <p className="text-picodash-muted font-mono text-[11px]">
                        label: {entry.accessibility.labelProp ?? 'none'}
                      </p>
                      <p className="text-picodash-muted font-mono text-[11px]">
                        name req: {entry.accessibility.nameRequirement}
                      </p>
                      <p className="text-picodash-muted mt-1 font-mono text-[11px]">
                        allowed: {toDelimitedList(entry.nesting.allowedParents)}
                      </p>
                      <p className="text-picodash-muted font-mono text-[11px]">
                        preferred: {toDelimitedList(entry.nesting.recommendedParents)}
                      </p>
                    </td>
                    <td className="min-w-[12rem] px-4 py-3 align-top">
                      <code className="break-anywhere text-picodash-muted font-mono text-[11px]">
                        {toDelimitedList(entry.importantProps)}
                      </code>
                    </td>
                    <td className="min-w-[12rem] px-4 py-3 align-top">
                      <p className="text-picodash-muted font-mono text-[11px]">
                        variants: {toDelimitedList(entry.variants)}
                      </p>
                      <p className="text-picodash-muted mt-1 font-mono text-[11px]">
                        recipes: {toDelimitedList(entry.recipeIds)}
                      </p>
                    </td>
                    <td className="min-w-[14rem] px-4 py-3 align-top">
                      <p className="text-picodash-muted font-mono text-[11px]">{requiredThemes}</p>
                      <p className="text-picodash-muted mt-1 font-mono text-[11px]">
                        tokens: {toDelimitedList(entry.theme.semanticTokens)}
                      </p>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  )
}

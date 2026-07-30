import { filterPicodashCatalog, type PicodashCatalogEntry } from '@picodash/panel/catalog'

export type CatalogReferencePageKey = 'dashlets' | 'dashlet-components' | 'ui'

export type CatalogReferencePageConfig = {
  key: CatalogReferencePageKey
  href: string
  title: string
  summary: string
  note: string
}

const entryKindPriority: Record<CatalogReferencePageKey, CatalogReferencePageConfig> = {
  dashlets: {
    key: 'dashlets',
    href: '/docs/reference/dashlets',
    title: 'Built-in Panel controls',
    summary: 'Application-facing dashlet entries and core controls at @picodash/panel',
    note: 'Use for direct panel composition and app-level composition APIs.',
  },
  'dashlet-components': {
    key: 'dashlet-components',
    href: '/docs/reference/dashlet-components',
    title: 'Dashlet anatomy components',
    summary: 'Semantic dashlet elements and structural primitives at @picodash/panel/dashlet',
    note: 'Use for compound Dashlets and compound value surfaces.',
  },
  ui: {
    key: 'ui',
    href: '/docs/reference/ui',
    title: 'UI foundations',
    summary: 'Theme-aware foundation controls from @picodash/panel/ui',
    note: 'Use for custom Dashlets and third-party extensions.',
  },
}

export const catalogReferencePages = Object.freeze([
  entryKindPriority.dashlets,
  entryKindPriority['dashlet-components'],
  entryKindPriority.ui,
])

export function getCatalogReferencePages(current?: CatalogReferencePageKey) {
  return catalogReferencePages.filter((page) => page.key !== current)
}

export function getCatalogReferenceConfig(
  key: CatalogReferencePageKey,
): CatalogReferencePageConfig {
  return entryKindPriority[key]
}

function normalize<T>(items: readonly T[]) {
  return Object.freeze([...items])
}

function sortByExportName(
  left: Readonly<PicodashCatalogEntry>,
  right: Readonly<PicodashCatalogEntry>,
) {
  return left.exportName.localeCompare(right.exportName)
}

export function getCatalogReferenceEntries(
  key: CatalogReferencePageKey,
): readonly PicodashCatalogEntry[] {
  if (key === 'dashlets') {
    return normalize(
      [...filterPicodashCatalog({ entrypoint: '@picodash/panel' })].sort(sortByExportName),
    )
  }

  if (key === 'dashlet-components') {
    return normalize(
      [...filterPicodashCatalog({ entrypoint: '@picodash/panel/dashlet' })].sort(sortByExportName),
    )
  }

  return normalize(
    [
      ...filterPicodashCatalog({
        entrypoint: '@picodash/panel/ui',
        category: 'foundation',
      }),
    ].sort(sortByExportName),
  )
}

export function toDelimitedList(values: readonly string[]) {
  return values.length === 0 ? 'none' : values.join(', ')
}

export function getCapabilityLabels(capabilities: {
  readonly input: boolean
  readonly display: boolean
  readonly streaming: boolean
  readonly action: boolean
}) {
  return Object.entries(capabilities)
    .filter(([, value]) => value)
    .map(([name]) => name)
}

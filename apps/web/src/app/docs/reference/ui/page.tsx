import type { Metadata } from 'next'

import { CatalogReferencePage } from '@/components/docs/catalog-reference'
import {
  getCatalogReferenceConfig,
  getCatalogReferenceEntries,
} from '@/components/docs/catalog-reference-helpers'

const page = getCatalogReferenceConfig('ui')
const entries = getCatalogReferenceEntries('ui')

export const metadata: Metadata = {
  title: 'UI foundations reference',
  description:
    'Machine-readable contracts for @picodash/panel/ui foundation components and their required interface affordances.',
  alternates: {
    canonical: '/docs/reference/ui',
  },
}

export default function UiReferencePage() {
  return <CatalogReferencePage config={page} entries={entries} />
}

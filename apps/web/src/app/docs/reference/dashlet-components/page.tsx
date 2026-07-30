import type { Metadata } from 'next'

import { CatalogReferencePage } from '@/components/docs/catalog-reference'
import {
  getCatalogReferenceConfig,
  getCatalogReferenceEntries,
} from '@/components/docs/catalog-reference-helpers'

const page = getCatalogReferenceConfig('dashlet-components')
const entries = getCatalogReferenceEntries('dashlet-components')

export const metadata: Metadata = {
  title: 'Dashlet component reference',
  description:
    'Machine-readable contracts for semantic Dashlet elements in @picodash/panel/dashlet to compose compound Dashlets.',
  alternates: {
    canonical: '/docs/reference/dashlet-components',
  },
}

export default function DashletComponentsReferencePage() {
  return <CatalogReferencePage config={page} entries={entries} />
}

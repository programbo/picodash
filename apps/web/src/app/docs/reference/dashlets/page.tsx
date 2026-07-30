import type { Metadata } from 'next'

import { CatalogReferencePage } from '@/components/docs/catalog-reference'
import {
  getCatalogReferenceConfig,
  getCatalogReferenceEntries,
} from '@/components/docs/catalog-reference-helpers'

const page = getCatalogReferenceConfig('dashlets')
const entries = getCatalogReferenceEntries('dashlets')

export const metadata: Metadata = {
  title: 'Dashlet controls reference',
  description:
    'Machine-readable component contracts for @picodash/panel built-ins and their accessibility, value, and nesting requirements.',
  alternates: {
    canonical: '/docs/reference/dashlets',
  },
}

export default function DashletsReferencePage() {
  return <CatalogReferencePage config={page} entries={entries} />
}

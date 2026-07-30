import type { Metadata } from 'next'
import Link from 'next/link'

import { DocsCodeBlock, DocsShell } from '@/components/docs/docs-shell'
import { PICODASH_ERROR_CODES } from '@picodash/store'

export const metadata: Metadata = {
  title: 'Store reference',
  description:
    'Reference for store creation, writes, validation, and repair contracts in Picodash.',
  alternates: {
    canonical: '/docs/reference/store',
  },
}

const errorCodeList = Object.values(PICODASH_ERROR_CODES)
  .map((code) => String(code))
  .filter(Boolean)

export default function StoreReferencePage() {
  return (
    <DocsShell title="Store reference" withProductRoute={false}>
      <p>
        The store layer is exported from <code>@picodash/store</code> and is the underlying state
        primitive used by Picodash panel stores.
      </p>

      <h2>Core factory</h2>
      <code className="mt-2 block">
        createPicodashStore({'{'} ... {'}'})
      </code>
      <p>
        Use a typed field map and default values. Initial values are normalized and constrained
        through field validators and parsers before the initial state is committed.
      </p>

      <h2>Write APIs</h2>
      <ul>
        <li>
          <code>setFieldValue(field, value)</code>: single field update.
        </li>
        <li>
          <code>setFieldValues(values)</code>: batched programmatic update with shared validation.
        </li>
        <li>
          <code>registerItem / unregisterItem</code>: runtime item metadata and id maps.
        </li>
        <li>
          <code>resetFieldValue / resetFields / resetRegisteredFields</code>: reset semantics.
        </li>
      </ul>

      <h2>Diagnostics contract</h2>
      <p>
        All diagnostics share schema version <code>v1</code> and are emitted via diagnostic channels
        when validation fails or repair is needed.
      </p>
      <DocsCodeBlock
        label="Create store"
        source={`import { createPicodashStore } from '@picodash/store'\n\nconst store = createPicodashStore({\n  fields: {\n    quality: { defaultValue: 'balanced' },\n    showGrid: { defaultValue: true },\n  },\n  panelId: 'scene-controls',\n})`}
      />

      <h2>Documented error families</h2>
      <ul>
        {errorCodeList.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>

      <h2>Related</h2>
      <ul>
        <li>
          <Link href="/docs/reference/panel">Panel reference</Link>
        </li>
        <li>
          <Link href="/docs/reference/diagnostics">Diagnostics reference</Link>
        </li>
      </ul>
    </DocsShell>
  )
}

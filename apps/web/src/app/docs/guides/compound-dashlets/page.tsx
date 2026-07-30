import type { Metadata } from 'next'
import Link from 'next/link'

import { DocsCodeBlock, DocsShell } from '@/components/docs/docs-shell'
import { docsSnippets } from '@/components/docs/docs-content'

export const metadata: Metadata = {
  title: 'Compound dashlets',
  description: 'Compose multiple fields into one reusable, observable dashlet component.',
  alternates: {
    canonical: '/docs/guides/compound-dashlets',
  },
}

export default function CompoundDashletsPage() {
  return (
    <DocsShell title="Guide: compound dashlets" withProductRoute={false}>
      <h2>Goal</h2>
      <p>Combine several related fields into one semantic surface and keep selectors local.</p>

      <DocsCodeBlock label="Compound dashlet" source={docsSnippets.compoundDashlet} />

      <h2>Patterns</h2>
      <ul>
        <li>
          Bind each field under a stable alias in <code>fields</code>; the compound item registers
          once and exposes typed contexts to its render function.
        </li>
        <li>
          Mark read-only bindings with <code>mode: &apos;display&apos;</code> so their contexts do
          not expose setters.
        </li>
        <li>
          Prefer one parent item wrapper with a single <code>contentLayout</code> to avoid split
          semantics.
        </li>
      </ul>

      <h2>Related</h2>
      <ul>
        <li>
          <Link href="/docs/reference/panel">Panel reference</Link>
        </li>
        <li>
          <Link href="/docs/reference/dashlet-components">Dashlet components</Link>
        </li>
      </ul>
    </DocsShell>
  )
}

import type { Metadata } from 'next'
import { DocsCodeBlock, DocsShell } from '@/components/docs/docs-shell'
import { docsSnippets } from '@/components/docs/docs-content'

export const metadata: Metadata = {
  title: 'Dashlet accessibility',
  description: 'Accessibility and contrast guidance for Picodash panels and dashlets.',
  alternates: {
    canonical: '/docs/guides/dashlet-accessibility',
  },
}

export default function DashletAccessibilityPage() {
  return (
    <DocsShell title="Guide: dashlet accessibility" withProductRoute={false}>
      <h2>Minimum requirements</h2>
      <ul>
        <li>
          Give interactive items labels via <code>label</code> or readable fallback text.
        </li>
        <li>Use semantic descriptions instead of placeholder-only context.</li>
        <li>Respect keyboard reorder and focus behavior by keeping stable ids.</li>
      </ul>

      <DocsCodeBlock label="Labeled dashlet item" source={docsSnippets.accessibility} />

      <p>
        Panels can emit diagnostics for accessibility guidance including
        <code> PICODASH_MISSING_ACCESSIBLE_LABEL</code> and can be inspected via diagnostic docs.
      </p>
    </DocsShell>
  )
}

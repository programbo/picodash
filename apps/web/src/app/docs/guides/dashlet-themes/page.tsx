import type { Metadata } from 'next'
import { DocsCodeBlock, DocsShell } from '@/components/docs/docs-shell'
import { docsSnippets } from '@/components/docs/docs-content'

export const metadata: Metadata = {
  title: 'Dashlet themes',
  description: 'Theme propagation for panel themes and semantic token overrides.',
  alternates: {
    canonical: '/docs/guides/dashlet-themes',
  },
}

export default function DashletThemesPage() {
  return (
    <DocsShell title="Guide: dashlet themes" withProductRoute={false}>
      <h2>Theme strategy</h2>
      <p>
        Set themes at provider or panel level and keep panel-contained overrides in the nearest
        themed subtree.
      </p>

      <DocsCodeBlock label="Theme snippet" source={docsSnippets.themes} />

      <p>
        The shared stylesheet exposes semantic tokens. Override via <code>--picodash-*</code> keys
        inside a scoped <code>data-picodash-theme</code> subtree.
      </p>
    </DocsShell>
  )
}

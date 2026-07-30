import type { Metadata } from 'next'
import Link from 'next/link'

import { DocsShell } from '@/components/docs/docs-shell'
import { docsConcepts } from '@/components/docs/docs-content'

export const metadata: Metadata = {
  title: 'Panel placement',
  description: 'Reference placement modes, boundaries, and placement persistence.',
  alternates: {
    canonical: '/docs/concepts/panel-placement',
  },
}

const concept = docsConcepts['panel-placement']

export default function PanelPlacementPage() {
  return (
    <DocsShell title="Concept: panel placement" withProductRoute={false}>
      <p>{concept.summary}</p>

      <h2>Modes at a glance</h2>
      <ul>
        <li>floating: free or snapped to viewport edges.</li>
        <li>fixed: snapped docked positions relative to the boundary.</li>
        <li>hybrid: combines free, snapped, and docked with detach behavior during drag.</li>
      </ul>

      <h2>Reference notes</h2>
      <ul>
        {concept.sections.map((section) => (
          <li key={section}>{section}</li>
        ))}
      </ul>

      <h2>Related</h2>
      <ul>
        {concept.related.map((href) => (
          <li key={href}>
            <Link href={href}>{href}</Link>
          </li>
        ))}
      </ul>
    </DocsShell>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'

import { DocsShell } from '@/components/docs/docs-shell'
import { docsConcepts } from '@/components/docs/docs-content'

export const metadata: Metadata = {
  title: 'Dashlet anatomy',
  description: 'Composition hierarchy for groups, items, and dashlet structures.',
  alternates: {
    canonical: '/docs/concepts/dashlet-anatomy',
  },
}

const concept = docsConcepts['dashlet-anatomy']

export default function DashletAnatomyPage() {
  return (
    <DocsShell title="Concept: dashlet anatomy" withProductRoute={false}>
      <p>{concept.summary}</p>

      <h2>Composition pattern</h2>
      <ul>
        <li>Panels contain ordered groups.</li>
        <li>Groups own item registrations and can be pinned.</li>
        <li>Dashlet components shape compound readouts and nested visuals.</li>
      </ul>

      <h2>Implementation notes</h2>
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

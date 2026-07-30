import type { Metadata } from 'next'
import Link from 'next/link'

import { DocsShell } from '@/components/docs/docs-shell'
import { docsConcepts } from '@/components/docs/docs-content'

export const metadata: Metadata = {
  title: 'State ownership',
  description: 'How value state and panel state are separated in Picodash.',
  alternates: {
    canonical: '/docs/concepts/state-ownership',
  },
}

const concept = docsConcepts['state-ownership']

export default function StateOwnershipPage() {
  return (
    <DocsShell title="Concept: state ownership" withProductRoute={false}>
      <p>{concept.summary}</p>

      <h2>Rules</h2>
      <ul>
        {concept.sections.map((section) => (
          <li key={section}>{section}</li>
        ))}
      </ul>

      <h2>References</h2>
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

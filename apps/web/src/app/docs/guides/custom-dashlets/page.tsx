import type { Metadata } from 'next'
import Link from 'next/link'

import { DocsCodeBlock, DocsShell } from '@/components/docs/docs-shell'
import { docsSnippets } from '@/components/docs/docs-content'

export const metadata: Metadata = {
  title: 'Custom dashlets',
  description: 'Create custom dashlets with semantic wrappers and accessible labels.',
  alternates: {
    canonical: '/docs/guides/custom-dashlets',
  },
}

export default function CustomDashletsPage() {
  return (
    <DocsShell title="Guide: custom dashlets" withProductRoute={false}>
      <p>
        Custom dashlets render through the shared dashlet namespace and should remain semantic,
        token-aware, and value-driven.
      </p>

      <h2>Basic custom dashlet</h2>
      <DocsCodeBlock label="dashlet.tsx" source={docsSnippets.dashlet} />

      <p>
        Use <code>PicodashItem</code> for label, description, and nested dashlet structure. Keep one
        stable <code>id</code> and stable group ordering for persistable behavior.
      </p>

      <h2>Next</h2>
      <ul>
        <li>
          <Link href="/docs/guides/compound-dashlets">Build compound dashlets</Link>
        </li>
        <li>
          <Link href="/docs/reference/dashlet-components">Review dashlet component contracts</Link>
        </li>
      </ul>
    </DocsShell>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'

import { DocsCodeBlock, DocsShell } from '@/components/docs/docs-shell'
import { docsSnippets } from '@/components/docs/docs-content'

export const metadata: Metadata = {
  title: 'Manual setup',
  description: 'Manual integration flow for adding Picodash in applications.',
  alternates: {
    canonical: '/docs/get-started/manual',
  },
}

const setupLinks = [
  { href: '/docs/concepts/state-ownership', label: 'State ownership' },
  { href: '/docs/concepts/panel-placement', label: 'Panel placement' },
  { href: '/docs/reference/panel', label: 'Panel API' },
] as const

export default function ManualSetupPage() {
  return (
    <DocsShell title="Manual setup" withProductRoute={false}>
      <h2>Install and style</h2>
      <DocsCodeBlock label="Install" source={docsSnippets.install} />
      <DocsCodeBlock label="Import stylesheet" source={docsSnippets.stylesheet} />

      <p>
        Import <code>@picodash/panel/style.css</code> once, near your root. It includes both light
        and dark theme tokens.
      </p>

      <h2>Create values and a panel store</h2>
      <DocsCodeBlock label="Create store" source={docsSnippets.createStore} />
      <p>
        Picodash stores are explicitly owned. Create one at module scope with a stable{' '}
        <code>panelId</code> and field definitions that own parsing, validation, and reset defaults.
      </p>

      <h2>Build a provider + panel boundary</h2>
      <DocsCodeBlock label="Provider + panel" source={docsSnippets.fullPanel} />
      <p>
        Keep one provider per app subtree where panel overlays are needed. The provider owns
        visibility and placement state while the store owns field values.
      </p>

      <h2>Panel visibility and close behavior</h2>
      <DocsCodeBlock label="Visibility toggle" source={docsSnippets.panelVisibility} />
      <p>
        Use <code>usePicodashPanel(panelId)</code> to open, close, or activate without duplicating
        UI state in your app.
      </p>

      <h2>Next steps</h2>
      <ul>
        {setupLinks.map((item) => (
          <li key={item.href}>
            <Link href={item.href}>{item.label}</Link>
          </li>
        ))}
      </ul>
    </DocsShell>
  )
}

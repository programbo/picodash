import type { Metadata } from 'next'

import { DocsCodeBlock, DocsShell } from '@/components/docs/docs-shell'
import { docsSnippets } from '@/components/docs/docs-content'

export const metadata: Metadata = {
  title: 'Agent playbook',
  description: 'Deterministic checklist for agent-ready Picodash integrations.',
  alternates: {
    canonical: '/docs/get-started/agent',
  },
}

const required = [
  {
    description: 'Read dependencies and package entrypoints before wiring code.',
    item: 'Dependency and entrypoint check',
  },
  {
    description: 'Create one store per panel and avoid changing store instances at runtime.',
    item: 'Stable panel store ownership',
  },
  {
    description:
      'Choose one provider per routed app region and prefer persisted layout only when desired.',
    item: 'Provider and layout strategy',
  },
  {
    description:
      'Verify close behavior, default placement, and action-menu behavior with one smoke test.',
    item: 'Panel lifecycle smoke test',
  },
] as const

const smokeCommands = ['bun add @picodash/panel @picodash/store', 'bun run build', 'bun run test']

export default function AgentPlaybookPage() {
  return (
    <DocsShell title="Agent playbook" withProductRoute={false}>
      <h2>Pre-flight checklist</h2>
      <ol className="list-decimal">
        {required.map((check) => (
          <li key={check.item}>
            <strong>{check.item}</strong> — {check.description}
          </li>
        ))}
      </ol>

      <h2>Minimal deterministic flow</h2>
      <DocsCodeBlock label="Pre-flight commands" source={docsSnippets.agentChecklist} />
      <p>
        Keep a copy of the generated panel pattern in a dedicated integration file and avoid
        branching on runtime shape changes.
      </p>

      <h2>Smoke commands</h2>
      <ul>
        {smokeCommands.map((command) => (
          <li key={command}>
            <code>{command}</code>
          </li>
        ))}
      </ul>

      <h2>Code anchors to verify</h2>
      <ul>
        <li>
          <a href="/docs/reference/store">Store API</a>
        </li>
        <li>
          <a href="/docs/reference/panel">Panel API</a>
        </li>
        <li>
          <a href="/docs/reference/diagnostics">Diagnostics reference</a>
        </li>
      </ul>
    </DocsShell>
  )
}

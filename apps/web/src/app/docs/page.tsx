import type { Metadata } from 'next'

import { DocsShell } from '@/components/docs/docs-shell'

export const metadata: Metadata = {
  title: 'Documentation',
  description: 'Documentation for building control panels with Picodash.',
}

const quickWins = [
  {
    description: 'Build a complete panel with provider + store + actions.',
    href: '/docs/get-started/manual',
    title: 'Manual setup',
  },
  {
    description: 'Checklist for deterministic integrations and CI-safe steps.',
    href: '/docs/get-started/agent',
    title: 'Agent playbook',
  },
  {
    description: 'State, boundaries, and placement fundamentals for panel architecture.',
    href: '/docs/concepts/state-ownership',
    title: 'Core concepts',
  },
  {
    description: 'Build reusable custom and compound dashlets with semantic structure.',
    href: '/docs/guides/custom-dashlets',
    title: 'Dashlet guides',
  },
  {
    description: 'Copy-paste API surfaces for store, panel, and diagnostics.',
    href: '/docs/reference/store',
    title: 'Reference',
  },
] as const

export default function DocsLandingPage() {
  return (
    <DocsShell
      description="This documentation is organized as a practical onboarding path: setup, architecture,
      reusable guides, and API references for stable integration."
      title="Introduction"
      withProductRoute
    >
      <p>
        Picodash is a React package for building application-owned control panels with composable
        Dashlets and a provider-managed layout surface.
      </p>

      <p>
        Start with installation, then choose a concept and a guide that matches your workflow, then
        verify against the API references.
      </p>

      <section className="grid gap-4 sm:grid-cols-2">
        {quickWins.map((entry) => (
          <a
            href={entry.href}
            key={entry.title}
            className="border border-zinc-800 bg-zinc-950 p-4 text-sm leading-6 transition hover:border-zinc-600 hover:bg-zinc-900"
          >
            <p className="font-medium text-zinc-100">{entry.title}</p>
            <p className="mt-1 text-zinc-400">{entry.description}</p>
          </a>
        ))}
      </section>

      <p>
        For quick validation, run your integration through{' '}
        <a href="/docs/reference/diagnostics">diagnostic checks</a> and{' '}
        <a href="/docs/reference/panel">panel reference</a> after initial wiring.
      </p>
    </DocsShell>
  )
}

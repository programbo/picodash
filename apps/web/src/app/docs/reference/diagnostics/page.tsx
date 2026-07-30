import type { Metadata } from 'next'

import { DocsCodeBlock, DocsShell } from '@/components/docs/docs-shell'
import { getDiagnosticCodeUrl, docsSnippets } from '@/components/docs/docs-content'
import {
  PICODASH_DIAGNOSTICS_VERSION,
  PICODASH_ERROR_CODES,
  createPicodashDiagnostic,
  type PicodashDiagnostic,
} from '@picodash/store'

export const metadata: Metadata = {
  title: 'Diagnostics reference',
  description:
    'Diagnostic contracts, severity, and helper functions for Picodash warnings and errors.',
  alternates: {
    canonical: '/docs/reference/diagnostics',
  },
}

const entries = Object.entries(PICODASH_ERROR_CODES).map(([name, code]) => ({
  name,
  code,
  documentationUrl: getDiagnosticCodeUrl(code),
}))

const diagnostic: PicodashDiagnostic = createPicodashDiagnostic({
  code: PICODASH_ERROR_CODES.MISSING_ACCESSIBLE_LABEL,
  correction: 'Add a label or label-like helper prop to the item.',
  expectedContract: 'Every interactive item should expose an accessible label.',
  identity: { itemId: 'scene-quality' },
  summary: 'Missing accessible label.',
})

export default function DiagnosticsReferencePage() {
  return (
    <DocsShell title="Diagnostics reference" withProductRoute={false}>
      <p>
        Diagnostics are protocol objects with version <code>{PICODASH_DIAGNOSTICS_VERSION}</code>{' '}
        and severity <code>error</code> or <code>warning</code>.
      </p>

      <h2>Public helper surface</h2>
      <ul>
        <li>
          <code>createPicodashDiagnostic(input)</code>
        </li>
        <li>
          <code>getPicodashDocumentationUrl(code)</code>
        </li>
        <li>
          <code>isPicodashDiagnostic(value)</code>
        </li>
        <li>
          <code>normalizePicodashDiagnostic(value)</code>
        </li>
      </ul>

      <DocsCodeBlock label="Sample diagnostic" source={docsSnippets.diagnosticsExample} />

      <h2>Defined codes</h2>
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th className="pb-2">Name</th>
            <th className="pb-2">Code</th>
            <th className="pb-2">Documentation</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.code}>
              <td className="border-t border-zinc-800 py-2 pr-3 text-zinc-300">{entry.name}</td>
              <td className="border-t border-zinc-800 py-2 pr-3 text-zinc-500">{entry.code}</td>
              <td className="border-t border-zinc-800 py-2 text-zinc-500">
                <a
                  href={entry.documentationUrl}
                  className="text-zinc-300 underline underline-offset-4"
                >
                  docs
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Example outcome</h2>
      <pre className="overflow-x-auto border border-zinc-800 bg-black/40 p-3 text-xs">
        <code>{diagnostic.message}</code>
      </pre>
    </DocsShell>
  )
}

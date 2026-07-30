import type { Metadata } from 'next'
import Link from 'next/link'

import { DocsCodeBlock, DocsShell } from '@/components/docs/docs-shell'

export const metadata: Metadata = {
  title: 'Panel reference',
  description: 'Reference for Picodash panel composition, lifecycle, and provider-level APIs.',
  alternates: {
    canonical: '/docs/reference/panel',
  },
}

const panelApis = [
  'PicodashProvider',
  'PicodashPanel',
  'PicodashGroup',
  'PicodashItem',
  'usePicodashPanel',
] as const

const advancedApis = [
  'createPicodashProviderStore',
  'usePicodashProviderSelector',
  'usePicodashProviderStoreApi',
  'useRegisterPicodashPanel',
] as const

export default function PanelReferencePage() {
  return (
    <DocsShell title="Panel reference" withProductRoute={false}>
      <p>
        The public panel API is exported from <code>@picodash/panel</code>. The provider keeps
        placement, visibility, and layout persistence while stores keep values.
      </p>

      <h2>Core exports</h2>
      <ul>
        {panelApis.map((api) => (
          <li key={api}>
            <code>{api}</code>
          </li>
        ))}
      </ul>

      <h2>Advanced exports</h2>
      <p>
        Advanced hooks and stores are available under <code>@picodash/panel/advanced</code>.
      </p>
      <ul>
        {advancedApis.map((api) => (
          <li key={api}>
            <code>{api}</code>
          </li>
        ))}
      </ul>

      <h2>Behavioral details</h2>
      <ul>
        <li>
          <strong>close behavior</strong>: <code>false</code> hides the panel and keeps
          registration, while <code>{'{ behavior: "deregister" }'}</code> removes registration and
          unmounts the portal entry.
        </li>
        <li>
          <strong>default placement</strong>: uses <code>floating / snapped</code> defaults and
          accepts custom <code>defaultPlacement</code>.
        </li>
        <li>
          <strong>persistence</strong>: provider defaults persist <code>panelLayouts</code> in
          localStorage when <code>persistLayout</code> is enabled.
        </li>
      </ul>

      <DocsCodeBlock
        label="Panel close behavior"
        source={`import { usePicodashPanel } from '@picodash/panel'\n\nfunction ScenePanelClose() {\n  const panel = usePicodashPanel('scene-controls')\n\n  return <button onClick={() => panel?.toggle()}>Toggle</button>\n}`}
      />

      <h2>References</h2>
      <ul>
        <li>
          <Link href="/docs/reference/dashlets">Dashlet controls</Link>
        </li>
        <li>
          <Link href="/docs/reference/dashlet-components">Dashlet components</Link>
        </li>
      </ul>
    </DocsShell>
  )
}

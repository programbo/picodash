import type { Metadata } from 'next'

import { DocsCodeBlock, DocsShell } from '@/components/docs/docs-shell'

export const metadata: Metadata = {
  title: 'Dashlet themes',
  description: 'Theme propagation for panel themes and semantic token overrides.',
  alternates: {
    canonical: '/docs/guides/dashlet-themes',
  },
}

const providerSnippet = `import { useRef } from 'react'
import { PicodashGroup, PicodashPanel, PicodashProvider, PicodashSwitch } from '@picodash/panel'
import { createPicodashStore } from '@picodash/store'
import '@picodash/panel/style.css'

const themeStore = createPicodashStore({
  panelId: 'theme-demo',
  fields: {
    value: { defaultValue: true },
  },
})

export function ThemeSurface() {
  const boundaryRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  return (
    <div>
      <PicodashProvider
        panelBoundary={boundaryRef}
        portalContainer={overlayRef.current}
        persistLayout
        theme="system"
      >
        <main ref={boundaryRef}>
          <div data-grid="true">Host application content</div>
        </main>
        <div ref={overlayRef} />

        <PicodashPanel store={themeStore} title="Theme panel">
          <PicodashGroup id="theme-controls" label="Theme controls">
            <PicodashSwitch field={themeStore.fields.value} label="Value enabled" />
          </PicodashGroup>
        </PicodashPanel>
      </PicodashProvider>
    </div>
  )
}`

const tokenSnippet = `<div data-picodash-theme="contrast">
  <PicodashPanel store={themeStore} title="Panel with local override">
    <div>...</div>
  </PicodashPanel>
</div>

:root {
  [data-picodash-theme='brand'] {
    --picodash-surface: oklch(22% 0.03 252);
    --picodash-color-data-1: #ffd166;
  }
}`

const verificationSource = `import { usePicodashPanel } from '@picodash/panel'

function PortalFocusCheck() {
  const panel = usePicodashPanel('theme-demo')

  panel?.activate()
  // assert focus stays inside dashlet after open
  // assert token class on overlay container
  // assert close returns focus to trigger path
}`

export default function DashletThemesPage() {
  return (
    <DocsShell title="Guide: dashlet themes" withProductRoute={false}>
      <p>
        Themes are token-driven and scoped through provider/panel boundaries, not host-only utility
        classes. Use <code>--picodash-*</code> variables and avoid importing global tailwind design
        tokens.
      </p>

      <h2>Theme precedence</h2>
      <ul>
        <li>
          Import <code>@picodash/panel/style.css</code> once near app root.
        </li>
        <li>
          Configure <code>PicodashProvider theme</code> for global policy and <code>system</code> to
          react to OS color changes.
        </li>
        <li>
          Optionally override with typed named themes on provider or panel when that surface should
          diverge.
        </li>
        <li>
          For semantic palettes and accessibility-safe overrides, wrap with{' '}
          <code>data-picodash-theme</code> and override only semantic tokens.
        </li>
      </ul>

      <h2>Portal and detached overlays</h2>
      <p>
        Overlay components should render through the provider portal container so inherited theme
        context is preserved. Detached siblings outside panel roots should define their own scoped
        theme subtree.
      </p>
      <DocsCodeBlock label="Provider + portal + panel" source={providerSnippet} />

      <h2>Token recipes</h2>
      <DocsCodeBlock label="Theme override contract" source={tokenSnippet} />

      <h2>Verification</h2>
      <DocsCodeBlock label="Theme/focus audit scaffold" source={verificationSource} />
      <ul>
        <li>
          Toggle light/dark and verify all statuses, surfaces, borders, and controls remap
          predictably.
        </li>
        <li>
          Validate at both viewport sizes that overlays inherit theme scope when portaling and still
          preserve keyboard focus order.
        </li>
      </ul>
    </DocsShell>
  )
}

import { type PicodashErrorCode } from '@picodash/store'

export type DocsNavSection = {
  label: string
  items: readonly { description: string; href: string; label: string }[]
}

export const docsTopNavSections: readonly DocsNavSection[] = [
  {
    label: 'Get started',
    items: [
      {
        description: 'Manual integration flow for people adding Picodash.',
        href: '/docs/get-started/manual',
        label: 'Manual setup',
      },
      {
        description: 'Agent-ready checklist for deterministic implementation.',
        href: '/docs/get-started/agent',
        label: 'Agent playbook',
      },
    ],
  },
  {
    label: 'Concepts',
    items: [
      {
        description: 'State ownership between store and provider.',
        href: '/docs/concepts/state-ownership',
        label: 'State ownership',
      },
      {
        description: 'Placement, boundaries, and persistable geometry.',
        href: '/docs/concepts/panel-placement',
        label: 'Panel placement',
      },
      {
        description: 'Panel, group, and item anatomy for compose time.',
        href: '/docs/concepts/dashlet-anatomy',
        label: 'Dashlet anatomy',
      },
    ],
  },
  {
    label: 'Guides',
    items: [
      {
        description: 'Build custom controls from Picodash primitives.',
        href: '/docs/guides/custom-dashlets',
        label: 'Custom dashlets',
      },
      {
        description: 'Compose multiple fields into one reusable dashlet.',
        href: '/docs/guides/compound-dashlets',
        label: 'Compound dashlets',
      },
      {
        description: 'Theme propagation and semantic token usage.',
        href: '/docs/guides/dashlet-themes',
        label: 'Theme guide',
      },
      {
        description: 'Keyboard, labels, and contrast-minded behavior.',
        href: '/docs/guides/dashlet-accessibility',
        label: 'Accessibility',
      },
    ],
  },
  {
    label: 'Reference',
    items: [
      {
        description: 'Store creation and adapter-compatible write/read behavior.',
        href: '/docs/reference/store',
        label: 'Store reference',
      },
      {
        description: 'Panel lifecycle, placement, visibility, and actions.',
        href: '/docs/reference/panel',
        label: 'Panel reference',
      },
      {
        description: 'Machine-readable Dashlet contracts.',
        href: '/docs/reference/dashlets',
        label: 'Dashlet controls',
      },
      {
        description: 'Compound Dashlet composition primitives.',
        href: '/docs/reference/dashlet-components',
        label: 'Dashlet components',
      },
      {
        description: 'UI foundation primitives.',
        href: '/docs/reference/ui',
        label: 'UI foundation',
      },
      {
        description: 'Structured diagnostics and severity contract.',
        href: '/docs/reference/diagnostics',
        label: 'Diagnostics',
      },
    ],
  },
]

export const docsConcepts = {
  'state-ownership': {
    slug: 'state-ownership',
    title: 'Store and provider ownership',
    summary: 'Use external stores for values and keep visibility/placement in the provider layer.',
    sections: [
      'Panel values are owned in a store. Keep the store stable and module-scoped.',
      'Provider state owns activation order, placement, and visibility, and can be persisted independently.',
      'Keep field defaults and constraints in the same value record so reset and repair are deterministic.',
    ],
    related: [
      '/docs/reference/store',
      '/docs/reference/panel',
      '/docs/reference/diagnostics',
      '/docs/guides/custom-dashlets',
    ],
  },
  'panel-placement': {
    slug: 'panel-placement',
    title: 'Panel placement and boundaries',
    summary:
      'The provider defines global bounds; each panel may override boundary and placement semantics.',
    sections: [
      'Default placement is viewport-based; `panelBoundary` on provider applies to all panels unless overridden.',
      'Panel `boundary` overrides only that panel and can be `null` to return to viewport bounds.',
      'Floating/snapped/hybrid modes follow distinct contracts for docked edge behavior and detachment.',
    ],
    related: [
      '/docs/reference/panel',
      '/docs/guides/dashlet-accessibility',
      '/docs/reference/diagnostics',
    ],
  },
  'dashlet-anatomy': {
    slug: 'dashlet-anatomy',
    title: 'Dashlet anatomy and composition',
    summary:
      'Compose hierarchy as provider → panel → group → item; use dashlet components for readout structure.',
    sections: [
      'Use `PicodashPanel` for positioning and `PicodashGroup` for ordering and disclosure boundaries.',
      'Use `PicodashItem` for single bound controls and `@picodash/panel/dashlet` for readout structure.',
      'Preserve stable IDs on groups and items; state and reorder use this identity.',
    ],
    related: [
      '/docs/reference/dashlet-components',
      '/docs/reference/dashlets',
      '/docs/reference/panel',
      '/docs/guides/compound-dashlets',
    ],
  },
} as const

export type ConceptSlug = keyof typeof docsConcepts

export const docsConceptsIndex = Object.values(docsConcepts)

export const docsSnippets = {
  install: `bun add @picodash/panel @picodash/store`,
  stylesheet: `import '@picodash/panel/style.css'`,
  createStore: `import { createPicodashStore } from '@picodash/store'

export const dashboardStore = createPicodashStore({
  panelId: 'scene-controls',
  fields: {
    opacity: { defaultValue: 1 },
    showGrid: { defaultValue: true },
    quality: { defaultValue: 'balanced' },
  },
})`,
  agentChecklist: `bun add @picodash/panel @picodash/store
bun install
bun run lint
bun run build`,
  fullPanel: `import {
  PicodashGroup,
  PicodashPanel,
  PicodashProvider,
  PicodashSelect,
  PicodashSlider,
  PicodashSwitch,
} from '@picodash/panel'
import { createPicodashStore } from '@picodash/store'
import '@picodash/panel/style.css'

export const dashboardStore = createPicodashStore({
  panelId: 'scene-controls',
  fields: {
    opacity: { defaultValue: 1 },
    showGrid: { defaultValue: true },
    quality: { defaultValue: 'balanced' },
  },
})

export function SceneControlPanel() {
  return (
    <PicodashProvider persistLayout>
      <PicodashPanel store={dashboardStore} title="Scene controls" width={360}>
        <PicodashGroup id="appearance" label="Appearance">
          <PicodashSlider
            field={dashboardStore.fields.opacity}
            label="Opacity"
            min={0.2}
            max={1}
            step={0.01}
          />
          <PicodashSwitch field={dashboardStore.fields.showGrid} label="Show grid" />
          <PicodashSelect
            field={dashboardStore.fields.quality}
            label="Quality"
            options={[
              { label: 'Draft', value: 'draft' },
              { label: 'Balanced', value: 'balanced' },
              { label: 'Final', value: 'final' },
            ]}
          />
        </PicodashGroup>
      </PicodashPanel>
    </PicodashProvider>
  )
}`,
  actionMenu: `import {
  ActionMenuItem,
  ActionMenuSeparator,
  CopySubmenu,
  ExportSubmenu,
  PicodashPanel,
} from '@picodash/panel'

<PicodashPanel
  store={dashboardStore}
  title="Controls"
  actionMenu={[
    <ActionMenuItem
      key="copy"
      label="Copy state"
      onAction={copyState}
    />,
    <ActionMenuSeparator key="sep" />,
    <CopySubmenu key="clipboard" />,
    <ExportSubmenu key="export" />,
  ]}
>
</PicodashPanel>`,
  panelVisibility: `import {
  PicodashPanel,
  usePicodashPanel,
} from '@picodash/panel'
import { createPicodashStore } from '@picodash/store'

const settingsStore = createPicodashStore({
  fields: {},
  panelId: 'scene-controls',
})

function SceneControlLauncher() {
  const panel = usePicodashPanel('scene-controls')

  return (
    <button onClick={() => panel?.toggle()}>
      {panel?.visible ? 'Hide scene controls' : 'Show scene controls'}
    </button>
  )
}

function SceneControls() {
  return (
    <>
      <SceneControlLauncher />
      <PicodashPanel store={settingsStore} title="Scene controls" />
    </>
  )
}
`,
  dashlet: `import * as Dashlet from '@picodash/panel/dashlet'
import { PicodashItem } from '@picodash/panel'

function QualityReadout() {
  return (
    <PicodashItem id="quality-readout" label="Quality preset">
      <Dashlet.Frame>
        <Dashlet.Header>
          <Dashlet.Heading>Quality telemetry</Dashlet.Heading>
          <Dashlet.Description>Runtime quality is derived from your host metrics.</Dashlet.Description>
        </Dashlet.Header>
        <Dashlet.Body>
          <Dashlet.Metric>
            <Dashlet.MetricLabel>Preset</Dashlet.MetricLabel>
            <Dashlet.MetricValue>balanced</Dashlet.MetricValue>
          </Dashlet.Metric>
        </Dashlet.Body>
      </Dashlet.Frame>
    </PicodashItem>
  )
}`,
  compoundDashlet: `import * as Dashlet from '@picodash/panel/dashlet'
import { PicodashItem } from '@picodash/panel'
import { createPicodashStore } from '@picodash/store'

const performanceStore = createPicodashStore({
  panelId: 'performance',
  fields: {
    fps: { defaultValue: 60 },
    droppedFrames: { defaultValue: 0 },
  },
})

function RenderHealthDashlet() {
  return (
    <PicodashItem
      id="render-health"
      contentLayout="full"
      fields={{
        fps: { field: performanceStore.fields.fps, mode: 'display' },
        droppedFrames: {
          field: performanceStore.fields.droppedFrames,
          mode: 'display',
        },
      }}
      label="Render health"
    >
      {({ fields }) => (
        <Dashlet.Surface variant="well">
          <Dashlet.Header>
            <Dashlet.Heading>Render health</Dashlet.Heading>
            <Dashlet.Description>Computed from live host fields.</Dashlet.Description>
          </Dashlet.Header>
          <Dashlet.Body>
            <Dashlet.Metric>
              <Dashlet.MetricLabel>FPS</Dashlet.MetricLabel>
              <Dashlet.MetricValue>{fields.fps.value}</Dashlet.MetricValue>
            </Dashlet.Metric>
            <Dashlet.Metric>
              <Dashlet.MetricLabel>Dropped frames</Dashlet.MetricLabel>
              <Dashlet.MetricValue>{fields.droppedFrames.value}</Dashlet.MetricValue>
            </Dashlet.Metric>
          </Dashlet.Body>
        </Dashlet.Surface>
      )}
    </PicodashItem>
  )
}`,
  themes: `import {
  PicodashPanel,
  PicodashProvider,
} from '@picodash/panel'

import '@picodash/panel/style.css'
import './theme-overrides.css'

<PicodashProvider theme="system">
  <div className="dashboard-surface" data-picodash-theme="brand">
    <PicodashPanel store={dashboardStore} title="Scene controls" />
  </div>
</PicodashProvider>

/* theme-overrides.css */
[data-picodash-theme='brand'] {
  --picodash-color-well: oklch(0.38 0.07 225);
  --picodash-color-text: oklch(0.97 0.01 250);
  --picodash-color-border: oklch(0.58 0.06 230);
}
`,
  accessibility: `import { PicodashItem } from '@picodash/panel'

<PicodashItem
  field={dashboardStore.fields.exposure}
  label="Exposure"
  help="Use higher values to brighten the scene."
  description="Controls are clamped from 1.0 to 2.0 when 'extendedRange' is enabled."
>
  {({ inputId, setInput, value }) => (
    <input
      id={inputId}
      type="range"
      min={1}
      max={2}
      step={0.1}
      value={value}
      onChange={(event) => setInput(event.currentTarget.valueAsNumber)}
    />
  )}
</PicodashItem>`,
  diagnosticsExample: `import {
  createPicodashDiagnostic,
  PICODASH_ERROR_CODES,
  type PicodashDiagnostic,
} from '@picodash/store'

const diagnostic: PicodashDiagnostic = createPicodashDiagnostic({
  code: PICODASH_ERROR_CODES.MISSING_ACCESSIBLE_LABEL,
  expectedContract: 'Each interactive dashlet item should expose an accessible label.',
  summary: 'Missing accessible label.',
  correction: 'Add a \`label\` prop to the item.',
  identity: { itemId: 'scene-quality' },
})`,
} as const

export function getDiagnosticCodeUrl(code: PicodashErrorCode) {
  return `https://picodash.dev/docs/v1/diagnostics/${code
    .replace('PICODASH_', '')
    .toLowerCase()
    .replaceAll('_', '-')}`
}

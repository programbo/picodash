import type { Metadata } from 'next'

import { DocsCodeBlock, DocsShell } from '@/components/docs/docs-shell'

export const metadata: Metadata = {
  title: 'Agent playbook',
  description: 'Deterministic checklist for agent-ready Picodash integrations.',
  alternates: {
    canonical: '/docs/get-started/agent',
  },
}

const decisionSequence = [
  {
    key: 'built-in',
    name: 'Built-in Dashlet first',
    description:
      'Use @picodash/panel built-ins when they match behavior and contract for one value.',
  },
  {
    key: 'single',
    name: 'Custom single-value Dashlet second',
    description:
      'If no built-in matches, use one <code>field</code> with a typed custom Dashlet body.',
  },
  {
    key: 'compound',
    name: 'Compound Dashlet third',
    description:
      'When one unit needs several values, bind them with one <code>fields</code> map and one item.',
  },
  {
    key: 'group',
    name: 'Group as fourth',
    description:
      'Use <code>PicodashGroup</code> for siblings that must move, reset, or surface independently.',
  },
] as const

const ownershipChecklist = [
  {
    item: 'Store ownership',
    detail:
      'Create one stable store per panel with <code>createPicodashStore</code>, and never replace it at runtime.',
  },
  {
    item: 'Field ownership',
    detail:
      'Bind every control through explicit <code>store.fields</code> handles so typed contracts stay local and deterministic.',
  },
  {
    item: 'Existing-state adapter decision',
    detail:
      'Decide whether panel values are app-owned state via adapter sync and keep adapter I/O synchronous, complete, and single-source-of-truth.',
  },
  {
    item: 'Provider ownership',
    detail:
      'Keep panel visibility, activation, placement, and focus in <code>PicodashProvider</code> (not duplicated host state).',
  },
  {
    item: 'Anatomy stability',
    detail:
      'Register a stable <code>id</code> per item and per panel. Stable IDs drive reorder, focus, and reset boundaries.',
  },
  {
    item: 'Theme and portal scope',
    detail:
      'Keep theme and overlay boundaries near provider and panel roots, then verify `data-picodash-theme` propagation.',
  },
] as const

const storeSnippet = `import { createPicodashStore } from '@picodash/store'

export const monitorStore = createPicodashStore({
  panelId: 'agent-scene-monitor',
  fields: {
    fps: { defaultValue: 60 },
    targetFps: { defaultValue: 60 },
    mode: { defaultValue: 'balanced' },
    visible: { defaultValue: true },
  },
})`

const shellSnippet = `import { useRef } from 'react'
import { usePicodashStoreSelector } from '@picodash/store/react'
import {
  PicodashPanel,
  PicodashPanelTrigger,
  PicodashProvider,
  PicodashGroup,
  PicodashSelect,
  PicodashSlider,
  PicodashSwitch,
} from '@picodash/panel'
import '@picodash/panel/style.css'

import { monitorStore } from './store'

export function AgentHostShell() {
  const boundaryRef = useRef<HTMLDivElement>(null)
  const visible = usePicodashStoreSelector(monitorStore, (state) => state.values.visible)

  return (
    <PicodashProvider persistLayout panelBoundary={boundaryRef} theme="system">
      <main ref={boundaryRef}>
        <h1>App scene</h1>
        <p>Live values are currently {visible ? 'enabled' : 'disabled'}.</p>
      </main>

      <PicodashPanelTrigger action="activate" store={monitorStore} variant="outline">
        Open scene panel
      </PicodashPanelTrigger>

      <PicodashPanel store={monitorStore} title="Scene monitor" width={340}>
        <PicodashGroup id="scene" label="Scene">
          <PicodashSlider field={monitorStore.fields.fps} label="FPS" min={24} max={120} />
          <PicodashSlider
            field={monitorStore.fields.targetFps}
            label="Target FPS"
            min={24}
            max={120}
          />
          <PicodashSelect
            field={monitorStore.fields.mode}
            label="Mode"
            options={[
              { label: 'Draft', value: 'draft' },
              { label: 'Balanced', value: 'balanced' },
              { label: 'Performance', value: 'performance' },
            ]}
          />
          <PicodashSwitch field={monitorStore.fields.visible} label="Show overlay" />
        </PicodashGroup>
      </PicodashPanel>
    </PicodashProvider>
  )
}`

const closeReopenSnippet = `import { monitorStore } from './store'
import { PicodashPanelLauncher } from '@picodash/panel'

function SceneControlRail() {
  return <PicodashPanelLauncher label="Scene controls" items={[{ label: 'Open / toggle scene panel', store: monitorStore }]} />
}`

const verificationChecklist = [
  {
    item: 'Type verification',
    detail:
      'Compile the integration with explicit <code>createPicodashStore</code> field contracts and no wrapper types.',
  },
  {
    item: 'Selection sequence',
    detail:
      'Confirm built-in or single/custom/compound decision order and document why a deeper choice was required.',
  },
  {
    item: 'Keyboard and focus',
    detail:
      'Test panel open, close, and focus restoration with keyboard-first flow on both 390px and 1280px.',
  },
  {
    item: 'Theme/portal',
    detail:
      'Check `provider.theme`, panel theme overrides, and overlay portal theme carry on re-open.',
  },
  {
    item: 'Diagnostics and close/reopen',
    detail:
      'Inspect diagnostics for panel visibility and reopen affordance warnings, then rerun after a hard-close cycle.',
  },
] as const

const smokeCommands = [
  'bun run --filter @picodash/web check',
  'bun run --filter @picodash/web build',
  'bun run --filter @picodash/web test',
] as const

export default function AgentPlaybookPage() {
  return (
    <DocsShell title="Agent playbook" withProductRoute={false}>
      <p>
        The agent path is deterministic and concise: try built-ins first, then the lightest custom
        form, and only escalate to compound or grouped composition when behavior requires it.
      </p>

      <h2>Decision sequence</h2>
      <ol className="list-decimal">
        {decisionSequence.map((decision) => (
          <li key={decision.key}>
            <strong>{decision.name}</strong> —{' '}
            <span dangerouslySetInnerHTML={{ __html: decision.description }} />
          </li>
        ))}
      </ol>

      <h2>State ownership checklist</h2>
      <ul>
        {ownershipChecklist.map((entry) => (
          <li key={entry.item}>
            <strong>{entry.item}</strong> —{' '}
            <span dangerouslySetInnerHTML={{ __html: entry.detail }} />
          </li>
        ))}
      </ul>

      <h2>Canonical scaffold</h2>
      <DocsCodeBlock label="createPicodashStore" source={storeSnippet} />
      <DocsCodeBlock label="Provider + panel + trigger" source={shellSnippet} />

      <h2>Close/reopen behavior</h2>
      <p>
        If a panel is dismissible, keep an explicit reopen path so focus can return predictably and
        trigger usage remains observable.
      </p>
      <DocsCodeBlock label="Panel reopen pattern" source={closeReopenSnippet} />

      <h2>Smoke checks</h2>
      <ul>
        {smokeCommands.map((command) => (
          <li key={command}>
            <code>{command}</code>
          </li>
        ))}
      </ul>

      <h2>Verification checklist</h2>
      <ul>
        {verificationChecklist.map((check) => (
          <li key={check.item}>
            <strong>{check.item}</strong> —{' '}
            <span dangerouslySetInnerHTML={{ __html: check.detail }} />
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
          <a href="/docs/reference/dashlet-components">Dashlet components</a>
        </li>
        <li>
          <a href="/docs/reference/diagnostics">Diagnostics reference</a>
        </li>
      </ul>
    </DocsShell>
  )
}

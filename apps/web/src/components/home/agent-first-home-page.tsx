'use client'

import Link from 'next/link'
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import {
  builtInItemsPanelId,
  builtInItemsPanelStore,
} from '@/components/items/built-in/built-in-items-panel'
import { DocsCodeBlock } from '@/components/docs/docs-shell'
import { HomeContent, HomeFrame } from '@/components/home/home-frame'
import { PicodashPanelTrigger, usePicodashPanel } from '@picodash/picodash'
import { AgentFirstHostScene } from '@/components/home/agent-first-host-scene'
import { AgentFirstScenarios } from '@/components/home/agent-first-scenarios'

const panelFlowSource = `import { PicodashPanel } from '@picodash/picodash'
import { createPicodashStore } from '@picodash/store'

const sceneStore = createPicodashStore({
  panelId: 'scene-controls',
  fields: {
    text: { defaultValue: 'hello' },
    contrast: { defaultValue: 1.1 },
  },
})

function ScenePanel() {
  return <PicodashPanel store={sceneStore} title="Scene controls" />
}`

const dashletFlowSource = `import * as Dashlet from '@picodash/picodash/dashlet'
import { PicodashItem } from '@picodash/picodash'

function RenderReadout() {
  return (
    <PicodashItem id="render-readout" contentLayout="full" fields={{
      fps: { field: monitorStore.fields.fps, mode: 'display' },
    }}>
      {({ fields }) => (
        <Dashlet.Frame>
          <Dashlet.Header>
            <Dashlet.Heading>Runtime</Dashlet.Heading>
            <Dashlet.Description>Live host values inside a semantic card.</Dashlet.Description>
          </Dashlet.Header>
          <Dashlet.Body>
            <Dashlet.Metric>
              <Dashlet.MetricLabel>FPS</Dashlet.MetricLabel>
              <Dashlet.MetricValue>{fields.fps.value}</Dashlet.MetricValue>
            </Dashlet.Metric>
          </Dashlet.Body>
        </Dashlet.Frame>
      )}
    </PicodashItem>
  )
}`

const agentPromptSource = `Implement a Picodash control or monitoring surface for this application.

Use the canonical agent playbook at /docs/get-started/agent as the source of truth.
Keep application state ownership explicit, choose the smallest suitable Dashlet shape,
and verify the documented type, theme, accessibility, diagnostic, and lifecycle contracts.`

export function AgentFirstHomePage() {
  const scenePanel = usePicodashPanel(builtInItemsPanelId)
  const scenePanelPlacement = scenePanel?.placement?.mode ?? 'floating'
  const [copyStatus, setCopyStatus] = useState<'copied' | 'error' | 'idle'>('idle')

  const copyAgentPrompt = async () => {
    try {
      await navigator.clipboard.writeText(agentPromptSource)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    }

    window.setTimeout(() => setCopyStatus('idle'), 1600)
  }

  return (
    <HomeFrame
      activeTab="code"
      toolbar={
        <span className="flex items-center gap-2 self-end font-mono text-[11px] text-zinc-400 sm:self-auto">
          <span className="size-1.5 animate-pulse bg-emerald-300 motion-reduce:animate-none" />
          Agent-first composition
        </span>
      }
    >
      <HomeContent aria-label="Agent-first home page">
        <div className="mx-auto grid max-w-6xl min-w-0 gap-12 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <header className="space-y-3">
            <p className="text-xs tracking-[0.2em] text-zinc-500 uppercase">
              Panel + Store + Dashlet
            </p>
            <h1 className="text-3xl font-medium text-zinc-100 sm:text-4xl">
              Dashboard surface, without the ceremony
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-zinc-400 sm:text-base">
              This page demonstrates the host-first pattern: `PicodashPanel` owns interaction and
              layout state, while domain state is modeled by native Store schemas. Dashlets inside
              panels keep readouts semantic, reusable, and accessible.
            </p>

            <div className="flex flex-wrap gap-2 pt-2">
              <PicodashPanelTrigger
                action="activate"
                className="rounded-sm border border-emerald-300/35 bg-emerald-300/10 px-3 py-2 text-sm font-medium text-emerald-100 transition-colors hover:bg-emerald-300/18 disabled:cursor-not-allowed disabled:opacity-45"
                store={builtInItemsPanelStore}
              >
                Explore demo
              </PicodashPanelTrigger>
              <button
                className="inline-flex items-center gap-1.5 rounded-sm border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/12"
                type="button"
                onClick={copyAgentPrompt}
              >
                {copyStatus === 'copied' ? (
                  <>
                    <Check aria-hidden="true" className="size-3" />
                    Copied prompt
                  </>
                ) : copyStatus === 'error' ? (
                  'Copy failed'
                ) : (
                  <>
                    <Copy aria-hidden="true" className="size-3" />
                    Copy agent prompt
                  </>
                )}
              </button>
              <Link
                className="rounded-sm border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/12"
                href="/docs/get-started/manual"
              >
                Install
              </Link>
              <Link
                className="rounded-sm border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/12"
                href="/docs"
              >
                Docs
              </Link>
            </div>

            <p className="text-xs text-zinc-500">
              Host scene placement mode:{' '}
              <span className="text-zinc-300">{scenePanelPlacement ?? 'floating'}</span>
            </p>
            <p className="text-xs text-zinc-500">
              Store contract: native `Store` for panel-native state and `usePicodashStateAdapter`
              for existing host state.
            </p>
          </header>

          <section className="grid gap-12">
            <AgentFirstHostScene />

            <div className="grid gap-3">
              <header>
                <p className="text-xs tracking-[0.16em] text-zinc-500 uppercase">Pipeline</p>
                <h2 className="mt-1 text-xl font-medium text-zinc-100">
                  Dashboard → Panel → Dashlet
                </h2>
                <p className="mt-1.5 max-w-4xl text-sm text-zinc-400">
                  Panels register controls and expose placement/collaboration behavior; Store
                  provides typed values; Dashlets turn values into intentional summaries in one
                  place.
                </p>
              </header>
              <div className="grid gap-4 md:grid-cols-2">
                <DocsCodeBlock label="Panel boundary" source={panelFlowSource} />
                <DocsCodeBlock label="Compound Dashlet" source={dashletFlowSource} />
              </div>
            </div>

            <AgentFirstScenarios />
          </section>

          <section className="grid gap-3 border border-white/10 bg-white/3 p-5">
            <h3 className="text-lg font-medium text-zinc-100">Reliability proof</h3>
            <ul className="grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
              <li>Typed fields parse writes before they enter runtime Store state.</li>
              <li>Semantic tokens carry dark, light, and custom themes through overlays.</li>
              <li>
                React Aria primitives preserve labels, focus, keyboard behavior, and dismissal.
              </li>
              <li>
                Structured diagnostics expose contract failures without scraping console text.
              </li>
              <li>The six-preset Contract Lab provides deterministic browser fixtures.</li>
              <li>Versioned agent evaluations score realistic integrations before release.</li>
            </ul>
            <p className="text-xs text-zinc-500">
              For runtime contract and full API details, start from{' '}
              <Link className="underline decoration-dotted" href="/docs">
                Documentation
              </Link>
              .
            </p>
          </section>
        </div>
      </HomeContent>
    </HomeFrame>
  )
}

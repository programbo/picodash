'use client'

import { Check, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { useMemo } from 'react'
import {
  builtInItemsPanelId,
  builtInItemsPanelStore,
} from '@/components/items/built-in/built-in-items-panel'
import { usePicodashPanel } from '@picodash/panel'
import { usePicodashStoreSelector } from '@picodash/store/react'

const closeTarget = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const

export function AgentFirstHostScene() {
  const panel = usePicodashPanel(builtInItemsPanelId)
  const hostScene = usePicodashStoreSelector(builtInItemsPanelStore, (state) => state.values)
  const diagnostics = usePicodashStoreSelector(builtInItemsPanelStore, (state) => state.diagnostics)

  const surfaceGradient = useMemo(() => {
    if (!hostScene.gradient.length) return ''

    const stops = hostScene.gradient
      .map((stop) => `${stop.color} ${Math.round(stop.position * 100)}%`)
      .join(', ')
    return `linear-gradient(${Math.round(hostScene.gradientRotation)}deg, ${stops})`
  }, [hostScene.gradient, hostScene.gradientRotation])

  const sceneOpen = panel?.visible ?? false
  const diagnosticWarnings = diagnostics.filter((item) => item.severity === 'warning').length

  return (
    <section className="grid gap-5 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <article className="border border-white/10 bg-white/3 px-5 py-4 sm:px-7 sm:py-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs tracking-[0.18em] text-zinc-400 uppercase">
              Live host scene
            </p>
            <h2 className="mt-1 text-lg font-medium text-zinc-100 sm:text-xl">Operating surface</h2>
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium tracking-[0.08em] uppercase ${
              sceneOpen
                ? 'border-emerald-300/45 bg-emerald-400/12 text-emerald-200'
                : 'border-zinc-500/45 bg-zinc-500/12 text-zinc-300'
            }`}
          >
            {sceneOpen ? (
              <Check aria-hidden="true" className="size-3" />
            ) : (
              <EyeOff aria-hidden="true" className="size-3" />
            )}
            {sceneOpen ? 'Scene controls active' : 'Scene controls hidden'}
          </span>
        </header>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
          The built-in panel below is your live host specimen. It is dismissible through
          provider-level controls and explicitly reopenable from this page.
        </p>

        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs tracking-[0.16em] text-zinc-500 uppercase">Mode</dt>
            <dd className="mt-1 text-sm text-zinc-100">{hostScene.segmented || 'Default mode'}</dd>
          </div>
          <div>
            <dt className="text-xs tracking-[0.16em] text-zinc-500 uppercase">Scene text</dt>
            <dd className="mt-1 truncate text-sm text-zinc-100">
              {hostScene.text || hostScene.multilineText}
            </dd>
          </div>
          <div>
            <dt className="text-xs tracking-[0.16em] text-zinc-500 uppercase">Diagnostics</dt>
            <dd className="mt-1 text-sm text-zinc-100">
              {diagnosticWarnings} warning{diagnosticWarnings === 1 ? '' : 's'} ·{' '}
              {diagnostics.length} total
            </dd>
          </div>
        </dl>

        <div className="mt-5 grid gap-2 border-t border-white/10 pt-4 sm:grid-cols-3">
          <button
            className="rounded-sm border border-white/15 bg-white/5 px-3 py-2.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!sceneOpen}
            type="button"
            onClick={() => panel?.hide()}
          >
            Dismiss scene panel
          </button>
          <button
            className="rounded-sm border border-emerald-300/35 bg-emerald-300/10 px-3 py-2.5 text-sm font-medium text-emerald-100 transition-colors hover:bg-emerald-300/18 disabled:cursor-not-allowed disabled:opacity-45"
            disabled={sceneOpen}
            type="button"
            onClick={() => panel?.show()}
          >
            Reopen panel
          </button>
          <Link
            className="rounded-sm border border-white/15 bg-white/5 px-3 py-2.5 text-center text-sm font-medium text-zinc-100 transition-colors hover:bg-white/12"
            href="/docs/reference/panel"
          >
            Learn close/reopen contract
          </Link>
        </div>

        <p className="mt-4 text-xs text-zinc-500">
          Snap target positions are constrained by provider layout and persisted independently from
          stored values.
        </p>
      </article>

      <article
        className="rounded-sm border border-white/10 bg-white/5 p-5"
        data-close-targets={closeTarget.join(',')}
        aria-live="polite"
      >
        <p className="text-xs tracking-[0.16em] text-zinc-500 uppercase">Scene surface preview</p>
        <p className="mt-2 text-sm text-zinc-400">
          This panel uses actual values from the host store while staying independent from local
          scenario state.
        </p>
        <div
          className="mt-4 h-32 min-w-0 rounded-sm border border-white/12 shadow-[0_20px_80px_0_rgba(0,0,0,0.28)]"
          style={{ background: surfaceGradient }}
        >
          <div className="flex h-full items-center justify-center p-4">
            <p className="max-w-[22rem] rounded-sm border border-white/16 bg-black/35 px-3 py-2 text-sm text-white">
              {hostScene.multilineText.slice(0, 110)}
            </p>
          </div>
        </div>
      </article>
    </section>
  )
}

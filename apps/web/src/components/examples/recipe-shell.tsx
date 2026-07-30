'use client'

import type { ReactNode, RefObject } from 'react'
import { ExternalLink } from 'lucide-react'
import { PicodashPanelTrigger } from '@picodash/panel'
import type { PicodashPanelIdentity } from '@picodash/panel'

export function RecipeShell({
  boundaryRef,
  children,
  description,
  eyebrow,
  store,
  title,
}: {
  boundaryRef: RefObject<HTMLDivElement | null>
  children: ReactNode
  description: string
  eyebrow: string
  store: PicodashPanelIdentity
  title: string
}) {
  return (
    <article className="grid min-w-0 gap-4 border border-zinc-800 bg-zinc-950/75 p-3 sm:p-4">
      <header className="grid gap-3 border-b border-zinc-800 px-1 pb-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <p className="font-mono text-[10px] tracking-[0.2em] text-violet-300 uppercase">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-lg font-medium tracking-tight text-zinc-100">{title}</h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-zinc-400">{description}</p>
        </div>
        <PicodashPanelTrigger action="toggle" store={store} variant="outline">
          <ExternalLink aria-hidden="true" />
          Toggle panel
        </PicodashPanelTrigger>
      </header>
      <div
        ref={boundaryRef}
        className="relative min-h-[35rem] overflow-hidden border border-zinc-800 bg-[linear-gradient(135deg,rgba(39,39,42,.82),rgba(9,9,11,.96))] sm:min-h-[38rem]"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-size-[24px_24px]"
        />
        <div className="absolute right-4 bottom-4 left-4 flex items-center justify-between gap-3 border-t border-zinc-800 pt-3 font-mono text-[10px] tracking-[0.14em] text-zinc-600 uppercase">
          <span>Live compiled recipe</span>
          <span>Public API only</span>
        </div>
        {children}
      </div>
    </article>
  )
}

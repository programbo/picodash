'use client'

import { useRef } from 'react'
import { DashletStyleLab } from './style-lab'

export function DashletStyleLabPage() {
  const boundaryRef = useRef<HTMLElement>(null)

  return (
    <main className="bg-background text-foreground h-svh min-w-[72rem] overflow-hidden">
      <header className="border-border bg-card flex h-20 items-center justify-between border-b px-7">
        <div className="flex items-baseline gap-4">
          <p className="text-muted-foreground font-mono text-[0.625rem] tracking-[0.2em] uppercase">
            Picodash
          </p>
          <h1 className="text-base font-semibold tracking-[-0.01em]">Dashlet style lab</h1>
        </div>
        <p className="text-muted-foreground max-w-xl text-right text-xs leading-5">
          All 22 stable Dashlets in two movable hybrid Panels.
        </p>
      </header>

      <section
        ref={boundaryRef}
        aria-label="Dashlet style lab canvas"
        className="bg-background relative h-[calc(100svh-5rem)] overflow-hidden"
        data-style-lab-canvas
      >
        <DashletStyleLab boundary={boundaryRef} />
      </section>
    </main>
  )
}

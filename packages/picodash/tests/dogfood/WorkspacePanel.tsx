'use client'
import { useRef, type ReactNode } from 'react'
import { DashPanel, DashPanelProvider } from '@picodash/dashpanel'
import type { createSettings } from './Controls.js'

export function WorkspacePanel({
  nexus,
  children,
}: {
  nexus: ReturnType<typeof createSettings>
  children: ReactNode
}) {
  const workspaceRef = useRef<HTMLDivElement>(null)
  return (
    <div style={{ display: 'grid', height: '100dvh', gridTemplateRows: 'auto minmax(0, 1fr)' }}>
      <header>Gear designer</header>
      <div ref={workspaceRef} style={{ position: 'relative', minHeight: 0, overflow: 'auto' }}>
        {children}
        <DashPanelProvider nexus={nexus} boundary={workspaceRef} boundaryInset={12}>
          <DashPanel
            id="workspace-tools"
            title="Design controls"
            width={320}
            boundaryInset={0}
            defaultLayout={{
              placement: {
                mode: 'hybrid',
                disposition: { kind: 'docked', position: 'full-left' },
              },
            }}
          >
            <p>Place your controls here.</p>
          </DashPanel>
        </DashPanelProvider>
      </div>
    </div>
  )
}

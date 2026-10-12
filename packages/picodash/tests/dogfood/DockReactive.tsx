import { DashPanel, DashPanelProvider, useDashPanel } from '@picodash/dashpanel'
import { PicodashProvider } from '@picodash/picodash'
import type { createSettings } from './Controls.js'

export function DockReactiveReadout({
  panelId,
  panelWidth = 320,
}: {
  readonly panelId: string
  readonly panelWidth?: number
}) {
  const panel = useDashPanel(panelId)
  const active = panel.availability === 'available' ? panel.dragPreview : null
  const placement =
    panel.availability === 'available' ? (active?.placement ?? panel.placement) : null
  const target = active?.dockTarget
  const available = target?.kind === 'available' ? target.preview : null
  const position =
    available?.position ??
    (placement?.disposition.kind === 'docked' ? placement.disposition.position : null)
  const reserve = panel.availability === 'available' && panel.visible && !panel.collapsed
  const clearance = reserve ? (available?.bounds.width ?? panelWidth) + 16 : 0
  return (
    <output
      aria-label="Canvas readout"
      data-drag-state={active ? (target?.kind ?? 'free') : 'idle'}
      style={{
        position: 'absolute',
        top: 12,
        left: position?.endsWith('left') ? clearance : 16,
        right: position?.endsWith('right') ? clearance : 16,
        pointerEvents: 'none',
      }}
    >
      Application-owned result
    </output>
  )
}
function CanvasAndTools() {
  return (
    <>
      <div aria-label="Canvas" style={{ height: 400 }}>
        Application-owned canvas and fixed camera
      </div>
      <DockReactiveReadout panelId="tools" />
      <DashPanel
        id="tools"
        title="Tools"
        width={320}
        defaultLayout={{
          placement: { mode: 'hybrid', disposition: { kind: 'docked', position: 'full-left' } },
        }}
      >
        <p>Your controls</p>
      </DashPanel>
    </>
  )
}
export function StandaloneDockLayout({
  nexus,
}: {
  readonly nexus: ReturnType<typeof createSettings>
}) {
  return (
    <div style={{ position: 'relative' }}>
      <DashPanelProvider nexus={nexus} dockPositions={['full-left', 'full-right']}>
        <CanvasAndTools />
      </DashPanelProvider>
    </div>
  )
}
export function PicodashDockLayout({
  nexus,
}: {
  readonly nexus: ReturnType<typeof createSettings>
}) {
  return (
    <div style={{ position: 'relative' }}>
      <PicodashProvider nexus={nexus} dockPositions={['full-left', 'full-right']}>
        <CanvasAndTools />
      </PicodashProvider>
    </div>
  )
}

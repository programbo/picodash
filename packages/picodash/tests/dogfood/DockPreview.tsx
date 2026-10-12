import {
  useDashPanel,
  type DashPanelDockPreview,
  type DashPanelDragPreview,
} from '@picodash/dashpanel'

export function DockPreviewReadout({ panelId }: { readonly panelId: string }) {
  const controller = useDashPanel(panelId)
  const preview: DashPanelDockPreview | null =
    controller.availability === 'available' ? controller.dockPreview : null
  const drag: DashPanelDragPreview | null =
    controller.availability === 'available' ? controller.dragPreview : null
  return (
    <output
      aria-label="Readout dock"
      data-drag-state={drag ? (drag.dockTarget?.kind ?? 'free') : 'idle'}
    >
      {preview
        ? `${preview.panelId}:${preview.position}:${preview.bounds.left}`
        : drag
          ? `${drag.placement.mode}:free:${drag.dockTarget?.kind ?? 'no-target'}`
          : controller.availability}
    </output>
  )
}

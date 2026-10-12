import { useDashPanel, type DashPanelDockPreview } from '@picodash/dashpanel'

export function DockPreviewReadout({ panelId }: { readonly panelId: string }) {
  const controller = useDashPanel(panelId)
  const preview: DashPanelDockPreview | null =
    controller.availability === 'available' ? controller.dockPreview : null
  return (
    <output aria-label="Readout dock">
      {preview
        ? `${preview.panelId}:${preview.position}:${preview.bounds.left}`
        : controller.availability}
    </output>
  )
}

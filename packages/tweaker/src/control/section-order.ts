import type { NormalizedControl } from '../types.js'

export function sectionOrderFor(controls: NormalizedControl[]) {
  return Array.from(new Set(controls.map((control) => control.sectionId)))
}

export function sectionOrderByPanel(controls: NormalizedControl[]) {
  const order: Record<string, string[]> = {}
  for (const control of controls) {
    order[control.panelId] ??= []
    if (!order[control.panelId]!.includes(control.sectionId)) {
      order[control.panelId]!.push(control.sectionId)
    }
  }
  return order
}

export function preserveSectionOrderByPanel(
  currentOrder: Record<string, string[]>,
  controls: NormalizedControl[],
) {
  const liveOrder = sectionOrderByPanel(controls)
  const panelIds = new Set([...Object.keys(currentOrder), ...Object.keys(liveOrder)])
  const nextOrder: Record<string, string[]> = {}

  for (const panelId of panelIds) {
    const liveSectionIds = liveOrder[panelId] ?? []
    const next = [...(currentOrder[panelId] ?? [])]
    for (const sectionId of liveSectionIds) {
      if (!next.includes(sectionId)) next.push(sectionId)
    }
    if (next.length > 0) nextOrder[panelId] = next
  }

  return nextOrder
}

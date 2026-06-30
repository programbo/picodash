import type { NormalizedControl } from '../types.js'

export interface ControlOrderSnapshot {
  id: string
  top: number
  height: number
}

export function orderControls(
  controls: NormalizedControl[],
  sectionId: string,
  order: Record<string, string[]>,
) {
  const sectionControls = controls.filter((control) => control.sectionId === sectionId)
  const persisted = order[sectionId] ?? []
  const persistedIds = new Set(persisted)
  const byId = new Map(sectionControls.map((control) => [control.persistId, control]))
  const ordered = persisted
    .map((id) => byId.get(id))
    .filter((control): control is NormalizedControl => Boolean(control))
  const missing = sectionControls.filter((control) => !persistedIds.has(control.persistId))
  return [...ordered, ...missing]
}

export function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items]
  const [item] = next.splice(from, 1)
  if (item) next.splice(to, 0, item)
  return next
}

export function controlOrderFromPointer(
  element: ParentNode | null | undefined,
  validIds: string[],
  sourceId: string,
  clientY: number,
) {
  if (!element || !validIds.includes(sourceId)) return null
  const valid = new Set(validIds)
  const rows: HTMLElement[] = []
  const seen = new Set<string>()

  for (const row of element.querySelectorAll<HTMLElement>(
    '[data-control-id]:not([data-dnd-dragging])',
  )) {
    const id = row.dataset.controlId
    if (!id || id === sourceId || !valid.has(id) || seen.has(id)) continue
    seen.add(id)
    rows.push(row)
  }

  if (rows.length !== validIds.length - 1) return null

  const targetIndex = rows.findIndex((row) => {
    const rect = row.getBoundingClientRect()
    return clientY < rect.top + rect.height / 2
  })
  const to = targetIndex === -1 ? rows.length : targetIndex
  const ordered = rows.map((row) => row.dataset.controlId).filter((id): id is string => Boolean(id))
  ordered.splice(to, 0, sourceId)
  return ordered
}

export function captureControlOrderSnapshot(
  element: ParentNode | null | undefined,
  validIds: string[],
) {
  if (!element) return null
  const valid = new Set(validIds)
  const rows: ControlOrderSnapshot[] = []
  const seen = new Set<string>()

  for (const row of element.querySelectorAll<HTMLElement>('[data-control-id]')) {
    const id = row.dataset.controlId
    if (!id || !valid.has(id) || seen.has(id)) continue
    const rect = row.getBoundingClientRect()
    seen.add(id)
    rows.push({ id, top: rect.top, height: rect.height })
  }

  return rows.length === validIds.length ? rows : null
}

export function controlOrderFromPointerSnapshot(
  snapshot: ControlOrderSnapshot[] | null | undefined,
  sourceId: string,
  clientY: number,
) {
  if (!snapshot?.some((row) => row.id === sourceId)) return null
  const rows = snapshot.filter((row) => row.id !== sourceId)
  const targetIndex = rows.findIndex((row) => clientY < row.top + row.height / 2)
  const to = targetIndex === -1 ? rows.length : targetIndex
  const ordered = rows.map((row) => row.id)
  ordered.splice(to, 0, sourceId)
  return ordered
}

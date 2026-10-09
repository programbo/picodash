'use client'

import { createContext, useContext, useLayoutEffect, useSyncExternalStore } from 'react'
import type { PicodashFieldDefinitions, ScopedNexus } from '@picodash/nexus'

export type DashStackNode = Readonly<{
  id: string
  kind: 'group' | 'dashlet'
  parentId: string | null
  depth: number
  children: readonly string[]
  fieldKeys: readonly string[]
  visible: boolean
  collapsible: boolean
  collapsed: boolean
}>
export type DashStackStructure = Readonly<{
  rootIds: readonly string[]
  /** Preorder traversal of committed effective order, including hidden descendants. */
  nodes: readonly DashStackNode[]
}>

type NodeRecord = Omit<DashStackNode, 'depth' | 'visible'>
const empty: DashStackStructure = Object.freeze({
  rootIds: Object.freeze([]),
  nodes: Object.freeze([]),
})

function createStructure() {
  let rootIds: readonly string[] = []
  const records = new Map<string, NodeRecord>()
  const focusTargets = new Map<string, () => boolean>()
  const listeners = new Set<() => void>()
  let snapshot = empty
  function publish() {
    const nodes: DashStackNode[] = []
    const seen = new Set<string>()
    function visit(id: string, parentId: string | null, depth: number, visible: boolean) {
      const record = records.get(id)
      if (!record || record.parentId !== parentId || seen.has(id)) return
      seen.add(id)
      const children = record.children.filter((child) => records.get(child)?.parentId === id)
      nodes.push(
        Object.freeze({
          ...record,
          children: Object.freeze(children),
          fieldKeys: Object.freeze([...record.fieldKeys]),
          depth,
          visible,
        }),
      )
      for (const child of children) visit(child, id, depth + 1, visible && !record.collapsed)
    }
    for (const id of rootIds) visit(id, null, 0, true)
    const next = { rootIds: rootIds.filter((id) => records.get(id)?.parentId === null), nodes }
    if (JSON.stringify(next) === JSON.stringify(snapshot)) return
    snapshot = Object.freeze({ rootIds: Object.freeze(next.rootIds), nodes: Object.freeze(nodes) })
    for (const listener of listeners) listener()
  }
  return {
    getSnapshot: () => snapshot,
    focus(id: string) {
      return focusTargets.get(id)?.() ?? false
    },
    registerFocus(id: string, focus: () => boolean) {
      focusTargets.set(id, focus)
      return () => {
        if (focusTargets.get(id) === focus) focusTargets.delete(id)
      }
    },
    subscribe(this: void, listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    root(ids: readonly string[]) {
      rootIds = ids
      publish()
    },
    register(record: NodeRecord) {
      records.set(record.id, record)
      publish()
    },
    remove(id: string) {
      records.delete(id)
      publish()
    },
  }
}

type StructureRegistry = ReturnType<typeof createStructure>
const registries = new WeakMap<object, Map<string, StructureRegistry>>()
export function structureFor(scope: { readonly root: object; readonly scopeId: string }) {
  let byScope = registries.get(scope.root)
  if (!byScope) {
    byScope = new Map()
    registries.set(scope.root, byScope)
  }
  let registry = byScope.get(scope.scopeId)
  if (!registry) {
    registry = createStructure()
    byScope.set(scope.scopeId, registry)
  }
  return registry
}
export const DashStackStructureContext = createContext<StructureRegistry | null>(null)
export const DashGroupAncestryContext = createContext<
  Readonly<{
    id: string | null
    depth: number
    visible: boolean
  }>
>({ id: null, depth: 0, visible: true })

/** Supply a scoped Nexus outside the Stack, or inherit the nearest Stack within its content. */
export function useDashStackStructure<Fields extends PicodashFieldDefinitions>(
  scope?: ScopedNexus<Fields>,
): DashStackStructure {
  const inherited = useContext(DashStackStructureContext)
  const registry = scope ? structureFor(scope) : inherited
  if (!registry)
    throw new TypeError('useDashStackStructure requires a scoped Nexus or DashStack ancestor.')
  return useSyncExternalStore(registry.subscribe, registry.getSnapshot, () => empty)
}

export function useStructureNode(record: NodeRecord) {
  const registry = useContext(DashStackStructureContext)
  const key = JSON.stringify(record)
  useLayoutEffect(() => {
    registry?.register(record)
  }, [registry, key])
  useLayoutEffect(() => () => registry?.remove(record.id), [registry, record.id])
}

/** Read one group's committed child order without being inside that group. */
export function useDashStackGroupOrder<Fields extends PicodashFieldDefinitions>(
  scope: ScopedNexus<Fields>,
  groupId: string,
): readonly string[] {
  return (
    useDashStackStructure(scope).nodes.find((node) => node.kind === 'group' && node.id === groupId)
      ?.children ?? empty.rootIds
  )
}

/** Effective mounted JSX structure; unlike durable metadata, this includes declared defaults. */
export function getDashStackStructure<Fields extends PicodashFieldDefinitions>(
  scope: ScopedNexus<Fields>,
): DashStackStructure {
  return structureFor(scope).getSnapshot()
}
export function subscribeDashStackStructure<Fields extends PicodashFieldDefinitions>(
  scope: ScopedNexus<Fields>,
  listener: () => void,
): () => void {
  return structureFor(scope).subscribe(listener)
}
export function useStructureFocus(id: string, focus: () => boolean) {
  const registry = useContext(DashStackStructureContext)
  useLayoutEffect(() => registry?.registerFocus(id, focus), [registry, id, focus])
}
export type DashletRevealResult = Readonly<
  { ok: true } | { ok: false; reason: 'not-found' | 'rejected' | 'unavailable' }
>
/** Explicit user intent only: expand ancestors, then focus a registered control, never a CSS selector. */
export async function revealDashlet<Fields extends PicodashFieldDefinitions>(
  scope: ScopedNexus<Fields>,
  id: string,
): Promise<DashletRevealResult> {
  const registry = structureFor(scope)
  const snapshot = registry.getSnapshot()
  const node = snapshot.nodes.find((node) => node.id === id && node.kind === 'dashlet')
  if (!node) return { ok: false, reason: 'not-found' }
  const updates: [string, boolean][] = []
  let parentId = node.parentId
  while (parentId !== null) {
    const parent = snapshot.nodes.find((node) => node.id === parentId)
    if (!parent) return { ok: false, reason: 'not-found' }
    if (parent.collapsible && parent.collapsed) updates.push([parent.id, false])
    parentId = parent.parentId
  }
  if (updates.length && !scope.updateDashStackCollapseOverrides(updates).ok)
    return { ok: false, reason: 'rejected' }
  if (typeof requestAnimationFrame === 'undefined') return { ok: false, reason: 'unavailable' }
  // React commits the expansion and removes inert before the focus attempt.
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )
  if (!registry.getSnapshot().nodes.some((node) => node.id === id && node.visible))
    return { ok: false, reason: 'unavailable' }
  return registry.focus(id) ? { ok: true } : { ok: false, reason: 'unavailable' }
}

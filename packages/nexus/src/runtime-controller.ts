export type IdentityReason = 'not-string' | 'empty' | 'surrounding-whitespace' | 'control-character'

export function classifyIdentity(value: unknown): IdentityReason | undefined {
  if (typeof value !== 'string') return 'not-string'
  if (value.trim().length === 0) return 'empty'
  if (value !== value.trim()) return 'surrounding-whitespace'
  for (const character of value) {
    const code = character.codePointAt(0)!
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return 'control-character'
  }
  return undefined
}

export type EntityKind = 'dashPanel' | 'dashList'
export type BindingMode = 'input' | 'display'

export type RuntimeLifecycle = 'active' | 'destroying' | 'destroyed'

export type RuntimeResourceContext = {
  readonly discardUnpersisted: boolean
}

export type RuntimeResource = {
  readonly phase: 'capability' | 'kernel'
  readonly hasUnpersistedState?: () => boolean
  readonly teardown: (context: RuntimeResourceContext) => void
}

export type HostRecord = {
  readonly token: object
  readonly providerId?: string
  readonly standalone: boolean
}

export type ProviderRecord = {
  readonly kind: 'provider'
  readonly root: object
  readonly host: HostRecord
  readonly providerId: string
  lease: object
  active: boolean
  readonly entities: Set<EntityRecord>
}

export type EntityRecord = {
  readonly kind: 'entity'
  readonly root: object
  readonly scopeId: string
  readonly entityKind: EntityKind
  readonly host: HostRecord
  lease: object
  active: boolean
  hostParent?: EntityRecord
  readonly hostDependents: Set<EntityRecord>
}

export type RelationshipRecord = {
  readonly parent: EntityRecord
  readonly child: EntityRecord
  readonly parentScopeId: string
  readonly childScopeId: string
  active: boolean
}

export type BindingRecord = {
  readonly kind: 'binding'
  readonly root: object
  readonly scopeId: string
  readonly itemId: string
  readonly alias: string
  readonly field: object
  readonly mode: BindingMode
  lease: object
  active: boolean
}

export type DashListNodeRecord = {
  readonly kind: 'dashList-node'
  readonly root: object
  readonly scopeId: string
  readonly nodeId: string
  lease: object
  active: boolean
}

type ScopedViewRecord = {
  readonly controller: RuntimeController
  readonly scopeId: string
}

export class RuntimeController {
  root: object
  private rootFinalized = false
  readonly providers = new Map<string, ProviderRecord>()
  readonly entities = new Set<EntityRecord>()
  readonly relationships = new Set<RelationshipRecord>()
  readonly bindings = new Map<string, Map<string, Map<string, BindingRecord>>>()
  readonly handles = new WeakMap<object, ProviderRecord | EntityRecord>()
  readonly bindingHandles = new WeakMap<object, BindingRecord>()
  readonly dashListNodes = new Map<string, Map<string, DashListNodeRecord>>()
  readonly dashListNodeHandles = new WeakMap<object, DashListNodeRecord>()
  readonly relationshipHandles = new WeakMap<object, RelationshipRecord>()
  readonly scopedViews = new WeakMap<object, ScopedViewRecord>()
  readonly parentByChildScope = new Map<string, string>()
  readonly childrenByParentScope = new Map<string, Set<string>>()
  readonly edgeCounts = new Map<string, Map<string, number>>()
  readonly resources = new Set<RuntimeResource>()
  private bindingInteractionCleanup:
    | ((scopeId: string, itemId: string, alias: string) => void)
    | undefined
  private leaseMutationGuard: (() => void) | undefined
  private leaseMutationRunner: (<T>(operation: () => T) => T) | undefined
  lifecycle: RuntimeLifecycle = 'active'

  constructor(root: object) {
    this.root = root
  }

  finalizeRoot(root: object): void {
    if (this.rootFinalized) throw new Error('Runtime root already finalized.')
    this.root = root
    this.rootFinalized = true
  }

  registerResource(resource: RuntimeResource): () => void {
    if (this.lifecycle !== 'active') return () => undefined
    this.resources.add(resource)
    let registered = true
    return () => {
      if (!registered) return
      registered = false
      this.resources.delete(resource)
    }
  }

  hasActiveLeases(): boolean {
    for (const provider of this.providers.values()) if (provider.active) return true
    for (const entity of this.entities) if (entity.active) return true
    for (const relationship of this.relationships) if (relationship.active) return true
    for (const byNode of this.dashListNodes.values())
      for (const node of byNode.values()) if (node.active) return true
    for (const byItem of this.bindings.values())
      for (const byAlias of byItem.values())
        for (const binding of byAlias.values()) if (binding.active) return true
    return false
  }

  activeDashListNode(scopeId: string, nodeId: string): DashListNodeRecord | undefined {
    const record = this.dashListNodes.get(scopeId)?.get(nodeId)
    return record?.active ? record : undefined
  }

  registerDashListNode(record: DashListNodeRecord): void {
    const byNode = this.dashListNodes.get(record.scopeId) ?? new Map<string, DashListNodeRecord>()
    byNode.set(record.nodeId, record)
    this.dashListNodes.set(record.scopeId, byNode)
  }

  releaseDashListNode(record: DashListNodeRecord): void {
    const byNode = this.dashListNodes.get(record.scopeId)
    if (byNode?.get(record.nodeId) === record) {
      byNode.delete(record.nodeId)
      if (byNode.size === 0) this.dashListNodes.delete(record.scopeId)
    }
  }

  activeDashListNodeIds(scopeId: string): readonly string[] {
    return [...(this.dashListNodes.get(scopeId)?.keys() ?? [])].sort()
  }

  setBindingInteractionCleanup(
    cleanup: (scopeId: string, itemId: string, alias: string) => void,
  ): void {
    this.bindingInteractionCleanup = cleanup
  }

  setLeaseMutationGuard(guard: () => void): void {
    this.leaseMutationGuard = guard
  }

  setLeaseMutationRunner(runner: <T>(operation: () => T) => T): void {
    this.leaseMutationRunner = runner
  }

  guardLeaseMutation(): void {
    this.leaseMutationGuard?.()
  }

  withLeaseMutation<T>(operation: () => T): T {
    if (this.leaseMutationRunner) return this.leaseMutationRunner(operation)
    this.guardLeaseMutation()
    return operation()
  }

  activeBinding(scopeId: string, itemId: string, alias: string): BindingRecord | undefined {
    return this.bindings.get(scopeId)?.get(itemId)?.get(alias)
  }

  activeBindingFieldKeys(scopeId: string): readonly string[] {
    const fields = new Set<string>()
    const byItem = this.bindings.get(scopeId)
    if (!byItem) return []
    for (const byAlias of byItem.values()) {
      for (const binding of byAlias.values()) {
        if (!binding.active) continue
        const key = (binding.field as { readonly key?: unknown }).key
        if (typeof key === 'string') fields.add(key)
      }
    }
    return [...fields].sort()
  }

  hasActiveScope(scopeId: string): boolean {
    if (this.bindings.has(scopeId) || this.dashListNodes.has(scopeId)) return true
    for (const entity of this.entities) if (entity.active && entity.scopeId === scopeId) return true
    for (const relationship of this.relationships)
      if (
        relationship.active &&
        (relationship.parentScopeId === scopeId || relationship.childScopeId === scopeId)
      )
        return true
    return false
  }

  registerBinding(record: BindingRecord): void {
    const byItem =
      this.bindings.get(record.scopeId) ?? new Map<string, Map<string, BindingRecord>>()
    const byAlias = byItem.get(record.itemId) ?? new Map<string, BindingRecord>()
    byAlias.set(record.alias, record)
    byItem.set(record.itemId, byAlias)
    this.bindings.set(record.scopeId, byItem)
  }

  releaseBinding(record: BindingRecord): void {
    this.guardLeaseMutation()
    const byItem = this.bindings.get(record.scopeId)
    const byAlias = byItem?.get(record.itemId)
    if (byAlias?.get(record.alias) === record) {
      byAlias.delete(record.alias)
      if (byAlias.size === 0) byItem?.delete(record.itemId)
      if (byItem && byItem.size === 0) this.bindings.delete(record.scopeId)
    }
    this.bindingInteractionCleanup?.(record.scopeId, record.itemId, record.alias)
  }

  hasUnpersistedState(): boolean {
    for (const resource of this.resources) if (resource.hasUnpersistedState?.()) return true
    return false
  }

  destroyResources(context: RuntimeResourceContext): void {
    this.lifecycle = 'destroying'
    let firstError: unknown
    try {
      for (const phase of ['capability', 'kernel'] as const)
        for (const resource of this.resources)
          if (resource.phase === phase)
            try {
              resource.teardown(context)
            } catch (error) {
              firstError ??= error
            }
    } finally {
      this.resources.clear()
      this.providers.clear()
      this.entities.clear()
      this.relationships.clear()
      this.dashListNodes.clear()
      this.bindings.clear()
      this.parentByChildScope.clear()
      this.childrenByParentScope.clear()
      this.edgeCounts.clear()
      this.lifecycle = 'destroyed'
    }
    if (firstError !== undefined) throw firstError
  }

  descendants(scopeId: string): readonly string[] {
    const result = new Set<string>()
    const queue = [...(this.childrenByParentScope.get(scopeId) ?? [])]
    for (let index = 0; index < queue.length; index += 1) {
      const child = queue[index]!
      if (result.has(child)) continue
      result.add(child)
      queue.push(...(this.childrenByParentScope.get(child) ?? []))
    }
    return [...result].sort()
  }

  hasScopePath(fromScopeId: string, toScopeId: string): boolean {
    const seen = new Set<string>()
    const queue = [fromScopeId]
    while (queue.length) {
      const current = queue.shift()!
      if (current === toScopeId) return true
      if (seen.has(current)) continue
      seen.add(current)
      queue.push(...(this.childrenByParentScope.get(current) ?? []))
    }
    return false
  }

  acquireScopeEdge(parentScopeId: string, childScopeId: string): 'conflict' | 'cycle' | undefined {
    const existingParent = this.parentByChildScope.get(childScopeId)
    if (existingParent !== undefined && existingParent !== parentScopeId) return 'conflict'
    if (existingParent === undefined && this.hasScopePath(childScopeId, parentScopeId))
      return 'cycle'
    const children = this.childrenByParentScope.get(parentScopeId) ?? new Set<string>()
    children.add(childScopeId)
    this.childrenByParentScope.set(parentScopeId, children)
    this.parentByChildScope.set(childScopeId, parentScopeId)
    const counts = this.edgeCounts.get(parentScopeId) ?? new Map<string, number>()
    counts.set(childScopeId, (counts.get(childScopeId) ?? 0) + 1)
    this.edgeCounts.set(parentScopeId, counts)
    return undefined
  }

  releaseScopeEdge(parentScopeId: string, childScopeId: string): void {
    const counts = this.edgeCounts.get(parentScopeId)
    if (!counts) return
    const next = (counts.get(childScopeId) ?? 0) - 1
    if (next > 0) {
      counts.set(childScopeId, next)
      return
    }
    counts.delete(childScopeId)
    if (counts.size === 0) this.edgeCounts.delete(parentScopeId)
    const children = this.childrenByParentScope.get(parentScopeId)
    children?.delete(childScopeId)
    if (children && children.size === 0) this.childrenByParentScope.delete(parentScopeId)
    if (this.parentByChildScope.get(childScopeId) === parentScopeId)
      this.parentByChildScope.delete(childScopeId)
  }
}

const controllers = new WeakMap<object, RuntimeController>()
const handleControllers = new WeakMap<object, RuntimeController>()
const scopedViewRecords = new WeakMap<object, ScopedViewRecord>()

export function registerRuntimeController(
  root: object,
  existing?: RuntimeController,
): RuntimeController {
  const controller = existing ?? new RuntimeController(root)
  controllers.set(root, controller)
  return controller
}

export function runtimeControllerFor(root: object): RuntimeController | undefined {
  return controllers.get(root)
}

export function registerRuntimeScopedView(
  view: object,
  controller: RuntimeController,
  scopeId: string,
): void {
  const record = { controller, scopeId }
  scopedViewRecords.set(view, record)
  controller.scopedViews.set(view, record)
}

export function runtimeScopedViewFor(view: object): ScopedViewRecord | undefined {
  return scopedViewRecords.get(view)
}

export function registerRuntimeHandle(handle: object, controller: RuntimeController): void {
  handleControllers.set(handle, controller)
}

export function runtimeControllerForHandle(handle: object): RuntimeController | undefined {
  return handleControllers.get(handle)
}

export function registerRuntimeResource(root: object, resource: RuntimeResource): () => void {
  return runtimeControllerFor(root)?.registerResource(resource) ?? (() => undefined)
}

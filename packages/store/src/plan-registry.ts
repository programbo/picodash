export type BindingPlanKind = 'repair' | 'stale-input-overwrite'

export type BindingPlanRegistryRecord = {
  readonly root: object
  readonly kind: BindingPlanKind
  consumed: boolean
}

export type DashListPrunePlanRegistryRecord = {
  readonly root: object
  readonly scopeId: string
  readonly fingerprint: string
  readonly removeNodeIds: readonly string[]
  consumed: boolean
}

export type PersistencePlanKind = 'conflict-resolution' | 'erase'

export type PersistencePlanRegistryRecord = {
  readonly root: object
  readonly kind: PersistencePlanKind
  readonly snapshot: object
  consumed: boolean
}

export type DocumentPlanKind = 'export' | 'import'

export type DocumentPlanRegistryRecord = {
  readonly root: object
  readonly kind: DocumentPlanKind
  readonly snapshot: object
  consumed: boolean
}

const registry = new WeakMap<object, BindingPlanRegistryRecord>()
const pruneRegistry = new WeakMap<object, DashListPrunePlanRegistryRecord>()
const persistenceRegistry = new WeakMap<object, PersistencePlanRegistryRecord>()
const documentRegistry = new WeakMap<object, DocumentPlanRegistryRecord>()

export function registerBindingPlan(plan: object, record: BindingPlanRegistryRecord): void {
  registry.set(plan, record)
}

export function bindingPlanRecord(plan: object): BindingPlanRegistryRecord | undefined {
  return registry.get(plan)
}

export function registerDashListPrunePlan(
  plan: object,
  record: DashListPrunePlanRegistryRecord,
): void {
  pruneRegistry.set(plan, record)
}

export function dashListPrunePlanRecord(plan: object): DashListPrunePlanRegistryRecord | undefined {
  return pruneRegistry.get(plan)
}

export function registerPersistencePlan(plan: object, record: PersistencePlanRegistryRecord): void {
  persistenceRegistry.set(plan, record)
}

export function persistencePlanRecord(plan: object): PersistencePlanRegistryRecord | undefined {
  return persistenceRegistry.get(plan)
}

export function registerDocumentPlan(plan: object, record: DocumentPlanRegistryRecord): void {
  documentRegistry.set(plan, record)
}

export function documentPlanRecord(plan: object): DocumentPlanRegistryRecord | undefined {
  return documentRegistry.get(plan)
}

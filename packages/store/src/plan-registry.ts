export type BindingPlanKind = 'repair' | 'stale-input-overwrite'

export type BindingPlanRegistryRecord = {
  readonly root: object
  readonly kind: BindingPlanKind
  consumed: boolean
}

const registry = new WeakMap<object, BindingPlanRegistryRecord>()

export function registerBindingPlan(plan: object, record: BindingPlanRegistryRecord): void {
  registry.set(plan, record)
}

export function bindingPlanRecord(plan: object): BindingPlanRegistryRecord | undefined {
  return registry.get(plan)
}

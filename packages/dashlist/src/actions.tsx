'use client'

import {
  ActionMenuItem,
  ActionMenuSeparator,
  ActionSubmenu,
  type ActionMenuItemProps,
} from '@picodash/ui'
import type {
  CoreTransactionResult,
  PicodashFieldDefinitions,
  PersistentTransactionResult,
  RootStore,
  ScopedStore,
} from '@picodash/store'
import { usePicodashStore } from '@picodash/store/react'
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react'

export type DashListActionAvailability = 'unavailable' | 'disabled' | 'enabled'
export type DashListActionStoreResult = CoreTransactionResult | PersistentTransactionResult
export type DashListActionExecutionResult =
  | { readonly status: 'not_executed'; readonly availability: 'unavailable' | 'disabled' }
  | { readonly status: 'executed'; readonly result: DashListActionStoreResult }

export interface DashListActionController {
  readonly availability: DashListActionAvailability
  execute(): DashListActionExecutionResult
}

export interface DashListActions {
  readonly expandAll: DashListActionController
  readonly collapseAll: DashListActionController
  readonly resetValues: DashListActionController
  readonly resetList: DashListActionController
}

export type DashListActionProps = Readonly<{ scopeId?: string }>

type GroupRecord = Readonly<{
  readonly id: string
  readonly collapsible: boolean
  readonly defaultCollapsed: boolean
}>

type BindingRecord = Readonly<{
  readonly key: string
  readonly discardInput: () => void
  readonly dirty: boolean
}>

export type DashListActionSnapshot = Readonly<{
  readonly groups: readonly GroupRecord[]
  readonly bindings: readonly BindingRecord[]
  readonly scope: ReturnType<ScopedStore<PicodashFieldDefinitions>['getState']>['scope']
  readonly announcement: string
}>

export type DashListActionRegistry = Readonly<{
  readonly scopeId: string
  readonly store: ScopedStore<PicodashFieldDefinitions>
  readonly announce: (message: string) => void
  readonly activate: () => void
  readonly subscribe: (listener: () => void) => () => void
  readonly getSnapshot: () => DashListActionSnapshot
  readonly registerGroup: (record: GroupRecord) => () => void
  readonly registerBindings: (itemId: string, bindings: readonly BindingRecord[]) => () => void
  readonly snapshot: () => DashListActionSnapshot
  readonly dispose: () => void
}>

export const DashListActionRegistryContext = createContext<DashListActionRegistry | null>(null)
const registriesByRoot = new WeakMap<object, Map<string, DashListActionRegistry>>()
type RegistryHub = Readonly<{
  readonly subscribe: (listener: () => void) => () => void
  readonly getSnapshot: () => DashListActionSnapshot
  readonly notify: () => void
}>
const hubsByRoot = new WeakMap<object, RegistryHub>()

function hubForRoot(root: object): RegistryHub {
  const current = hubsByRoot.get(root)
  if (current) return current
  const listeners = new Set<() => void>()
  let snapshot: DashListActionSnapshot = {
    groups: [],
    bindings: [],
    scope: undefined,
    announcement: '',
  }
  const hub: RegistryHub = {
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot() {
      return snapshot
    },
    notify() {
      snapshot = { ...snapshot }
      for (const listener of listeners) listener()
    },
  }
  hubsByRoot.set(root, hub)
  return hub
}

function createRegistry(
  store: ScopedStore<PicodashFieldDefinitions>,
  scopeId: string,
): DashListActionRegistry {
  const groups = new Map<string, GroupRecord>()
  const bindings = new Map<string, readonly BindingRecord[]>()
  const listeners = new Set<() => void>()
  let revision = 0
  let active = false
  let announcement = ''
  let unsubscribeStore: (() => void) | undefined
  const root = store.root
  const hub = hubForRoot(root)
  let cachedSnapshot: DashListActionSnapshot
  const buildSnapshot = (): DashListActionSnapshot => ({
    groups: [...groups.values()],
    bindings: [...bindings.values()].flat(),
    scope: store.getState().scope,
    announcement,
  })
  const notify = () => {
    revision += 1
    cachedSnapshot = buildSnapshot()
    for (const listener of listeners) listener()
  }
  cachedSnapshot = buildSnapshot()
  const snapshot = (): DashListActionSnapshot => cachedSnapshot
  const registry: DashListActionRegistry = {
    scopeId,
    store,
    announce(message) {
      announcement = message
      notify()
    },
    activate() {
      if (active) return
      active = true
      const byScope = registriesByRoot.get(root) ?? new Map<string, DashListActionRegistry>()
      byScope.set(scopeId, registry)
      registriesByRoot.set(root, byScope)
      unsubscribeStore = store.subscribe(notify)
      notify()
      hub.notify()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot() {
      void revision
      return snapshot()
    },
    registerGroup(record) {
      groups.set(record.id, record)
      notify()
      return () => {
        if (groups.get(record.id) === record) {
          groups.delete(record.id)
          notify()
        }
      }
    },
    registerBindings(itemId, next) {
      bindings.set(itemId, next)
      notify()
      return () => {
        if (bindings.get(itemId) === next) {
          bindings.delete(itemId)
          notify()
        }
      }
    },
    snapshot,
    dispose() {
      if (!active) return
      active = false
      unsubscribeStore?.()
      unsubscribeStore = undefined
      groups.clear()
      bindings.clear()
      notify()
      const byScope = registriesByRoot.get(root)
      if (byScope?.get(scopeId) === registry) byScope.delete(scopeId)
      hub.notify()
    },
  }
  return registry
}

export function createDashListActionRegistry(
  store: ScopedStore<PicodashFieldDefinitions>,
  scopeId: string,
): DashListActionRegistry {
  return createRegistry(store, scopeId)
}

function registryForScope(
  store: RootStore<PicodashFieldDefinitions> | ScopedStore<PicodashFieldDefinitions>,
  scopeId: string | undefined,
  nearest: DashListActionRegistry | null,
): DashListActionRegistry | null {
  if (scopeId === undefined) return nearest
  if (nearest?.scopeId === scopeId) return nearest
  const root = store.kind === 'root' ? store : store.root
  return registriesByRoot.get(root)?.get(scopeId) ?? null
}

const noopSubscribe = () => () => undefined
const emptySnapshot: DashListActionSnapshot = {
  groups: [],
  bindings: [],
  scope: undefined,
  announcement: '',
}

function availabilityFor(snapshot: DashListActionSnapshot, kind: 'expand' | 'collapse') {
  const groups = snapshot.groups.filter((group) => group.collapsible)
  if (!groups.length) return 'unavailable' as const
  const desired = kind === 'expand' ? false : true
  return groups.some(
    (group) =>
      (snapshot.scope?.dashList?.collapseOverrides.get(group.id) ?? group.defaultCollapsed) !==
      desired,
  )
    ? ('enabled' as const)
    : ('disabled' as const)
}

function resetListAvailability(snapshot: DashListActionSnapshot) {
  const list = snapshot.scope?.dashList
  return list &&
    (list.rootOrder !== undefined || list.groupOrders.size > 0 || list.collapseOverrides.size > 0)
    ? ('enabled' as const)
    : ('disabled' as const)
}

function resetValuesFingerprint(registry: DashListActionRegistry): string {
  const snapshot = registry.snapshot()
  const inspection = registry.store.inspectRegisteredValueReset()
  return JSON.stringify([
    inspection.registeredFields,
    inspection.changedFields,
    snapshot.bindings.filter((binding) => binding.dirty).map((binding) => binding.key),
  ])
}

function resetListFingerprint(registry: DashListActionRegistry): string {
  const list = registry.snapshot().scope?.dashList
  return JSON.stringify([
    list?.rootOrder ?? null,
    [...(list?.groupOrders ?? [])].sort(([left], [right]) => left.localeCompare(right)),
    [...(list?.collapseOverrides ?? [])].sort(([left], [right]) => left.localeCompare(right)),
  ])
}

function resetValuesAvailability(
  registry: DashListActionRegistry,
  snapshot: DashListActionSnapshot,
) {
  const inspection = registry.store.inspectRegisteredValueReset()
  const hasDirtyDraft = snapshot.bindings.some((binding) => binding.dirty)
  if (!inspection.registeredFields.length && !hasDirtyDraft) return 'unavailable' as const
  return inspection.changedFields.length || hasDirtyDraft
    ? ('enabled' as const)
    : ('disabled' as const)
}

function currentAvailability(
  registry: DashListActionRegistry | null,
  scopeId: string | undefined,
  kind: 'expand' | 'collapse' | 'resetValues' | 'resetList',
) {
  if (!registry || (scopeId !== undefined && scopeId !== registry.scopeId))
    return 'unavailable' as const
  const snapshot = registry.snapshot()
  if (kind === 'expand' || kind === 'collapse') return availabilityFor(snapshot, kind)
  return kind === 'resetValues'
    ? resetValuesAvailability(registry, snapshot)
    : resetListAvailability(snapshot)
}

function executeAction(
  registry: DashListActionRegistry | null,
  scopeId: string | undefined,
  kind: 'expand' | 'collapse' | 'resetValues' | 'resetList',
): DashListActionExecutionResult {
  const availability = currentAvailability(registry, scopeId, kind)
  if (availability !== 'enabled') return { status: 'not_executed', availability }
  const snapshot = registry!.snapshot()
  if (kind === 'expand' || kind === 'collapse') {
    const desired = kind === 'expand' ? false : true
    const updates = snapshot.groups
      .filter((group) => group.collapsible)
      .flatMap((group) => {
        const effective =
          snapshot.scope?.dashList?.collapseOverrides.get(group.id) ?? group.defaultCollapsed
        if (effective === desired) return []
        return [[group.id, desired === group.defaultCollapsed ? null : desired] as const]
      })
    const result = registry!.store.updateDashListCollapseOverrides(updates)
    if (!result.ok)
      registry!.announce(`${kind === 'expand' ? 'Expand all' : 'Collapse all'} was rejected.`)
    return { status: 'executed', result }
  }
  if (kind === 'resetList') {
    const result = registry!.store.resetDashListMetadata()
    if (!result.ok) registry!.announce('Reset list was rejected.')
    return { status: 'executed', result }
  }
  const result = registry!.store.resetRegisteredValues()
  if (result.ok) {
    for (const binding of snapshot.bindings) if (binding.dirty) binding.discardInput()
  } else registry!.announce('Reset values was rejected.')
  return { status: 'executed', result }
}

export function useDashListActions(scopeId?: string): DashListActions {
  // Preserve the public hook contract: calling actions without Store context is an error.
  const store = usePicodashStore()
  const registry = registryForScope(store, scopeId, useContext(DashListActionRegistryContext))
  const root = store.kind === 'root' ? store : store.root
  const hub = scopeId === undefined ? null : hubForRoot(root)
  const subscribe = useCallback(
    (listener: () => void) => {
      const unsubscribeRegistry = registry?.subscribe(listener) ?? noopSubscribe()
      const unsubscribeHub = hub?.subscribe(listener) ?? noopSubscribe()
      return () => {
        unsubscribeRegistry()
        unsubscribeHub()
      }
    },
    [hub, registry],
  )
  const selected = useSyncExternalStore(
    subscribe,
    registry?.getSnapshot ?? (hub ? hub.getSnapshot : () => emptySnapshot),
    registry?.getSnapshot ?? (hub ? hub.getSnapshot : () => emptySnapshot),
  )
  void selected
  const executeExpand = useCallback(
    () => executeAction(registry, scopeId, 'expand'),
    [registry, scopeId],
  )
  const executeCollapse = useCallback(
    () => executeAction(registry, scopeId, 'collapse'),
    [registry, scopeId],
  )
  const executeResetValues = useCallback(
    () => executeAction(registry, scopeId, 'resetValues'),
    [registry, scopeId],
  )
  const executeResetList = useCallback(
    () => executeAction(registry, scopeId, 'resetList'),
    [registry, scopeId],
  )
  const expandAvailability = currentAvailability(registry, scopeId, 'expand')
  const collapseAvailability = currentAvailability(registry, scopeId, 'collapse')
  const resetValuesAvailabilitySnapshot = currentAvailability(registry, scopeId, 'resetValues')
  const resetListAvailabilitySnapshot = currentAvailability(registry, scopeId, 'resetList')
  const expandAll = useMemo(
    () => ({
      availability: expandAvailability,
      execute: executeExpand,
    }),
    [executeExpand, expandAvailability],
  )
  const collapseAll = useMemo(
    () => ({
      availability: collapseAvailability,
      execute: executeCollapse,
    }),
    [executeCollapse, collapseAvailability],
  )
  const resetValues = useMemo(
    () => ({
      availability: resetValuesAvailabilitySnapshot,
      execute: executeResetValues,
    }),
    [executeResetValues, resetValuesAvailabilitySnapshot],
  )
  const resetList = useMemo(
    () => ({
      availability: resetListAvailabilitySnapshot,
      execute: executeResetList,
    }),
    [executeResetList, resetListAvailabilitySnapshot],
  )
  return useMemo(
    () => ({ expandAll, collapseAll, resetValues, resetList }),
    [collapseAll, expandAll, resetList, resetValues],
  )
}

function actionItemProps(
  action: DashListActionController,
  label: string,
  confirmation?: ActionMenuItemProps['confirmation'],
): ActionMenuItemProps {
  return {
    label,
    isDisabled: action.availability !== 'enabled',
    confirmation,
    onAction: () => {
      void action.execute()
    },
  }
}

export function DashListExpandAllItem(props: DashListActionProps) {
  const action = useDashListActions(props.scopeId).expandAll
  return <ActionMenuItem {...actionItemProps(action, 'Expand all')} />
}

export function DashListCollapseAllItem(props: DashListActionProps) {
  const action = useDashListActions(props.scopeId).collapseAll
  return <ActionMenuItem {...actionItemProps(action, 'Collapse all')} />
}

const resetValuesConfirmation = {
  title: 'Reset values and drafts?',
  description:
    'This resets values registered by the current List and discards their drafts. Shared canonical fields change in other Lists; order and collapse metadata remain unchanged.',
  actionLabel: 'Reset values',
} as const
const resetListConfirmation = {
  title: 'Reset this List?',
  description:
    'This removes the current List order and collapse overrides. Values and drafts remain unchanged.',
  actionLabel: 'Reset list',
} as const

function useResetConfirmationGuard(scopeId: string | undefined, kind: 'values' | 'list') {
  const store = usePicodashStore()
  const registry = registryForScope(store, scopeId, useContext(DashListActionRegistryContext))
  const fingerprint = registry
    ? kind === 'values'
      ? resetValuesFingerprint(registry)
      : resetListFingerprint(registry)
    : 'unavailable'
  return useMemo(
    () => ({
      fingerprint,
      getFingerprint: () =>
        registry
          ? kind === 'values'
            ? resetValuesFingerprint(registry)
            : resetListFingerprint(registry)
          : 'unavailable',
      subscribe: registry?.subscribe ?? noopSubscribe,
    }),
    [fingerprint, kind, registry],
  )
}

export function executeDashListActionIfCurrent(
  action: DashListActionController,
  guard: NonNullable<ActionMenuItemProps['confirmation']>['guard'],
): void {
  if (guard && guard.getFingerprint() === guard.fingerprint) void action.execute()
}

export function DashListResetValuesItem(props: DashListActionProps) {
  const action = useDashListActions(props.scopeId).resetValues
  const guard = useResetConfirmationGuard(props.scopeId, 'values')
  return (
    <ActionMenuItem
      {...actionItemProps(action, 'Reset values…', { ...resetValuesConfirmation, guard })}
      onAction={() => executeDashListActionIfCurrent(action, guard)}
      variant="destructive"
    />
  )
}

export function DashListResetListItem(props: DashListActionProps) {
  const action = useDashListActions(props.scopeId).resetList
  const guard = useResetConfirmationGuard(props.scopeId, 'list')
  return (
    <ActionMenuItem
      {...actionItemProps(action, 'Reset list…', { ...resetListConfirmation, guard })}
      onAction={() => executeDashListActionIfCurrent(action, guard)}
      variant="destructive"
    />
  )
}

export function DashListResetSubmenu(props: DashListActionProps) {
  const actions = useDashListActions(props.scopeId)
  if (
    actions.resetValues.availability !== 'enabled' &&
    actions.resetList.availability !== 'enabled'
  )
    return null
  return (
    <ActionSubmenu label="Reset">
      <DashListResetValuesItem scopeId={props.scopeId} />
      <DashListResetListItem scopeId={props.scopeId} />
    </ActionSubmenu>
  )
}

export function DashListActionItems(props: DashListActionProps) {
  const actions = useDashListActions(props.scopeId)
  const hasGroups = actions.expandAll.availability !== 'unavailable'
  const hasReset =
    actions.resetValues.availability === 'enabled' || actions.resetList.availability === 'enabled'
  return (
    <>
      {hasGroups ? <DashListExpandAllItem scopeId={props.scopeId} /> : null}
      {hasGroups ? <DashListCollapseAllItem scopeId={props.scopeId} /> : null}
      {hasGroups && hasReset ? <ActionMenuSeparator /> : null}
      {hasReset ? <DashListResetSubmenu scopeId={props.scopeId} /> : null}
    </>
  )
}

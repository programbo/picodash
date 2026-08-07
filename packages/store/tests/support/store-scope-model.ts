import { clonePicodashValue, picodashJsonEqual } from '../../src/json.js'
import type { PicodashJsonValue } from '../../src/index.ts'

export interface StoreScopeRelationshipLease {
  readonly leaseId: string
  readonly parentScopeId: string
  readonly childScopeId: string
}

export interface StoreScopeModelState<Values extends object = Record<string, PicodashJsonValue>> {
  readonly values: Readonly<Values>
  readonly durableScopeIds: ReadonlySet<string>
  readonly relationshipLeases: ReadonlyMap<string, StoreScopeRelationshipLease>
}

export type StoreScopeModelTransition<Values extends object = Record<string, PicodashJsonValue>> = {
  readonly state: StoreScopeModelState<Values>
  readonly reason?: 'duplicate-lease' | 'missing-lease' | 'cycle' | 'parent-already-set'
}

export interface StoreScopeModel<Values extends object = Record<string, PicodashJsonValue>> {
  readonly state: StoreScopeModelState<Values>
  replaceValues(values: Values): StoreScopeModel<Values>
  resolveScope(scopeId: string): StoreScopeModel<Values>
  setMetadata(scopeId: string): StoreScopeModel<Values>
  clearMetadata(scopeId: string): StoreScopeModel<Values>
  acquireRelationship(
    leaseId: string,
    parentScopeId: string,
    childScopeId: string,
  ): StoreScopeModelTransition<Values>
  releaseRelationship(leaseId: string): StoreScopeModelTransition<Values>
  destroyScopeState(scopeId: string, includeDescendants: boolean): StoreScopeModel<Values>
}

interface FrozenReadonlySet<T> extends ReadonlySet<T> {
  readonly __fixtureImmutable: true
}

interface FrozenReadonlyMap<K, V> extends ReadonlyMap<K, V> {
  readonly __fixtureImmutable: true
}

function immutableSet<T>(values: Iterable<T>): FrozenReadonlySet<T> {
  const entries = [...values]
  const set: FrozenReadonlySet<T> = {
    __fixtureImmutable: true,
    get size() {
      return entries.length
    },
    has(value) {
      return entries.includes(value)
    },
    entries() {
      return entries.map((value) => [value, value] as [T, T])[Symbol.iterator]()
    },
    keys() {
      return entries[Symbol.iterator]() as unknown as SetIterator<T>
    },
    values() {
      return entries[Symbol.iterator]() as unknown as SetIterator<T>
    },
    forEach(callbackfn, thisArg) {
      for (const value of entries) callbackfn.call(thisArg, value, value, set)
    },
    [Symbol.iterator]() {
      return entries[Symbol.iterator]()
    },
  }
  return Object.freeze(set)
}

function immutableMap<K, V>(values: Iterable<readonly [K, V]>): FrozenReadonlyMap<K, V> {
  const entries = [...values].map(([key, value]) => [key, value] as const)
  const map: FrozenReadonlyMap<K, V> = {
    __fixtureImmutable: true,
    get size() {
      return entries.length
    },
    has(key) {
      return entries.some(([entry]) => Object.is(entry, key))
    },
    get(key) {
      return entries.find(([entry]) => Object.is(entry, key))?.[1]
    },
    entries() {
      return entries
        .map(([key, value]) => [key, value] as [K, V])
        [Symbol.iterator]() as unknown as MapIterator<[K, V]>
    },
    keys() {
      return entries.map(([key]) => key)[Symbol.iterator]()
    },
    values() {
      return entries.map(([, value]) => value)[Symbol.iterator]()
    },
    forEach(callbackfn, thisArg) {
      for (const [key, value] of entries) callbackfn.call(thisArg, value, key, map)
    },
    [Symbol.iterator]() {
      return entries
        .map(([key, value]) => [key, value] as [K, V])
        [Symbol.iterator]() as unknown as MapIterator<[K, V]>
    },
  }
  return Object.freeze(map)
}

function strictValues<Values extends object>(values: Values): Readonly<Values> {
  return clonePicodashValue(values as PicodashJsonValue) as Readonly<Values>
}

function initialState<Values extends object>(values: Values): StoreScopeModelState<Values> {
  return Object.freeze({
    values: strictValues(values),
    durableScopeIds: immutableSet<string>([]),
    relationshipLeases: immutableMap<string, StoreScopeRelationshipLease>([]),
  })
}

function transition<Values extends object>(
  state: StoreScopeModelState<Values>,
  next: Partial<StoreScopeModelState<Values>>,
): StoreScopeModelState<Values> {
  return Object.freeze({
    values: next.values ?? state.values,
    durableScopeIds: next.durableScopeIds ?? state.durableScopeIds,
    relationshipLeases: next.relationshipLeases ?? state.relationshipLeases,
  })
}

export function createStoreScopeModel<Values extends object>(
  values: Values,
): StoreScopeModel<Values> {
  return createModel(initialState(values))
}

export function createStoreScopeModelState<Values extends object>(
  values: Values,
): StoreScopeModelState<Values> {
  return initialState(values)
}

export function replaceStoreScopeValues<Values extends object>(
  state: StoreScopeModelState<Values>,
  values: Values,
): StoreScopeModelState<Values> {
  const detached = strictValues(values)
  return picodashJsonEqual(detached as PicodashJsonValue, state.values as PicodashJsonValue)
    ? state
    : transition(state, { values: detached })
}

export function resolveStoreScope<Values extends object>(
  state: StoreScopeModelState<Values>,
  _scopeId: string,
): StoreScopeModelState<Values> {
  return state
}

export function setStoreScopeMetadata<Values extends object>(
  state: StoreScopeModelState<Values>,
  scopeId: string,
): StoreScopeModelState<Values> {
  if (state.durableScopeIds.has(scopeId)) return state
  const scopes = new Set(state.durableScopeIds)
  scopes.add(scopeId)
  return transition(state, { durableScopeIds: immutableSet(scopes) })
}

export function clearStoreScopeMetadata<Values extends object>(
  state: StoreScopeModelState<Values>,
  scopeId: string,
): StoreScopeModelState<Values> {
  if (!state.durableScopeIds.has(scopeId)) return state
  const scopes = new Set(state.durableScopeIds)
  scopes.delete(scopeId)
  return transition(state, { durableScopeIds: immutableSet(scopes) })
}

export function acquireStoreScopeRelationship<Values extends object>(
  state: StoreScopeModelState<Values>,
  leaseId: string,
  parentScopeId: string,
  childScopeId: string,
): StoreScopeModelTransition<Values> {
  if (state.relationshipLeases.has(leaseId)) return { state, reason: 'duplicate-lease' }
  const existingParents = [...state.relationshipLeases.values()]
    .filter((lease) => lease.childScopeId === childScopeId)
    .map((lease) => lease.parentScopeId)
  if (existingParents.some((parent) => parent !== parentScopeId))
    return { state, reason: 'parent-already-set' }
  if (
    parentScopeId === childScopeId ||
    wouldCycle(state.relationshipLeases, parentScopeId, childScopeId)
  )
    return { state, reason: 'cycle' }
  const leases = [...state.relationshipLeases.entries()]
  leases.push([leaseId, Object.freeze({ leaseId, parentScopeId, childScopeId })])
  return { state: transition(state, { relationshipLeases: immutableMap(leases) }) }
}

export function releaseStoreScopeRelationship<Values extends object>(
  state: StoreScopeModelState<Values>,
  leaseId: string,
): StoreScopeModelTransition<Values> {
  if (!state.relationshipLeases.has(leaseId)) return { state, reason: 'missing-lease' }
  const leases = [...state.relationshipLeases.entries()].filter(([id]) => id !== leaseId)
  return { state: transition(state, { relationshipLeases: immutableMap(leases) }) }
}

export function destroyStoreScopeState<Values extends object>(
  state: StoreScopeModelState<Values>,
  scopeId: string,
  includeDescendants: boolean,
): StoreScopeModelState<Values> {
  const targets = new Set([scopeId])
  if (includeDescendants) {
    let changed = true
    while (changed) {
      changed = false
      for (const lease of state.relationshipLeases.values()) {
        if (targets.has(lease.parentScopeId) && !targets.has(lease.childScopeId)) {
          targets.add(lease.childScopeId)
          changed = true
        }
      }
    }
  }
  const scopes = new Set(state.durableScopeIds)
  let changed = false
  for (const target of targets) if (scopes.delete(target)) changed = true
  return changed ? transition(state, { durableScopeIds: immutableSet(scopes) }) : state
}

function createModel<Values extends object>(
  state: StoreScopeModelState<Values>,
): StoreScopeModel<Values> {
  return Object.freeze({
    state,
    replaceValues: (values: Values) => createModel(replaceStoreScopeValues(state, values)),
    resolveScope: (scopeId: string) => createModel(resolveStoreScope(state, scopeId)),
    setMetadata: (scopeId: string) => createModel(setStoreScopeMetadata(state, scopeId)),
    clearMetadata: (scopeId: string) => createModel(clearStoreScopeMetadata(state, scopeId)),
    acquireRelationship: (leaseId: string, parent: string, child: string) =>
      acquireStoreScopeRelationship(state, leaseId, parent, child),
    releaseRelationship: (leaseId: string) => releaseStoreScopeRelationship(state, leaseId),
    destroyScopeState: (scopeId: string, includeDescendants: boolean) =>
      createModel(destroyStoreScopeState(state, scopeId, includeDescendants)),
  })
}

function wouldCycle(
  leases: ReadonlyMap<string, StoreScopeRelationshipLease>,
  parent: string,
  child: string,
) {
  const children = Object.create(null) as Record<string, string[]>
  for (const lease of leases.values()) {
    const list = children[lease.parentScopeId] ?? []
    list.push(lease.childScopeId)
    children[lease.parentScopeId] = list
  }
  const todo = [child]
  const seen = new Set<string>()
  while (todo.length > 0) {
    const current = todo.pop()!
    if (current === parent) return true
    if (seen.has(current)) continue
    seen.add(current)
    todo.push(...(children[current] ?? []))
  }
  return false
}

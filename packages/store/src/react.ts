import {
  useCallback,
  useContext,
  useDebugValue,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react'

import type {
  CoreTransactionResult,
  PicodashFieldDefinitions,
  RootStore,
  ScopedStore,
} from './kernel/index.js'
import { missingStoreContext, PicodashStoreContext } from './store-context.js'

type AnyStore =
  | RootStore<PicodashFieldDefinitions, CoreTransactionResult>
  | ScopedStore<PicodashFieldDefinitions, CoreTransactionResult>
type SnapshotOf<Store extends AnyStore> = ReturnType<Store['getState']>

type RootContextStore = RootStore<PicodashFieldDefinitions, CoreTransactionResult>
type ScopedContextStore = ScopedStore<PicodashFieldDefinitions, CoreTransactionResult>
type RootContextSnapshot = ReturnType<RootContextStore['getState']>
type ScopedContextSnapshot = ReturnType<ScopedContextStore['getState']>

export function usePicodashStore(): RootContextStore | ScopedContextStore
export function usePicodashStore(scopeId: string): ScopedContextStore
export function usePicodashStore(scopeId?: string): RootContextStore | ScopedContextStore {
  const context = useContext(PicodashStoreContext)
  if (!context) return missingStoreContext('root-or-scoped')
  return scopeId === undefined ? context.store : context.root.scope(scopeId)
}

export function usePicodashRootStore(): RootContextStore {
  const context = useContext(PicodashStoreContext)
  if (!context) return missingStoreContext('root-or-scoped')
  return context.root
}

export function usePicodashScope(): ScopedContextStore {
  const context = useContext(PicodashStoreContext)
  if (!context || context.store.kind !== 'scoped') return missingStoreContext('scoped')
  return context.store
}

/**
 * Selects a value from an explicit root or scoped Store and subscribes to the
 * Store's own notification channel. The selected reference is retained when
 * the equality function reports that a new selection is equivalent.
 */
export function usePicodashStoreSelector<Store extends AnyStore, Selection>(
  store: Store,
  selector: (state: SnapshotOf<Store>) => Selection,
  equalityFn?: (left: Selection, right: Selection) => boolean,
): Selection
export function usePicodashStoreSelector(
  store: AnyStore,
  selector: (state: unknown) => unknown,
  equalityFn?: (left: unknown, right: unknown) => boolean,
): unknown {
  const compare = equalityFn ?? Object.is
  const committed = useRef<{ readonly value: unknown } | null>(null)
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store])
  const getSnapshot = useMemo(() => {
    let hasMemoizedSnapshot = false
    let memoizedSnapshot: unknown
    let memoizedSelection: unknown

    const memoizedSelector = (snapshot: unknown) => {
      if (!hasMemoizedSnapshot) {
        hasMemoizedSnapshot = true
        memoizedSnapshot = snapshot
        const nextSelection = selector(snapshot)
        memoizedSelection =
          committed.current !== null && compare(committed.current.value, nextSelection)
            ? committed.current.value
            : nextSelection
        return memoizedSelection
      }

      if (Object.is(memoizedSnapshot, snapshot)) return memoizedSelection
      const nextSelection = selector(snapshot)
      if (compare(memoizedSelection, nextSelection)) {
        memoizedSnapshot = snapshot
        return memoizedSelection
      }
      memoizedSnapshot = snapshot
      memoizedSelection = nextSelection
      return memoizedSelection
    }

    return () => memoizedSelector(store.getState())
  }, [compare, selector, store])
  const selection = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  useEffect(() => {
    committed.current = { value: selection }
  }, [selection])
  useDebugValue(selection)
  return selection
}

export function usePicodashRootSelector<Selection>(
  selector: (state: RootContextSnapshot) => Selection,
  equalityFn?: (left: Selection, right: Selection) => boolean,
): Selection {
  return usePicodashStoreSelector(usePicodashRootStore(), selector, equalityFn)
}

export function usePicodashScopeSelector<Selection>(
  selector: (state: ScopedContextSnapshot) => Selection,
  equalityFn?: (left: Selection, right: Selection) => boolean,
): Selection {
  return usePicodashStoreSelector(usePicodashScope(), selector, equalityFn)
}

/** Compares one-level records or arrays/tuples using Object.is. */
export function shallowEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false
    if (hasOwnSymbols(left) || hasOwnSymbols(right)) return false
    if (left.length !== right.length) return false
    for (let index = 0; index < left.length; index += 1) {
      if (!(index in left) || !(index in right) || !Object.is(left[index], right[index]))
        return false
    }
    return true
  }

  if (!isRecord(left) || !isRecord(right)) return false
  if (hasOwnSymbols(left) || hasOwnSymbols(right)) return false
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  for (const key of leftKeys) {
    if (!Object.prototype.hasOwnProperty.call(right, key) || !Object.is(left[key], right[key])) {
      return false
    }
  }
  return true
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasOwnSymbols(value: object): boolean {
  return Object.getOwnPropertySymbols(value).length > 0
}

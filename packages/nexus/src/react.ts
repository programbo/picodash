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
  RootNexus,
  ScopedNexus,
} from './kernel/index.js'
import { missingNexusContext, PicodashNexusContext } from './nexus-context.js'

type AnyNexus =
  | RootNexus<PicodashFieldDefinitions, CoreTransactionResult>
  | ScopedNexus<PicodashFieldDefinitions, CoreTransactionResult>
type SnapshotOf<Nexus extends AnyNexus> = ReturnType<Nexus['getState']>

type RootContextNexus = RootNexus<PicodashFieldDefinitions, CoreTransactionResult>
type ScopedContextNexus = ScopedNexus<PicodashFieldDefinitions, CoreTransactionResult>
type RootContextSnapshot = ReturnType<RootContextNexus['getState']>
type ScopedContextSnapshot = ReturnType<ScopedContextNexus['getState']>

export function usePicodashNexus(): RootContextNexus | ScopedContextNexus
export function usePicodashNexus(scopeId: string): ScopedContextNexus
export function usePicodashNexus(scopeId?: string): RootContextNexus | ScopedContextNexus {
  const context = useContext(PicodashNexusContext)
  if (!context) return missingNexusContext('root-or-scoped')
  return scopeId === undefined ? context.nexus : context.root.scope(scopeId)
}

export function usePicodashRootNexus(): RootContextNexus {
  const context = useContext(PicodashNexusContext)
  if (!context) return missingNexusContext('root-or-scoped')
  return context.root
}

export function usePicodashScope(): ScopedContextNexus {
  const context = useContext(PicodashNexusContext)
  if (!context || context.nexus.kind !== 'scoped') return missingNexusContext('scoped')
  return context.nexus
}

/**
 * Selects a value from an explicit root or scoped Nexus and subscribes to the
 * Nexus's own notification channel. The selected reference is retained when
 * the equality function reports that a new selection is equivalent.
 */
export function usePicodashNexusSelector<Nexus extends AnyNexus, Selection>(
  nexus: Nexus,
  selector: (state: SnapshotOf<Nexus>) => Selection,
  equalityFn?: (left: Selection, right: Selection) => boolean,
): Selection
export function usePicodashNexusSelector(
  nexus: AnyNexus,
  selector: (state: unknown) => unknown,
  equalityFn?: (left: unknown, right: unknown) => boolean,
): unknown {
  const compare = equalityFn ?? Object.is
  const committed = useRef<{ readonly value: unknown } | null>(null)
  const subscribe = useCallback((listener: () => void) => nexus.subscribe(listener), [nexus])
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

    return () => memoizedSelector(nexus.getState())
  }, [compare, selector, nexus])
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
  return usePicodashNexusSelector(usePicodashRootNexus(), selector, equalityFn)
}

export function usePicodashScopeSelector<Selection>(
  selector: (state: ScopedContextSnapshot) => Selection,
  equalityFn?: (left: Selection, right: Selection) => boolean,
): Selection {
  return usePicodashNexusSelector(usePicodashScope(), selector, equalityFn)
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

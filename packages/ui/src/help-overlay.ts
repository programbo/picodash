import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'

export interface HelpOverlaySnapshot {
  readonly activeOwner: symbol | null
  readonly layers: ReadonlyMap<symbol, number>
}
export type HelpOverlayEvent =
  | { readonly type: 'OPEN'; readonly owner: symbol; readonly layer: number }
  | { readonly type: 'CLOSE'; readonly owner: symbol }
  | { readonly type: 'UNMOUNT'; readonly owner: symbol }

const emptySnapshot: HelpOverlaySnapshot = { activeOwner: null, layers: new Map() }

/** One active help; closing an old lease cannot close its replacement. RAC owns presence. */
export function transitionHelpOverlay(
  state: HelpOverlaySnapshot,
  event: HelpOverlayEvent,
): HelpOverlaySnapshot {
  switch (event.type) {
    case 'OPEN':
      return {
        activeOwner: event.owner,
        layers: new Map(state.layers).set(event.owner, event.layer),
      }
    case 'CLOSE':
      return state.activeOwner === event.owner ? { ...state, activeOwner: null } : state
    case 'UNMOUNT': {
      const layers = new Map(state.layers)
      layers.delete(event.owner)
      return { activeOwner: state.activeOwner === event.owner ? null : state.activeOwner, layers }
    }
  }
}

interface HelpMember {
  readonly element: { current: HTMLElement | null }
  readonly close: () => void
}

function createHelpOverlayRegistry() {
  let snapshot = emptySnapshot
  const members = new Map<symbol, HelpMember>()
  const listeners = new Set<() => void>()
  const send = (event: HelpOverlayEvent) => {
    const next = transitionHelpOverlay(snapshot, event)
    if (next === snapshot) return
    snapshot = next
    for (const listener of listeners) listener()
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    register: (owner: symbol, member: HelpMember) => {
      members.set(owner, member)
      return () => {
        members.delete(owner)
        send({ type: 'UNMOUNT', owner })
      }
    },
    open: (owner: symbol) => {
      if (snapshot.activeOwner === owner) return
      const previous = snapshot.activeOwner
      // Sample only still-painted help roots, including their exits. Do not promote unrelated
      // menus/dialogs or accumulate a layer offset after every settled close.
      let highest = previous === null ? 0 : (snapshot.layers.get(previous) ?? 0)
      for (const member of members.values()) {
        const element = member.element.current
        if (!element?.isConnected) continue
        const layer = Number(element.ownerDocument.defaultView?.getComputedStyle(element).zIndex)
        if (Number.isFinite(layer)) highest = Math.max(highest, layer)
      }
      send({ type: 'OPEN', owner, layer: highest + 1 })
      if (previous !== null) members.get(previous)?.close()
    },
    close: (owner: symbol) => send({ type: 'CLOSE', owner }),
  }
}

const registries = new WeakMap<Document, ReturnType<typeof createHelpOverlayRegistry>>()
function registryFor(document: Document) {
  let registry = registries.get(document)
  if (!registry) {
    registry = createHelpOverlayRegistry()
    registries.set(document, registry)
  }
  return registry
}
const serverSnapshot = () => emptySnapshot
const noSubscription = () => () => undefined

/** OPEN/CLOSE/UNMOUNT are the only ownership events. No timers or duplicate presence state. */
export function useHelpOverlay<Element extends HTMLElement = HTMLElement>({
  enabled,
  isOpen,
  onOpenChange,
  ownerDocument,
}: {
  readonly enabled: boolean
  readonly isOpen: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly ownerDocument: Document | undefined
}) {
  const [owner] = useState(() => Symbol('picodash-help'))
  const element = useRef<Element | null>(null)
  const close = useRef(onOpenChange)
  const registry = useMemo(
    () => (ownerDocument ? registryFor(ownerDocument) : undefined),
    [ownerDocument],
  )
  const state = useSyncExternalStore(
    enabled && registry ? registry.subscribe : noSubscription,
    enabled && registry ? registry.getSnapshot : serverSnapshot,
    serverSnapshot,
  )
  useLayoutEffect(() => {
    close.current = onOpenChange
  }, [onOpenChange])
  useLayoutEffect(
    () =>
      enabled && registry
        ? registry.register(owner, { element, close: () => close.current(false) })
        : undefined,
    [enabled, owner, registry],
  )
  useLayoutEffect(() => {
    if (!enabled || !registry) return
    if (isOpen) registry.open(owner)
    else registry.close(owner)
  }, [enabled, isOpen, owner, registry])
  const changeOpen = useCallback(
    (open: boolean) => {
      // A controlled caller may keep recording help open after pointer exit. Closing waits
      // for its source state to acknowledge the request; another OPEN still supersedes it.
      if (enabled && registry && open && isOpen) registry.open(owner)
      onOpenChange(open)
    },
    [enabled, isOpen, onOpenChange, owner, registry],
  )
  return {
    isOpen: enabled && isOpen && state.activeOwner === owner,
    layer: state.layers.get(owner) ?? 0,
    hasActiveHelp: state.activeOwner !== null,
    element,
    changeOpen,
  }
}

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { useStore } from 'zustand'
import type {
  TweakerItemRegistration,
  TweakerPanelState,
  TweakerPanelStore,
} from './tweaker-panel-types.js'

const TweakerPanelContext = createContext<TweakerPanelStore | null>(null)
const itemOwnersByStore = new WeakMap<TweakerPanelStore, Map<string, symbol>>()

export function TweakerPanelContextProvider({
  children,
  store,
}: {
  children: ReactNode
  store: TweakerPanelStore
}) {
  return <TweakerPanelContext.Provider value={store}>{children}</TweakerPanelContext.Provider>
}

export function useTweakerPanelStoreApi() {
  const store = useContext(TweakerPanelContext)
  if (!store) throw new Error('Tweaker panel content must be rendered inside TweakerPanel.')
  return store
}

export function useTweakerPanelSelector<T>(selector: (state: TweakerPanelState) => T) {
  return useStore(useTweakerPanelStoreApi(), selector)
}

export function useTweakerPanelStoreSelector<T>(
  store: TweakerPanelStore,
  selector: (state: TweakerPanelState) => T,
) {
  return useStore(store, selector)
}

export function useTweakerPanelState() {
  return useTweakerPanelSelector((state) => state)
}

export function useRegisterTweakerItem(item: TweakerItemRegistration) {
  const ownerRef = useRef(Symbol('tweaker-item-owner'))
  const {
    collapsible,
    defaultCollapsed,
    defaultValue,
    field,
    hidden,
    id,
    kind,
    label,
    parse,
    parentId,
    pin,
    reorderable,
    validate,
    valueMode,
  } = item
  const store = useTweakerPanelStoreApi()

  useEffect(() => {
    let owners = itemOwnersByStore.get(store)
    if (owners === undefined) {
      owners = new Map()
      itemOwnersByStore.set(store, owners)
    }
    const existingOwner = owners.get(id)
    if (existingOwner !== undefined && existingOwner !== ownerRef.current) {
      throw new Error(`Tweaker item IDs must be unique within a panel. Duplicate ID: "${id}".`)
    }
    owners.set(id, ownerRef.current)
    return () => {
      if (owners?.get(id) === ownerRef.current) owners.delete(id)
    }
  }, [id, store])

  useEffect(() => {
    store.getState().registerItem({
      collapsible,
      defaultCollapsed,
      defaultValue,
      field,
      hidden,
      id,
      kind,
      label,
      parse,
      parentId,
      pin,
      reorderable,
      validate,
      valueMode,
    })
  }, [
    collapsible,
    defaultCollapsed,
    defaultValue,
    field,
    hidden,
    id,
    kind,
    label,
    parse,
    parentId,
    pin,
    reorderable,
    store,
    validate,
    valueMode,
  ])

  useEffect(() => {
    return () => store.getState().unregisterItem(id)
  }, [id, store])
}

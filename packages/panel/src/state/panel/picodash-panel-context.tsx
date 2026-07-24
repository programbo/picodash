import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { useStore } from 'zustand'
import type {
  PicodashItemRegistration,
  PicodashPanelState,
  PicodashPanelStore,
} from './picodash-panel-types.js'

const PicodashPanelContext = createContext<PicodashPanelStore | null>(null)
const itemOwnersByStore = new WeakMap<PicodashPanelStore, Map<string, symbol>>()

export function PicodashPanelContextProvider({
  children,
  store,
}: {
  children: ReactNode
  store: PicodashPanelStore
}) {
  return <PicodashPanelContext.Provider value={store}>{children}</PicodashPanelContext.Provider>
}

export function usePicodashPanelStoreApi() {
  const store = useContext(PicodashPanelContext)
  if (!store) throw new Error('Picodash panel content must be rendered inside PicodashPanel.')
  return store
}

export function usePicodashPanelSelector<T>(selector: (state: PicodashPanelState) => T) {
  return useStore(usePicodashPanelStoreApi(), selector)
}

export function usePicodashPanelStoreSelector<T>(
  store: PicodashPanelStore,
  selector: (state: PicodashPanelState) => T,
) {
  return useStore(store, selector)
}

export function useRegisterPicodashItem(item: PicodashItemRegistration) {
  const ownerRef = useRef(Symbol('picodash-item-owner'))
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
  const store = usePicodashPanelStoreApi()

  useEffect(() => {
    let owners = itemOwnersByStore.get(store)
    if (owners === undefined) {
      owners = new Map()
      itemOwnersByStore.set(store, owners)
    }
    const existingOwner = owners.get(id)
    if (existingOwner !== undefined && existingOwner !== ownerRef.current) {
      throw new Error(`Picodash item IDs must be unique within a panel. Duplicate ID: "${id}".`)
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

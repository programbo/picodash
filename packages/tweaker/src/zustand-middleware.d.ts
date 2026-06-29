declare module 'zustand/middleware' {
  import type { StateCreator } from 'zustand'

  export interface StorageValue<S> {
    state: S
    version?: number
  }

  export interface PersistStorage<S> {
    getItem: (name: string) => StorageValue<S> | null | Promise<StorageValue<S> | null>
    setItem: (name: string, value: StorageValue<S>) => void | Promise<void>
    removeItem: (name: string) => void | Promise<void>
  }

  export interface PersistOptions<T, PersistedState = T> {
    name: string
    storage?: PersistStorage<PersistedState>
    partialize?: (state: T) => PersistedState
    merge?: (persistedState: unknown, currentState: T) => T
  }

  export function persist<T, PersistedState = T>(
    initializer: StateCreator<T, [], []>,
    options: PersistOptions<T, PersistedState>,
  ): StateCreator<T, [], []>
}

import { createContext } from 'react'
import type {
  CoreTransactionResult,
  PicodashFieldDefinitions,
  RootStore,
  ScopedStore,
} from './kernel/index.js'
import type {
  DeclarativeEntityToken,
  DeclarativeIntegrationHost,
} from './declarative-integration.js'
import { PicodashContractError } from './kernel/index.js'

export type ContextFields = PicodashFieldDefinitions
export type ContextResult = CoreTransactionResult
export type ContextRootStore = RootStore<ContextFields, ContextResult>
export type ContextScopedStore = ScopedStore<ContextFields, ContextResult>
export type ContextStore = ContextRootStore | ContextScopedStore

export type PicodashStoreContextValue = Readonly<{
  root: ContextRootStore
  store: ContextStore
  host: DeclarativeIntegrationHost<ContextFields, ContextResult>
  parentToken: DeclarativeEntityToken | null
}>

export const PicodashStoreContext = createContext<PicodashStoreContextValue | null>(null)

export const missingStoreContext = (required: 'root-or-scoped' | 'scoped'): never => {
  throw new PicodashContractError('missing-store-context', { required })
}

export const freezeStoreContext = (value: PicodashStoreContextValue): PicodashStoreContextValue =>
  Object.freeze(value)

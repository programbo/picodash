import { createContext } from 'react'
import type {
  CoreTransactionResult,
  PicodashFieldDefinitions,
  RootNexus,
  ScopedNexus,
} from './kernel/index.js'
import type {
  DeclarativeEntityToken,
  DeclarativeIntegrationHost,
} from './declarative-integration.js'
import { PicodashContractError } from './kernel/index.js'

export type ContextFields = PicodashFieldDefinitions
export type ContextResult = CoreTransactionResult
export type ContextRootNexus = RootNexus<ContextFields, ContextResult>
export type ContextScopedNexus = ScopedNexus<ContextFields, ContextResult>
export type ContextNexus = ContextRootNexus | ContextScopedNexus

export type PicodashNexusContextValue = Readonly<{
  root: ContextRootNexus
  nexus: ContextNexus
  host: DeclarativeIntegrationHost<ContextFields, ContextResult>
  parentToken: DeclarativeEntityToken | null
}>

export const PicodashNexusContext = createContext<PicodashNexusContextValue | null>(null)

export const missingNexusContext = (required: 'root-or-scoped' | 'scoped'): never => {
  throw new PicodashContractError('missing-nexus-context', { required })
}

export const freezeNexusContext = (value: PicodashNexusContextValue): PicodashNexusContextValue =>
  Object.freeze(value)

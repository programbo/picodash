import type { PicodashJsonValue, CoreTransactionResult } from './kernel/index.js'
import type { SerializedDurableScopeMetadata } from './metadata.js'

export type PicodashQuarantinedScopeMetadata = Readonly<{
  readonly scopeId: string
  readonly raw: PicodashJsonValue
}>

export type PicodashMetadataRecoveryState = Readonly<{
  readonly quarantinedScopes: ReadonlyMap<string, PicodashQuarantinedScopeMetadata>
}>

export interface PicodashMetadataRecovery<
  Result extends CoreTransactionResult = CoreTransactionResult,
> {
  getState(): PicodashMetadataRecoveryState
  subscribe(listener: () => void): () => void
  replaceScope(scopeId: string, replacement: SerializedDurableScopeMetadata | null): Result
}

type MetadataRecoveryOptions<Result extends CoreTransactionResult> = Readonly<{
  readonly assertActive: () => void
  readonly getState: () => PicodashMetadataRecoveryState
  readonly replaceScope: (
    scopeId: string,
    replacement: SerializedDurableScopeMetadata | null,
  ) => Result
  readonly onListenerError?: () => void
}>

export function createMetadataRecovery<Result extends CoreTransactionResult>(
  options: MetadataRecoveryOptions<Result>,
): Readonly<{
  readonly capability: PicodashMetadataRecovery<Result>
  readonly publish: () => void
}> {
  const listeners = new Set<() => void>()
  const publish = () => {
    for (const listener of listeners) {
      try {
        listener()
      } catch {
        options.onListenerError?.()
      }
    }
  }
  const capability: PicodashMetadataRecovery<Result> = {
    getState() {
      options.assertActive()
      return options.getState()
    },
    subscribe(listener) {
      options.assertActive()
      if (typeof listener !== 'function') throw new TypeError('Invalid metadata recovery listener.')
      listeners.add(listener)
      let active = true
      return () => {
        if (!active) return
        active = false
        listeners.delete(listener)
      }
    },
    replaceScope(scopeId, replacement) {
      options.assertActive()
      return options.replaceScope(scopeId, replacement)
    },
  }
  return Object.freeze({ capability: Object.freeze(capability), publish })
}

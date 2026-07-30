import { assertContractLabPresetId, type ContractLabPresetId } from './presets'
import { contractLabActions, type ContractLabAction } from './state'

export interface ContractLabDriver {
  readonly version: 1
  loadPreset(preset: ContractLabPresetId): void
  reset(): void
}

export type ContractLabDispatch = (action: ContractLabAction) => void

export interface ContractLabDriverHost {
  __PICODASH_LAB__?: ContractLabDriver
}

declare global {
  interface Window extends ContractLabDriverHost {}
}

export function createContractLabDriver(dispatch: ContractLabDispatch): ContractLabDriver {
  return Object.freeze({
    version: 1 as const,
    loadPreset(preset: ContractLabPresetId) {
      assertContractLabPresetId(preset)
      dispatch(contractLabActions.loadPreset(preset))
    },
    reset() {
      dispatch(contractLabActions.reset())
    },
  })
}

export function installContractLabDriver(
  dispatch: ContractLabDispatch,
  host: ContractLabDriverHost | undefined = typeof window === 'undefined' ? undefined : window,
): () => void {
  if (host === undefined) {
    return () => undefined
  }

  const driver = createContractLabDriver(dispatch)
  host.__PICODASH_LAB__ = driver

  return () => {
    if (host.__PICODASH_LAB__ === driver) {
      delete host.__PICODASH_LAB__
    }
  }
}

import {
  assertContractLabPresetId,
  DEFAULT_CONTRACT_LAB_PRESET_ID,
  type ContractLabPresetId,
} from './presets'

export type ContractLabOperation = 'initialize' | 'load-preset' | 'reset'

export interface ContractLabState {
  readonly activePreset: ContractLabPresetId
  readonly lastOperation: ContractLabOperation
  readonly specimenRevision: number
}

export type ContractLabAction =
  | {
      readonly preset: string
      readonly type: 'preset/load'
    }
  | {
      readonly type: 'lab/reset'
    }

export function createInitialContractLabState(): ContractLabState {
  return {
    activePreset: DEFAULT_CONTRACT_LAB_PRESET_ID,
    lastOperation: 'initialize',
    specimenRevision: 0,
  }
}

export const contractLabActions = {
  loadPreset(preset: ContractLabPresetId): ContractLabAction {
    return { preset, type: 'preset/load' }
  },
  reset(): ContractLabAction {
    return { type: 'lab/reset' }
  },
} as const

export function contractLabReducer(
  state: ContractLabState,
  action: ContractLabAction,
): ContractLabState {
  switch (action.type) {
    case 'preset/load': {
      assertContractLabPresetId(action.preset)

      return {
        activePreset: action.preset,
        lastOperation: 'load-preset',
        specimenRevision: state.specimenRevision + 1,
      }
    }
    case 'lab/reset':
      return {
        activePreset: DEFAULT_CONTRACT_LAB_PRESET_ID,
        lastOperation: 'reset',
        specimenRevision: state.specimenRevision + 1,
      }
  }
}

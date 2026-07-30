import { expect, test } from 'vite-plus/test'
import {
  CONTRACT_LAB_PRESET_IDS,
  CONTRACT_LAB_PRESETS,
  contractLabActions,
  contractLabReducer,
  createInitialContractLabState,
} from './index'

test('defines exactly the six curated Contract Lab presets', () => {
  expect(CONTRACT_LAB_PRESET_IDS).toEqual([
    'placement',
    'interaction',
    'composition',
    'overlays',
    'documents',
    'themes',
  ])
  expect(CONTRACT_LAB_PRESETS.map(({ id }) => id)).toEqual(CONTRACT_LAB_PRESET_IDS)
})

test('loads a preset through a deterministic reducer transition', () => {
  const initialState = createInitialContractLabState()
  const nextState = contractLabReducer(initialState, contractLabActions.loadPreset('documents'))

  expect(nextState).toEqual({
    activePreset: 'documents',
    lastOperation: 'load-preset',
    specimenRevision: 1,
  })
  expect(initialState).toEqual({
    activePreset: 'placement',
    lastOperation: 'initialize',
    specimenRevision: 0,
  })
})

test('reset returns to placement and advances the specimen revision', () => {
  const documentsState = contractLabReducer(
    createInitialContractLabState(),
    contractLabActions.loadPreset('documents'),
  )

  expect(contractLabReducer(documentsState, contractLabActions.reset())).toEqual({
    activePreset: 'placement',
    lastOperation: 'reset',
    specimenRevision: 2,
  })
})

test('rejects an unknown preset without changing the current state', () => {
  const state = createInitialContractLabState()

  expect(() =>
    contractLabReducer(state, {
      preset: 'unknown',
      type: 'preset/load',
    }),
  ).toThrowError('Unknown Picodash Contract Lab preset: "unknown"')
  expect(state).toEqual(createInitialContractLabState())
})

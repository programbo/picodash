import { expect, test } from 'vite-plus/test'
import {
  createContractLabDriver,
  installContractLabDriver,
  type ContractLabAction,
  type ContractLabDriverHost,
} from './index'

test('dispatches the same public actions used by the visible Console', () => {
  const actions: ContractLabAction[] = []
  const driver = createContractLabDriver((action) => actions.push(action))

  driver.loadPreset('themes')
  driver.reset()

  expect(driver.version).toBe(1)
  expect(actions).toEqual([{ preset: 'themes', type: 'preset/load' }, { type: 'lab/reset' }])
})

test('rejects invalid runtime preset input before dispatch', () => {
  const actions: ContractLabAction[] = []
  const driver = createContractLabDriver((action) => actions.push(action))

  expect(() => {
    ;(driver.loadPreset as (preset: string) => void)('not-a-preset')
  }).toThrowError('Unknown Picodash Contract Lab preset: "not-a-preset"')
  expect(actions).toEqual([])
})

test('installs and uninstalls the versioned window driver', () => {
  const host: ContractLabDriverHost = {}
  const uninstall = installContractLabDriver(() => undefined, host)

  expect(host.__PICODASH_LAB__?.version).toBe(1)

  uninstall()

  expect(host.__PICODASH_LAB__).toBeUndefined()
})

test('an older cleanup never removes a replacement driver', () => {
  const host: ContractLabDriverHost = {}
  const uninstallFirst = installContractLabDriver(() => undefined, host)
  const firstDriver = host.__PICODASH_LAB__
  const uninstallSecond = installContractLabDriver(() => undefined, host)
  const secondDriver = host.__PICODASH_LAB__

  expect(secondDriver).not.toBe(firstDriver)

  uninstallFirst()
  expect(host.__PICODASH_LAB__).toBe(secondDriver)

  uninstallSecond()
  expect(host.__PICODASH_LAB__).toBeUndefined()
})

test('is safe to install during server rendering without a window', () => {
  expect(() => installContractLabDriver(() => undefined, undefined)()).not.toThrow()
})

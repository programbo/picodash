import { expect, test } from 'vite-plus/test'
import { createPicodashStore, PICODASH_ERROR_CODES } from '@picodash/store'
import {
  activatePicodashPanelFromTrigger,
  picodashPanelTriggerLabel,
} from '../src/components/panel/PicodashPanelTrigger.tsx'
import { publishDismissiblePanelWithoutTriggerDiagnostic } from '../src/state/panel/picodash-panel-diagnostics.ts'
import {
  focusPicodashPanelTrigger,
  markPicodashPanelTriggerUsed,
  registerPicodashPanelTrigger,
} from '../src/state/provider/picodash-panel-triggers.ts'
import { createPicodashProviderStore } from '../src/state/provider/picodash-provider.tsx'

test('trigger fallback labels describe the resulting action', () => {
  expect(picodashPanelTriggerLabel('inspector', 'activate', false)).toBe('Open inspector')
  expect(picodashPanelTriggerLabel('inspector', 'toggle', false)).toBe('Open inspector')
  expect(picodashPanelTriggerLabel('inspector', 'toggle', true)).toBe('Hide inspector')
})

test('toggle-show activates and raises the panel while toggle-hide only hides it', () => {
  const provider = createPicodashProviderStore({ persistLayout: false })
  provider.getState().registerPanel({ id: 'inspector', visible: false })
  provider.getState().registerPanel({ id: 'console', visible: true })

  activatePicodashPanelFromTrigger(provider, 'inspector', 'toggle')
  expect(provider.getState().panels.inspector?.visible).toBe(true)
  expect(provider.getState().panelOrder.at(-1)).toBe('inspector')

  activatePicodashPanelFromTrigger(provider, 'inspector', 'toggle')
  expect(provider.getState().panels.inspector?.visible).toBe(false)
  expect(provider.getState().panelOrder.at(-1)).toBe('inspector')
})

test('close restoration prefers the most recently used registered trigger', () => {
  const provider = createPicodashProviderStore({ persistLayout: false })
  const focused: string[] = []
  const first = {
    focus: () => focused.push('first'),
    isConnected: true,
  } as unknown as HTMLButtonElement
  const second = {
    focus: () => focused.push('second'),
    isConnected: true,
  } as unknown as HTMLButtonElement
  const unregisterFirst = registerPicodashPanelTrigger(provider, 'inspector', first)
  const unregisterSecond = registerPicodashPanelTrigger(provider, 'inspector', second)

  markPicodashPanelTriggerUsed(provider, 'inspector', first)
  expect(focusPicodashPanelTrigger(provider, 'inspector')).toBe(true)
  expect(focused).toEqual(['first'])

  unregisterFirst()
  expect(focusPicodashPanelTrigger(provider, 'inspector')).toBe(true)
  expect(focused).toEqual(['first', 'second'])
  unregisterSecond()
})

test('dismissible panels publish structured no-trigger diagnostics on their Store channel', () => {
  const store = createPicodashStore({
    fields: {},
    panelId: 'dismissible',
  })

  const diagnostic = publishDismissiblePanelWithoutTriggerDiagnostic(store)
  expect(diagnostic).toMatchObject({
    code: PICODASH_ERROR_CODES.DISMISSIBLE_WITHOUT_TRIGGER,
    identity: {
      component: '@picodash/panel/PicodashPanel',
      panelId: 'dismissible',
    },
    severity: 'warning',
  })
  expect(diagnostic.documentationUrl).toContain('/diagnostics/dismissible-without-trigger')
  expect(store.diagnostics.getSnapshot()).toEqual([diagnostic])
  expect(store.getState().diagnostics).toEqual([diagnostic])
})

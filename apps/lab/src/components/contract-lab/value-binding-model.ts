import { createPicodashNexus } from '@picodash/nexus'
import { createWebStoragePersistenceDriver } from '@picodash/nexus/web-storage'

export const valueBindingStorageKey = 'picodash-contract-lab-value-binding-v1'

export function clearValueBindingPersistence() {
  window.localStorage.removeItem(valueBindingStorageKey)
}

export function createValueBindingNexus() {
  return createPicodashNexus({
    valueOwner: 'nexus',
    nexusId: 'contract-lab-value-binding',
    schemaVersion: 1,
    persistence: {
      storageKey: valueBindingStorageKey,
      driver: createWebStoragePersistenceDriver('local'),
      values: { defaultFieldPolicy: 'include' },
    },
    fields: {
      name: {
        defaultValue: 'Studio',
        validate: (value: string) =>
          value.trim().length > 0 ? [] : [{ message: 'Enter a workspace name.' }],
      },
      interval: {
        defaultValue: 30,
        validate: (value: number) =>
          Number.isFinite(value) && value >= 1 && value <= 60
            ? []
            : [{ message: 'Choose an interval from 1 to 60 seconds.' }],
      },
      enabled: { defaultValue: true },
    },
  })
}

export type ValueBindingNexus = ReturnType<typeof createValueBindingNexus>

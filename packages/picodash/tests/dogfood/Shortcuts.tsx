'use client'
import {
  createPicodashNexus,
  PicodashProvider,
  DashPanel,
  DashStack,
  SwitchDashlet,
  usePicodashNexusSelector,
} from '@picodash/picodash'
import { createWebStoragePersistenceDriver } from '@picodash/nexus/web-storage'

/** Call once on the client; import @picodash/picodash/style.css in the app. */
export function createSettings() {
  return createPicodashNexus({
    valueOwner: 'nexus',
    nexusId: 'shortcut-example',
    schemaVersion: 1,
    fields: { enabled: { defaultValue: true } },
    persistence: {
      storageKey: 'picodash-shortcut-example-v1',
      driver: createWebStoragePersistenceDriver('local'),
      values: { defaultFieldPolicy: 'include' },
    },
  })
}

export function Controls({ nexus }: { nexus: ReturnType<typeof createSettings> }) {
  const enabled = usePicodashNexusSelector(nexus, (state) => state.values.enabled)
  return (
    <PicodashProvider nexus={nexus}>
      <DashPanel
        id="inspector"
        title="Inspector"
        collapsible
        recordableHotkey
        defaultLayout={{
          placement: { mode: 'fixed', disposition: { kind: 'docked', position: 'full-right' } },
        }}
      >
        <DashStack id="settings">
          <SwitchDashlet id="enabled-control" label="Enabled" field={nexus.fields.enabled} />
        </DashStack>
        <output aria-label="Application value">{enabled ? 'On' : 'Off'}</output>
        <input aria-label="Draft name" defaultValue="Example" />
      </DashPanel>
    </PicodashProvider>
  )
}

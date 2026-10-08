'use client'
import {
  createPicodashNexus,
  DashStack,
  SwitchDashlet,
  usePicodashNexusSelector,
} from '@picodash/picodash'

export function createSettings() {
  return createPicodashNexus({
    valueOwner: 'nexus',
    fields: { enabled: { defaultValue: true } },
  })
}

export function Controls({ nexus }: { nexus: ReturnType<typeof createSettings> }) {
  const enabled = usePicodashNexusSelector(nexus, (state) => state.values.enabled)
  return (
    <>
      <DashStack id="settings" nexus={nexus}>
        <SwitchDashlet id="enabled-control" label="Enabled" field={nexus.fields.enabled} />
      </DashStack>
      <output aria-label="Application value">{enabled ? 'On' : 'Off'}</output>
    </>
  )
}

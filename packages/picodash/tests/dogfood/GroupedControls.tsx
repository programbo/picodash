'use client'
import {
  createPicodashNexus,
  DashGroup,
  DashStack,
  SwitchDashlet,
  type DashGroupProps,
} from '@picodash/picodash'

export function createGroupedSettings() {
  return createPicodashNexus({
    valueOwner: 'nexus',
    fields: { enabled: { defaultValue: true } },
  })
}

type SettingsNexus = ReturnType<typeof createGroupedSettings>

function DriveGroup({
  id,
  pin,
  nexus,
}: {
  id: DashGroupProps['id']
  pin?: DashGroupProps['pin']
  nexus: SettingsNexus
}) {
  return (
    <DashGroup id={id} label="Drive" pin={pin}>
      <SwitchDashlet id="enabled-control" label="Enabled" field={nexus.fields.enabled} />
    </DashGroup>
  )
}

export function GroupedControls({ nexus }: { nexus: SettingsNexus }) {
  return (
    <DashStack id="grouped-settings" nexus={nexus}>
      <DriveGroup id="drive" pin="start" nexus={nexus} />
      <DashGroup id="mechanical-roles" label="Mechanical roles" />
    </DashStack>
  )
}

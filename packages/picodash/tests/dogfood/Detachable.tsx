'use client'
import { PicodashProvider, DashStack, DashGroup, SwitchDashlet } from '@picodash/picodash'
import { createSettings } from './Controls.js'

export function Detachable({ nexus }: { nexus: ReturnType<typeof createSettings> }) {
  return (
    <PicodashProvider nexus={nexus}>
      <DashStack id="detachable-settings">
        <DashGroup id="behavior" label="Behavior" detachable>
          <SwitchDashlet id="enabled" label="Enabled" field={nexus.fields.enabled} />
        </DashGroup>
      </DashStack>
    </PicodashProvider>
  )
}

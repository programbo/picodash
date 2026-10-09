'use client'
import { DashStack, SwitchDashlet } from '@picodash/picodash'
import type { createSettings } from './Controls.js'

export function Emphasis({ nexus }: { nexus: ReturnType<typeof createSettings> }) {
  return (
    <DashStack id="emphasis" nexus={nexus}>
      <SwitchDashlet id="enabled" label="Enabled" field={nexus.fields.enabled} band glow tint />
    </DashStack>
  )
}

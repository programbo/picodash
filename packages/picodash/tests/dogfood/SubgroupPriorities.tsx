'use client'
import { DashStack, DashGroup, Dashlet } from '@picodash/dashstack'
import type { createTargets } from './LinkedControls.js'

// Container policy controls immediate children, not the container's own position.
export function SubgroupPriorities({ nexus }: { nexus: ReturnType<typeof createTargets> }) {
  return (
    <DashStack id="priorities" nexus={nexus} reorderable={false} stickyLanes="both">
      <DashGroup id="geometry" label="Geometry" reorderable={false}>
        <DashGroup id="targets" label="Targets" pin="start" reorderable>
          <Dashlet id="reduction" label="Reduction" />
          <Dashlet id="module" label="Tooth size" />
        </DashGroup>
        <DashGroup id="envelope" label="Envelope" pin="end">
          <Dashlet id="diameter" label="Outer diameter" />
          <Dashlet id="thickness" label="Ring thickness" />
        </DashGroup>
      </DashGroup>
    </DashStack>
  )
}

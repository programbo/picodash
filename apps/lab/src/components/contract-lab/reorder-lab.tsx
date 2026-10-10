import { useState } from 'react'
import {
  DashStack,
  DashGroup,
  Dashlet,
  TextDashlet,
  NumberDashlet,
  SwitchDashlet,
  DisplayDashlet,
  DashStackResetStackItem,
} from '@picodash/dashstack'
import { ActionMenu } from '@picodash/ui'
import type { ValueBindingNexus } from './value-binding-model'

export function ReorderLab({ nexus }: { readonly nexus: ValueBindingNexus }) {
  const [stickyLanes, setStickyLanes] = useState<'start' | 'end' | 'both' | 'none'>('both')
  return (
    <section
      aria-label="Reordering playground"
      className="mt-8 border-t border-(--picodash-color-border) pt-6"
    >
      <h2 className="mb-2 text-lg font-semibold">Reordering playground</h2>
      <p className="mb-4 text-sm text-(--picodash-color-text-muted)">
        Drag the grips to arrange rows and whole groups. Choose which root lanes stay visible while
        the other lanes scroll. Items stay in their own group and lane. Enter picks up a grip,
        arrows move it, and Escape cancels.
      </p>
      <div role="group" aria-label="Sticky lanes" className="mb-3 flex gap-2">
        {(['both', 'start', 'end', 'none'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={stickyLanes === mode}
            className="rounded border border-(--picodash-color-border) px-2 py-1"
            onClick={() => setStickyLanes(mode)}
          >
            {mode}
          </button>
        ))}
      </div>
      <div className="h-[42rem]">
        <DashStack
          nexus={nexus}
          id="binding-reordering"
          title="Workspace control desk"
          headingLevel={3}
          reorderable
          stickyLanes={stickyLanes}
        >
          <DashGroup
            id="start-workspace-pinned"
            aria-label="start-workspace pinned controls"
            pin="start"
          >
            <DisplayDashlet
              id="start-workspace"
              label="Pinned · Workspace"
              field={nexus.fields.name}
            />
          </DashGroup>
          <DashGroup id="start-status" label="Pinned · Status" pin="start" collapsible>
            <DisplayDashlet
              id="start-live"
              label="Live updates"
              field={nexus.fields.enabled}
              formatValue={(value) => (value ? 'Running' : 'Paused')}
            />
          </DashGroup>
          <DashGroup id="workspace" label="Workspace" collapsible>
            <TextDashlet id="workspace-name" label="Workspace name" field={nexus.fields.name} />
            <NumberDashlet
              id="workspace-interval"
              label="Refresh interval"
              field={nexus.fields.interval}
            />
            <SwitchDashlet
              id="workspace-enabled"
              label="Live updates"
              field={nexus.fields.enabled}
            />
          </DashGroup>
          <DisplayDashlet
            id="activity"
            label="Activity"
            field={nexus.fields.enabled}
            formatValue={(value) => (value ? 'Watching for changes' : 'Updates paused')}
          />
          <DashGroup id="monitoring" label="Monitoring" collapsible reorderable={false}>
            <DashGroup id="monitoring-order" aria-label="Monitoring order" reorderable>
              <DisplayDashlet
                id="monitoring-name"
                pin="start"
                label="Source workspace"
                field={nexus.fields.name}
              />
              <DisplayDashlet
                id="monitoring-interval"
                label="Polling cadence"
                field={nexus.fields.interval}
                formatValue={(value) => `${value} seconds`}
              />
              <DisplayDashlet
                id="monitoring-state"
                pin="end"
                label="Connection"
                field={nexus.fields.enabled}
                formatValue={(value) => (value ? 'Active' : 'Idle')}
              />
              <DisplayDashlet
                id="monitoring-summary"
                label="Monitoring summary"
                field={nexus.fields.name}
              />
            </DashGroup>
          </DashGroup>
          <DisplayDashlet
            id="cadence"
            label="Next refresh interval"
            field={nexus.fields.interval}
            formatValue={(value) => `${value} seconds`}
          />
          <DashGroup id="shortcuts" label="Quick adjustments" collapsible>
            <SwitchDashlet
              id="shortcut-enabled"
              label="Enable updates"
              field={nexus.fields.enabled}
            />
            <NumberDashlet
              id="shortcut-interval"
              label="Adjust cadence"
              field={nexus.fields.interval}
            />
            <TextDashlet id="shortcut-name" label="Rename workspace" field={nexus.fields.name} />
          </DashGroup>
          <DisplayDashlet
            id="summary"
            label="Workspace summary"
            field={nexus.fields.name}
            formatValue={(value) => `Settings for ${value}`}
          />
          <DashGroup id="end-cadence-pinned" aria-label="end-cadence pinned controls" pin="end">
            <DisplayDashlet
              id="end-cadence"
              label="Pinned · Cadence"
              field={nexus.fields.interval}
              formatValue={(value) => `${value}s`}
            />
          </DashGroup>
          <DashGroup id="end-actions-pinned" aria-label="end-actions pinned controls" pin="end">
            <Dashlet id="end-actions" label="Pinned · Actions">
              <ActionMenu label="Reordering actions">
                <DashStackResetStackItem />
              </ActionMenu>
            </Dashlet>
          </DashGroup>
        </DashStack>
      </div>
    </section>
  )
}

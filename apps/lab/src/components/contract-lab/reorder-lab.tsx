import {
  DashList,
  DashGroup,
  Dashlet,
  TextDashlet,
  NumberDashlet,
  SwitchDashlet,
  DisplayDashlet,
  DashListResetListItem,
} from '@picodash/dashlist'
import { ActionMenu } from '@picodash/ui'
import type { ValueBindingNexus } from './value-binding-model'

export function ReorderLab({ nexus }: { readonly nexus: ValueBindingNexus }) {
  return (
    <section
      aria-label="Reordering playground"
      className="mt-8 border-t border-(--picodash-color-border) pt-6"
    >
      <h2 className="mb-2 text-lg font-semibold">Reordering playground</h2>
      <p className="mb-4 text-sm text-(--picodash-color-text-muted)">
        Drag the grips to arrange rows and whole groups. Start and end lanes stay visible while the
        middle scrolls. Items stay in their own group and lane. Enter picks up a grip, arrows move
        it, and Escape cancels.
      </p>
      <div className="h-[42rem]">
        <DashList
          nexus={nexus}
          id="binding-reordering"
          title="Workspace control desk"
          headingLevel={3}
          reorderable
        >
          <DisplayDashlet
            id="start-workspace"
            label="Pinned · Workspace"
            field={nexus.fields.name}
            pin="start"
          />
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
          <DashGroup id="monitoring" label="Monitoring" collapsible>
            <DisplayDashlet
              id="monitoring-name"
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
              label="Connection"
              field={nexus.fields.enabled}
              formatValue={(value) => (value ? 'Active' : 'Idle')}
            />
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
          <DisplayDashlet
            id="end-cadence"
            label="Pinned · Cadence"
            field={nexus.fields.interval}
            pin="end"
            formatValue={(value) => `${value}s`}
          />
          <Dashlet id="end-actions" label="Pinned · Actions" pin="end">
            <ActionMenu label="Reordering actions">
              <DashListResetListItem />
            </ActionMenu>
          </Dashlet>
        </DashList>
      </div>
    </section>
  )
}

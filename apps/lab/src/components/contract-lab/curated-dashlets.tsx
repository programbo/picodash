'use client'

import { useState } from 'react'
import {
  DashList,
  DisplayDashlet,
  NumberDashlet,
  SelectDashlet,
  SegmentedDashlet,
  Dashlet,
  DashListResetValuesItem,
  SliderDashlet,
  SwitchDashlet,
  TextDashlet,
} from '@picodash/dashlist'
import { ActivityPreview } from './activity-preview'
import { ActionMenu, Button } from '@picodash/ui'
import type { ValueBindingNexus } from './value-binding-model'

export function CuratedDashlets({
  nexus,
  disabled,
}: {
  readonly nexus: ValueBindingNexus
  readonly disabled: boolean
}) {
  const [readOnly, setReadOnly] = useState(false)
  return (
    <section
      aria-label="Dashlet candidates"
      className="mt-8 border-t border-(--picodash-color-border) pt-6"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Workspace tuning</h2>
        <Button
          size="sm"
          variant={readOnly ? 'primary' : 'outline'}
          aria-pressed={readOnly}
          onPress={() => setReadOnly(!readOnly)}
        >
          Read-only controls
        </Button>
      </div>
      <p className="mb-4 text-sm text-(--picodash-color-text-muted)">
        Tune the refresh interval, choose an activity source, and switch between summary and
        details. The preview uses sample records; your controls and choices are saved in this
        browser. Compare editable, read-only, and disabled states using the controls above.
      </p>
      <DashList
        nexus={nexus}
        id="binding-curated"
        title="Workspace tuning controls"
        headingLevel={3}
        reorderable={false}
      >
        <TextDashlet
          disabled={disabled}
          readOnly={readOnly}
          id="name"
          label="Workspace name"
          field={nexus.fields.name}
        />
        <NumberDashlet
          disabled={disabled}
          readOnly={readOnly}
          id="interval"
          label="Exact interval"
          description="1–60 seconds"
          field={nexus.fields.interval}
        />
        <SliderDashlet
          disabled={disabled}
          readOnly={readOnly}
          id="cadence"
          label="Quick adjustment"
          description="One-second steps"
          field={nexus.fields.interval}
          min={1}
          max={60}
          step={1}
          formatOptions={{ style: 'unit', unit: 'second', unitDisplay: 'short' }}
        />
        <SwitchDashlet
          disabled={disabled}
          readOnly={readOnly}
          id="enabled"
          label="Live updates"
          field={nexus.fields.enabled}
        />
        <SelectDashlet
          id="source"
          label="Activity source"
          field={nexus.fields.activitySource}
          options={['Builds', 'Deployments', 'Checks']}
          disabled={disabled}
          readOnly={readOnly}
        />
        <SegmentedDashlet
          id="detail"
          label="Detail level"
          field={nexus.fields.detail}
          options={['Summary', 'Details']}
          disabled={disabled}
          readOnly={readOnly}
        />
        <DisplayDashlet
          id="current"
          label="Current interval"
          field={nexus.fields.interval}
          formatValue={(value) => `${value} seconds`}
        />
        <Dashlet id="actions" label="Workspace actions">
          <ActionMenu label="Workspace actions">
            <DashListResetValuesItem />
          </ActionMenu>
        </Dashlet>
      </DashList>
      <ActivityPreview nexus={nexus} />
    </section>
  )
}

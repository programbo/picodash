'use client'

import { useState } from 'react'
import {
  DashList,
  DisplayDashlet,
  NumberDashlet,
  SliderDashlet,
  SwitchDashlet,
  TextDashlet,
} from '@picodash/dashlist'
import { Button } from '@picodash/ui'
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
        Tune the refresh interval with the slider or enter an exact value. These five Dashlets share
        the workspace values above. Compare the themes, disabled state, and read-only state before
        we expand the set.
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
          formatValue={(value) => `${value} seconds`}
        />
        <SwitchDashlet
          disabled={disabled}
          readOnly={readOnly}
          id="enabled"
          label="Live updates"
          field={nexus.fields.enabled}
        />
        <DisplayDashlet
          id="current"
          label="Current interval"
          field={nexus.fields.interval}
          formatValue={(value) => `${value} seconds`}
        />
      </DashList>
    </section>
  )
}

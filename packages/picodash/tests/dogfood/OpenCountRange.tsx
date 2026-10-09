'use client'
import { createPicodashNexus, type PicodashIssueInput } from '@picodash/nexus'
import { DashStack, Dashlet, type SingleFieldDashletRenderContext } from '@picodash/dashstack'
import { Checkbox, RangeSlider, type NumberRangeValue } from '@picodash/dashstack/ui'

export type CountWindow = { min: number; max: number | null }
const defaultWindow: CountWindow = { min: 3, max: null }
// Example domain minimum, not a general planetary-gear law.
const countFloor = 2
export function isCountWindow(value: unknown): value is CountWindow {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  if (!('min' in value) || !('max' in value) || Object.keys(value).length !== 2) return false
  return (
    typeof value.min === 'number' &&
    Number.isSafeInteger(value.min) &&
    value.min >= countFloor &&
    (value.max === null ||
      (typeof value.max === 'number' && Number.isSafeInteger(value.max) && value.max >= value.min))
  )
}
export function createOpenCountNexus() {
  return createPicodashNexus({
    valueOwner: 'nexus',
    fields: {
      counts: {
        defaultValue: defaultWindow,
        validate(value: unknown): readonly PicodashIssueInput[] {
          return isCountWindow(value)
            ? []
            : [{ message: 'Use ordered integer counts, or Any maximum.' }]
        },
      },
    },
  })
}
export type CountNexus = ReturnType<typeof createOpenCountNexus>

// feasibleMax is a solver-owned finite integer ceiling, or null when no candidate exists.
export function projectCountWindow(requested: CountWindow, feasibleMax: number | null) {
  const end = requested.max ?? Math.max(requested.min, feasibleMax ?? requested.min)
  return {
    value: { start: requested.min, end },
    // Preserve an explicit request beyond current feasibility, and keep it editable.
    scaleMax: Math.max(countFloor + 1, end, feasibleMax ?? countFloor),
  }
}
export function applyCountDrag(
  requested: CountWindow,
  feasibleMax: number | null,
  next: NumberRangeValue,
): CountWindow {
  const previousEnd = projectCountWindow(requested, feasibleMax).value.end
  return {
    min: next.start,
    // A start-only edit preserves Any. Moving End explicitly chooses a finite bound.
    max: requested.max === null && next.end === previousEnd ? null : next.end,
  }
}

export function OpenCountRangeRecipe({
  nexus,
  feasibleMax,
  achieved,
}: {
  nexus: CountNexus
  feasibleMax: number | null
  achieved: number | null
}) {
  return (
    <DashStack id="count-example" nexus={nexus}>
      <Dashlet id="counts" label="Planet count" field={nexus.fields.counts} layout="block">
        {(context: SingleFieldDashletRenderContext<CountWindow>) => {
          const { binding } = context
          const requested = isCountWindow(binding.draftValue) ? binding.draftValue : binding.value
          const projection = projectCountWindow(requested, feasibleMax)
          const readoutId = `${binding.controlId}-meaning`
          return (
            <>
              <RangeSlider
                id={binding.controlId}
                aria-labelledby={context.labelId}
                aria-describedby={[readoutId, binding.issuesId].filter(Boolean).join(' ')}
                aria-invalid={binding.invalid || undefined}
                aria-errormessage={binding.issuesId}
                disabled={context.disabled}
                readOnly={context.readOnly}
                min={countFloor}
                max={projection.scaleMax}
                step={1}
                value={projection.value}
                onChange={(next) => binding.setInput(applyCountDrag(requested, feasibleMax, next))}
              />
              <Checkbox
                aria-label="Any maximum"
                aria-describedby={readoutId}
                disabled={context.disabled}
                readOnly={context.readOnly}
                isSelected={requested.max === null}
                onChange={(any) =>
                  binding.setInput({ min: requested.min, max: any ? null : projection.value.end })
                }
              />
              <p id={readoutId}>
                Requested {requested.min}–{requested.max ?? 'Any'}. Current feasible ceiling:{' '}
                {feasibleMax ?? 'none'}.
                {requested.max === null
                  ? ` Any is shown at ${projection.value.end} on this finite track.`
                  : ''}
              </p>
              <output aria-label="Achieved planet count">
                {achieved ?? 'No feasible solution'}
              </output>
            </>
          )
        }}
      </Dashlet>
    </DashStack>
  )
}

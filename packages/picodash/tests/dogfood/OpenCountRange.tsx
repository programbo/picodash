'use client'
import { createPicodashNexus, type PicodashIssueInput } from '@picodash/nexus'
import { DashStack, Dashlet, type SingleFieldDashletRenderContext } from '@picodash/dashstack'
import { RangeSlider, type NumberRangeValue } from '@picodash/dashstack/ui'

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
  const scaleMax = Math.max(
    countFloor + 1,
    requested.min,
    requested.max ?? countFloor,
    feasibleMax ?? countFloor,
  )
  const sentinel = scaleMax + 1
  if (!Number.isSafeInteger(sentinel))
    throw new RangeError('Count range needs room for a finite presentation sentinel.')
  return {
    value: { start: requested.min, end: requested.max ?? sentinel },
    scaleMax,
    endDetent: { value: sentinel, label: 'Any' },
  }
}
export function applyCountDrag(
  requested: CountWindow,
  feasibleMax: number | null,
  next: NumberRangeValue,
): CountWindow {
  const { endDetent } = projectCountWindow(requested, feasibleMax)
  return { min: next.start, max: next.end === endDetent.value ? null : next.end }
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
                endDetent={projection.endDetent}
                formatValue={(value) =>
                  `${value.start}–${value.end === projection.endDetent.value ? 'Any' : value.end}`
                }
                result={
                  achieved === null
                    ? { status: 'no-fit', message: 'No feasible solution' }
                    : { status: 'ready', value: achieved }
                }
                value={projection.value}
                createGesture={(options) => {
                  const gesture = binding.createValueGesture(options)
                  return {
                    get active() {
                      return gesture.active
                    },
                    begin: () => gesture.begin(),
                    update: (next) => gesture.update(applyCountDrag(requested, feasibleMax, next)),
                    commit: () => gesture.commit(),
                    cancel: (reason) => gesture.cancel(reason),
                    release: () => gesture.release(),
                  }
                }}
                onChange={(next) => binding.setInput(applyCountDrag(requested, feasibleMax, next))}
              />
              <p id={readoutId}>
                Requested {requested.min}–{requested.max ?? 'Any'}. Current feasible ceiling:{' '}
                {feasibleMax ?? 'none'}.
              </p>
            </>
          )
        }}
      </Dashlet>
    </DashStack>
  )
}

'use client'
import { createPicodashNexus, type PicodashIssueInput } from '@picodash/nexus'
import { DashStack, Dashlet, type SingleFieldDashletRenderContext } from '@picodash/dashstack'
import { NumberField } from '@picodash/dashstack/ui'

export function createNumericTarget() {
  return createPicodashNexus({
    valueOwner: 'nexus',
    fields: {
      module: {
        defaultValue: 1.5,
        validate(value: unknown): readonly PicodashIssueInput[] {
          if (typeof value !== 'number' || !Number.isFinite(value))
            return [{ message: 'Enter a module.' }]
          return value >= 0.6 && value <= 3
            ? []
            : [{ message: 'Module must be between 0.6 and 3 mm.' }]
        },
      },
    },
  })
}
export type NumericTarget = ReturnType<typeof createNumericTarget>
const millimetres: Intl.NumberFormatOptions = {
  style: 'unit',
  unit: 'millimeter',
  maximumFractionDigits: 2,
}

// Example selection rule only. Use your pure solver's result in the real application.
const achievedModule = (accepted: number) => Math.round(accepted * 4) / 4

export function ModuleTarget({
  id,
  nexus,
  disabled = false,
  readOnly = false,
}: {
  id: string
  nexus: NumericTarget
  disabled?: boolean
  readOnly?: boolean
}) {
  return (
    <Dashlet
      id={id}
      label="Module"
      description="Target tooth size in millimetres."
      field={nexus.fields.module}
      disabled={disabled}
      readOnly={readOnly}
    >
      {(context: SingleFieldDashletRenderContext<number>) => {
        const { binding } = context
        const readoutId = `${binding.controlId}-achieved`
        const value =
          binding.draftValue === null
            ? Number.NaN // Empty control presentation only; never send NaN to Nexus.
            : typeof binding.draftValue === 'number'
              ? binding.draftValue
              : binding.value
        return (
          <div>
            <NumberField
              id={binding.controlId}
              aria-labelledby={context.labelId}
              aria-describedby={[context.descriptionId, binding.issuesId, readoutId]
                .filter(Boolean)
                .join(' ')}
              aria-invalid={binding.invalid || undefined}
              aria-errormessage={binding.issuesId}
              disabled={context.disabled}
              readOnly={context.readOnly}
              value={value}
              step={0.01}
              formatOptions={millimetres}
              onChange={(candidate) => binding.setInput(candidate)}
            />
            <small id={readoutId}>
              Accepted {binding.value} mm · Achieved {achievedModule(binding.value)} mm
            </small>
          </div>
        )
      }}
    </Dashlet>
  )
}

export function NumericTargetRecipe({
  nexus,
  disabled,
  readOnly,
}: {
  nexus: NumericTarget
  disabled?: boolean
  readOnly?: boolean
}) {
  return (
    <DashStack id="numeric-targets" nexus={nexus}>
      <ModuleTarget id="module-target" nexus={nexus} disabled={disabled} readOnly={readOnly} />
    </DashStack>
  )
}

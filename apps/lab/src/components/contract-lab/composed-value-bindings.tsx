import { Dashlet, type SingleFieldDashletRenderContext } from '@picodash/dashlist'
import { Display, NumberField, Switch, TextField } from '@picodash/dashlist/ui'
import type { ValueBindingNexus } from './value-binding-model'

export function renderComposedValueBindings({
  nexus,
  disabled,
}: {
  readonly nexus: ValueBindingNexus
  readonly disabled: boolean
}) {
  return (
    <>
      <Dashlet id="name" label="Workspace name" field={nexus.fields.name} disabled={disabled}>
        {({ binding, labelId, disabled }: SingleFieldDashletRenderContext<string>) => (
          <TextField
            id={binding.controlId}
            aria-labelledby={labelId}
            aria-invalid={binding.invalid || undefined}
            aria-errormessage={binding.issuesId}
            aria-describedby={binding.issuesId}
            disabled={disabled}
            value={typeof binding.draftValue === 'string' ? binding.draftValue : binding.value}
            onChange={(value) => binding.setInput(value)}
          />
        )}
      </Dashlet>
      <Dashlet
        id="interval"
        label="Refresh interval"
        description="1–60 seconds"
        field={nexus.fields.interval}
        disabled={disabled}
      >
        {({
          binding,
          labelId,
          descriptionId,
          disabled,
        }: SingleFieldDashletRenderContext<number>) => (
          <NumberField
            id={binding.controlId}
            aria-labelledby={labelId}
            aria-describedby={[descriptionId, binding.issuesId].filter(Boolean).join(' ')}
            aria-invalid={binding.invalid || undefined}
            aria-errormessage={binding.issuesId}
            disabled={disabled}
            value={typeof binding.draftValue === 'number' ? binding.draftValue : binding.value}
            onChange={(value) => {
              if (value !== null) binding.setInput(value)
            }}
          />
        )}
      </Dashlet>
      <Dashlet id="enabled" label="Live updates" field={nexus.fields.enabled} disabled={disabled}>
        {({ binding, labelId, disabled }: SingleFieldDashletRenderContext<boolean>) => (
          <Switch
            id={binding.controlId}
            aria-labelledby={labelId}
            aria-invalid={binding.invalid || undefined}
            aria-errormessage={binding.issuesId}
            disabled={disabled}
            isSelected={binding.value}
            onChange={(value) => binding.setInput(value)}
          />
        )}
      </Dashlet>
      <Dashlet id="readout" label="Current interval" field={nexus.fields.interval} mode="display">
        {({ binding, labelId }: SingleFieldDashletRenderContext<number, 'display'>) => (
          <Display
            id={binding.controlId}
            aria-labelledby={labelId}
            value={`${binding.value} seconds`}
          />
        )}
      </Dashlet>
    </>
  )
}

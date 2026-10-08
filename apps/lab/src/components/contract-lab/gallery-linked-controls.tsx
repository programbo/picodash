import {
  Dashlet,
  useDashStackOrder,
  type DashletRenderContext,
  type SingleFieldDashletRenderContext,
} from '@picodash/dashstack'
import {
  DateField,
  DateRangeField,
  DateTimeField,
  TimeField,
  Slider,
  RangeSlider,
  Meter,
  ProgressBar,
} from '@picodash/dashstack/ui'
import {
  changeDate,
  changeDateRange,
  changeNumericRange,
  changeNumericSlider,
  numericPriority,
  changeTime,
  dateTimeBounds,
  galleryTimeZone,
  isTemporalState,
  numericReadouts,
  temporalParts,
  type GalleryNexus,
  type NumericState,
  type TemporalState,
} from './gallery-model'

export type GallerySampleProps = {
  readonly id: string
  readonly label: string
  readonly layout: 'inline' | 'block'
  readonly disabled?: boolean
  readonly readOnly?: boolean
  readonly description?: string
}
type Sample = GallerySampleProps & { readonly nexus: GalleryNexus }

type AccessibleContext = DashletRenderContext & {
  readonly binding: {
    readonly controlId: string
    readonly invalid: boolean
    readonly issuesId?: string
  }
}
function controlProps(context: AccessibleContext) {
  return {
    id: context.binding.controlId,
    'aria-labelledby': context.labelId,
    'aria-describedby':
      [context.descriptionId, context.binding.issuesId].filter(Boolean).join(' ') || undefined,
    'aria-invalid': context.binding.invalid || undefined,
    'aria-errormessage': context.binding.issuesId,
    disabled: context.disabled,
    readOnly: context.readOnly,
  }
}

export function LinkedSlider({ nexus, marks, ...props }: Sample & { readonly marks?: boolean }) {
  const priority = numericPriority(useDashStackOrder('root'))
  return (
    <Dashlet {...props} field={nexus.fields.numeric}>
      {(context: SingleFieldDashletRenderContext<NumericState>) => {
        const { slider, range } = context.binding.value
        return (
          <>
            <Slider
              {...controlProps(context)}
              value={slider}
              min={0}
              max={100}
              fillOrigin={0}
              allowedRange={priority === 'range' ? { min: range.start, max: range.end } : undefined}
              marks={
                marks ? [0, 50, 100].map((value) => ({ value, label: `${value}%` })) : undefined
              }
              onChange={(slider) =>
                context.binding.setInput(
                  changeNumericSlider(context.binding.value, slider, priority),
                )
              }
            />
            <output data-picodash-dashstack-slider-value>{slider}%</output>
          </>
        )
      }}
    </Dashlet>
  )
}

export function LinkedRange({ nexus, ...props }: Sample) {
  const priority = numericPriority(useDashStackOrder('root'))
  return (
    <Dashlet {...props} field={nexus.fields.numeric}>
      {(context: SingleFieldDashletRenderContext<NumericState>) => (
        <>
          <RangeSlider
            {...controlProps(context)}
            value={context.binding.value.range}
            min={0}
            max={100}
            onChange={(range) =>
              context.binding.setInput(changeNumericRange(context.binding.value, range, priority))
            }
          />
          <output data-picodash-dashstack-range-value>
            {context.binding.value.range.start}–{context.binding.value.range.end}
          </output>
        </>
      )}
    </Dashlet>
  )
}

export function ComputedReadout({
  nexus,
  kind,
  ...props
}: Sample & { readonly kind: 'meter' | 'progress' }) {
  return (
    <Dashlet
      {...props}
      field={nexus.fields.numeric}
      mode="display"
      help={
        kind === 'meter'
          ? 'Width of the selected range within 0–100.'
          : 'Slider position within the selected range. A zero-width range shows 0%.'
      }
    >
      {(context: SingleFieldDashletRenderContext<NumericState, 'display'>) => {
        const result = numericReadouts(context.binding.value)
        const Control = kind === 'meter' ? Meter : ProgressBar
        return (
          <Control
            {...controlProps(context)}
            value={kind === 'meter' ? result.span : result.progress}
            min={0}
            max={100}
            formatValue={(value) => `${Math.round(value)}%`}
          />
        )
      }}
    </Dashlet>
  )
}

export function LinkedTemporal({
  nexus,
  kind,
  seconds,
  hideTimeZone,
  ...props
}: Sample & {
  readonly kind: 'date' | 'time' | 'dateTime' | 'range'
  readonly seconds?: boolean
  readonly hideTimeZone?: boolean
}) {
  return (
    <Dashlet {...props} field={nexus.fields.temporal}>
      {(context: SingleFieldDashletRenderContext<TemporalState>) => {
        const { binding } = context
        const value = isTemporalState(binding.draftValue) ? binding.draftValue : binding.value
        const parts = temporalParts(value)
        const common = { ...controlProps(context), locale: 'en-AU' }
        switch (kind) {
          case 'date':
            return (
              <DateField
                {...common}
                value={parts.date}
                min={value.range?.start}
                max={value.range?.end}
                onChange={(date) => binding.setInput(changeDate(value, date))}
              />
            )
          case 'time':
            return (
              <TimeField
                {...common}
                value={parts.time}
                hourCycle={seconds ? 12 : 24}
                granularity={seconds ? 'second' : 'minute'}
                onChange={(time) => binding.setInput(changeTime(value, time))}
              />
            )
          case 'dateTime':
            return (
              <DateTimeField
                {...common}
                value={value.dateTime}
                {...dateTimeBounds(value.range)}
                timeZone={galleryTimeZone}
                hourCycle={24}
                hideTimeZone={hideTimeZone}
                onChange={(dateTime) => binding.setInput({ ...value, dateTime })}
              />
            )
          case 'range':
            return (
              <DateRangeField
                {...common}
                value={value.range}
                onChange={(range) => binding.setInput(changeDateRange(value, range))}
              />
            )
        }
      }}
    </Dashlet>
  )
}

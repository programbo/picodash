import { ToggleGroup } from 'radix-ui'
import type { ReactNode } from 'react'
import {
  TweakerControl,
  useResolvedPanelProp,
  type ReactiveProp,
  type TweakerControlProps,
} from '../tweaker-control.js'
import { cn } from '../utils.js'

export type TweakerSegmentedOption =
  | string
  | {
      disabled?: boolean
      label?: ReactNode
      value: string
    }

export interface TweakerSegmentedProps extends Omit<
  TweakerControlProps<string>,
  'children' | 'defaultValue'
> {
  defaultValue?: string
  options: ReactiveProp<TweakerSegmentedOption[]>
}

export function TweakerSegmented({
  defaultValue,
  options: optionsProp,
  ...controlProps
}: TweakerSegmentedProps) {
  const options = useResolvedPanelProp(optionsProp, []) ?? []
  const normalizedDefaultValue = normalizeSegmentedValue(defaultValue, options)

  return (
    <TweakerControl<string> {...controlProps} defaultValue={normalizedDefaultValue}>
      {(control) => {
        const value = normalizeSegmentedValue(control.value, options, normalizedDefaultValue) ?? ''

        return (
          <ToggleGroup.Root
            id={control.inputId}
            aria-label="Options"
            className="border-input bg-muted/35 col-span-2 inline-flex min-w-0 justify-self-end overflow-hidden rounded-md border p-0.5 shadow-sm"
            disabled={control.disabled || control.readOnly}
            type="single"
            value={value}
            onValueChange={(nextValue) => {
              // Radix reports an empty string when the selected item is pressed again.
              // A segmented control always has one selection, so retain the current value.
              if (nextValue) control.setValue(nextValue)
            }}
          >
            {options.map((option, index) => {
              const optionValue = segmentedOptionValue(option)
              const optionLabel = segmentedOptionLabel(option)

              return (
                <ToggleGroup.Item
                  key={`${optionValue}:${index}`}
                  id={`${control.inputId}:option-${index}`}
                  aria-label={typeof optionLabel === 'string' ? optionLabel : optionValue}
                  className={cn(
                    'inline-flex h-6 min-w-7 items-center justify-center border-l border-input px-2 text-[11px] leading-none font-medium text-muted-foreground outline-none transition-colors first:border-l-0 hover:bg-accent hover:text-accent-foreground focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring data-[state=on]:bg-primary data-[state=on]:text-primary-foreground disabled:pointer-events-none disabled:opacity-45',
                  )}
                  disabled={segmentedOptionDisabled(option)}
                  title={typeof optionLabel === 'string' ? optionLabel : undefined}
                  value={optionValue}
                >
                  {optionLabel}
                </ToggleGroup.Item>
              )
            })}
          </ToggleGroup.Root>
        )
      }}
    </TweakerControl>
  )
}

export function normalizeSegmentedValue(
  value: string | undefined,
  options: readonly TweakerSegmentedOption[],
  fallback?: string,
) {
  if (
    value !== undefined &&
    options.some(
      (option) => segmentedOptionValue(option) === value && !segmentedOptionDisabled(option),
    )
  ) {
    return value
  }
  if (
    fallback !== undefined &&
    options.some(
      (option) => segmentedOptionValue(option) === fallback && !segmentedOptionDisabled(option),
    )
  ) {
    return fallback
  }
  const firstEnabled = options.find((option) => !segmentedOptionDisabled(option))
  const firstOption = firstEnabled ?? options[0]
  return firstOption === undefined ? undefined : segmentedOptionValue(firstOption)
}

export function segmentedOptionValue(option: TweakerSegmentedOption) {
  return typeof option === 'string' ? option : option.value
}

export function segmentedOptionLabel(option: TweakerSegmentedOption) {
  return typeof option === 'string' ? option : (option.label ?? option.value)
}

export function segmentedOptionDisabled(option: TweakerSegmentedOption) {
  return typeof option === 'string' ? false : (option.disabled ?? false)
}

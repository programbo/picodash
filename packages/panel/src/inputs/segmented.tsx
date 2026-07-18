import { ToggleGroup } from 'radix-ui'
import { useMemo, type ReactNode } from 'react'
import {
  TweakerItem,
  useResolvedPanelProp,
  type ReactiveProp,
  type TweakerInputItemProps,
} from '../tweaker-control.js'
import type { TweakerParser } from '../tweaker-validation.js'
import { cn } from '../utils.js'
import { canonicalTweakerValue, invalidTweakerValue } from './built-in-validation.js'

export type TweakerSegmentedOption =
  | string
  | {
      disabled?: boolean
      icon?: ReactNode
      label?: ReactNode
      value: string
    }

export interface TweakerSegmentedProps extends Omit<
  TweakerInputItemProps<string>,
  'children' | 'defaultValue' | 'parse'
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
  const enabledValuesKey = JSON.stringify(segmentedEnabledOptionValues(options))
  const enabledValues = useMemo(() => JSON.parse(enabledValuesKey) as string[], [enabledValuesKey])
  const parse = useMemo<TweakerParser<string>>(
    () => (input, context) => {
      if (typeof input === 'string' && enabledValues.includes(input)) {
        return { output: { value: input }, success: true }
      }
      const error =
        enabledValues.length === 0
          ? 'Segmented control has no enabled options.'
          : 'Segmented value must match one of its enabled options.'
      if (context.source === 'import' || enabledValues.length === 0) {
        return invalidTweakerValue(error)
      }
      return canonicalTweakerValue(input, normalizedDefaultValue ?? enabledValues[0]!, error)
    },
    [enabledValues, normalizedDefaultValue],
  )

  return (
    <TweakerItem<string> {...controlProps} defaultValue={normalizedDefaultValue} parse={parse}>
      {(control) => {
        const value = normalizeSegmentedValue(control.value, options, normalizedDefaultValue) ?? ''

        return (
          <>
            <ToggleGroup.Root
              id={control.inputId}
              aria-label="Options"
              className="border-tweaker-control shadow-tweaker-sm rounded-tweaker-control col-span-2 inline-flex min-w-0 justify-self-start overflow-hidden border bg-(--_tweaker-choice-background) p-(--tweaker-space-0-5)"
              disabled={control.disabled || control.readOnly}
              type="single"
              value={value}
              onValueChange={(nextValue) => {
                // Radix reports an empty string when the selected item is pressed again.
                // A segmented control always has one selection, so retain the current value.
                if (nextValue) control.setInput(nextValue)
              }}
            >
              {options.map((option, index) => {
                const optionValue = segmentedOptionValue(option)
                const optionLabel = segmentedOptionLabel(option)
                const optionIcon = segmentedOptionIcon(option)

                return (
                  <ToggleGroup.Item
                    key={`${optionValue}:${index}`}
                    id={`${control.inputId}:option-${index}`}
                    aria-label={typeof optionLabel === 'string' ? optionLabel : optionValue}
                    className={cn(
                      'inline-flex h-(--tweaker-control-height-xs) min-w-(--tweaker-control-height-sm) items-center justify-center gap-(--tweaker-space-1) border-l border-tweaker-control px-(--tweaker-space-2) text-(length:--tweaker-font-size-md) leading-(--tweaker-line-none) font-(--tweaker-font-medium) text-tweaker-muted outline-none transition-colors duration-(--tweaker-duration-fast) first:border-l-0 hover:bg-tweaker-surface-muted hover:text-tweaker-text focus-visible:relative focus-visible:z-(--tweaker-layer-raised) focus-visible:ring-2 focus-visible:ring-tweaker-focus data-[state=on]:bg-tweaker-accent data-[state=on]:text-tweaker-accent-text disabled:pointer-events-none disabled:opacity-(--tweaker-opacity-disabled-soft)',
                    )}
                    disabled={segmentedOptionDisabled(option)}
                    title={typeof optionLabel === 'string' ? optionLabel : undefined}
                    value={optionValue}
                  >
                    {optionIcon ? (
                      <span
                        aria-hidden="true"
                        className="inline-flex size-(--tweaker-icon-sm) shrink-0 items-center justify-center [&>svg]:size-(--tweaker-icon-sm)"
                      >
                        {optionIcon}
                      </span>
                    ) : null}
                    <span>{optionLabel}</span>
                  </ToggleGroup.Item>
                )
              })}
            </ToggleGroup.Root>
          </>
        )
      }}
    </TweakerItem>
  )
}

export function normalizeSegmentedValue(
  value: unknown,
  options: readonly TweakerSegmentedOption[],
  fallback?: string,
) {
  if (
    typeof value === 'string' &&
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
  return firstEnabled === undefined ? undefined : segmentedOptionValue(firstEnabled)
}

export function segmentedOptionValue(option: TweakerSegmentedOption) {
  return typeof option === 'string' ? option : option.value
}

export function segmentedOptionLabel(option: TweakerSegmentedOption) {
  return typeof option === 'string' ? option : (option.label ?? option.value)
}

export function segmentedOptionIcon(option: TweakerSegmentedOption) {
  return typeof option === 'string' ? undefined : option.icon
}

export function segmentedOptionDisabled(option: TweakerSegmentedOption) {
  return typeof option === 'string' ? false : (option.disabled ?? false)
}

export function segmentedEnabledOptionValues(options: readonly TweakerSegmentedOption[]) {
  return options
    .filter((option) => !segmentedOptionDisabled(option))
    .map((option) => segmentedOptionValue(option))
}

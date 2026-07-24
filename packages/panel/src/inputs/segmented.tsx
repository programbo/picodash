import { useMemo, type ReactNode } from 'react'
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group.js'
import {
  PicodashItem,
  useResolvedPanelProp,
  type ReactiveProp,
  type PicodashInputItemProps,
} from '../picodash-control.js'
import type { PicodashParser } from '../picodash-validation.js'
import { cn } from '../utils.js'
import { canonicalPicodashValue, invalidPicodashValue } from './built-in-validation.js'

export type PicodashSegmentedOption =
  | string
  | {
      disabled?: boolean
      icon?: ReactNode
      label?: ReactNode
      value: string
    }

export interface PicodashSegmentedProps extends Omit<
  PicodashInputItemProps<string>,
  'children' | 'defaultValue' | 'parse'
> {
  defaultValue?: string
  options: ReactiveProp<PicodashSegmentedOption[]>
}

export function PicodashSegmented({
  defaultValue,
  options: optionsProp,
  ...controlProps
}: PicodashSegmentedProps) {
  const options = useResolvedPanelProp(optionsProp, []) ?? []
  const normalizedDefaultValue = normalizeSegmentedValue(defaultValue, options)
  const enabledValuesKey = JSON.stringify(segmentedEnabledOptionValues(options))
  const enabledValues = useMemo(() => JSON.parse(enabledValuesKey) as string[], [enabledValuesKey])
  const parse = useMemo<PicodashParser<string>>(
    () => (input, context) => {
      if (typeof input === 'string' && enabledValues.includes(input)) {
        return { output: { value: input }, success: true }
      }
      const error =
        enabledValues.length === 0
          ? 'Segmented control has no enabled options.'
          : 'Segmented value must match one of its enabled options.'
      if (context.source === 'import' || enabledValues.length === 0) {
        return invalidPicodashValue(error)
      }
      return canonicalPicodashValue(input, normalizedDefaultValue ?? enabledValues[0]!, error)
    },
    [enabledValues, normalizedDefaultValue],
  )

  return (
    <PicodashItem<string> {...controlProps} defaultValue={normalizedDefaultValue} parse={parse}>
      {(control) => {
        const value = normalizeSegmentedValue(control.value, options, normalizedDefaultValue) ?? ''

        return (
          <>
            <ToggleGroup
              aria-label="Options"
              className="border-picodash-control shadow-picodash-sm rounded-picodash-control col-span-2 inline-flex min-w-0 justify-self-start overflow-hidden border bg-(--_picodash-choice-background) p-(--picodash-space-0-5)"
              disallowEmptySelection
              isDisabled={control.disabled || control.readOnly}
              selectedKeys={value ? [value] : []}
              selectionMode="single"
              spacing={0}
              onSelectionChange={(nextKeys) => {
                const nextValue = nextKeys.values().next().value
                if (typeof nextValue === 'string') control.setInput(nextValue)
              }}
            >
              {options.map((option, index) => {
                const optionValue = segmentedOptionValue(option)
                const optionLabel = segmentedOptionLabel(option)
                const optionIcon = segmentedOptionIcon(option)

                return (
                  <ToggleGroupItem
                    key={`${optionValue}:${index}`}
                    id={optionValue}
                    aria-label={typeof optionLabel === 'string' ? optionLabel : optionValue}
                    className={cn(
                      'border-picodash-control text-picodash-muted data-hovered:bg-picodash-surface-muted data-hovered:text-picodash-text data-focus-visible:ring-picodash-focus data-selected:bg-picodash-accent data-selected:text-picodash-accent-text inline-flex h-(--picodash-control-height-xs) min-w-(--picodash-control-height-sm) items-center justify-center gap-(--picodash-space-1) border-l px-(--picodash-space-2) text-(length:--picodash-font-size-md) leading-(--picodash-line-none) font-(--picodash-font-medium) transition-colors duration-(--picodash-duration-fast) outline-none first:border-l-0 data-disabled:pointer-events-none data-disabled:opacity-(--picodash-opacity-disabled-soft) data-focus-visible:relative data-focus-visible:z-(--picodash-layer-raised) data-focus-visible:ring-2',
                    )}
                    isDisabled={segmentedOptionDisabled(option)}
                  >
                    {optionIcon ? (
                      <span
                        aria-hidden="true"
                        className="inline-flex size-(--picodash-icon-sm) shrink-0 items-center justify-center [&>svg]:size-(--picodash-icon-sm)"
                      >
                        {optionIcon}
                      </span>
                    ) : null}
                    <span>{optionLabel}</span>
                  </ToggleGroupItem>
                )
              })}
            </ToggleGroup>
          </>
        )
      }}
    </PicodashItem>
  )
}

export function normalizeSegmentedValue(
  value: unknown,
  options: readonly PicodashSegmentedOption[],
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

export function segmentedOptionValue(option: PicodashSegmentedOption) {
  return typeof option === 'string' ? option : option.value
}

export function segmentedOptionLabel(option: PicodashSegmentedOption) {
  return typeof option === 'string' ? option : (option.label ?? option.value)
}

export function segmentedOptionIcon(option: PicodashSegmentedOption) {
  return typeof option === 'string' ? undefined : option.icon
}

export function segmentedOptionDisabled(option: PicodashSegmentedOption) {
  return typeof option === 'string' ? false : (option.disabled ?? false)
}

export function segmentedEnabledOptionValues(options: readonly PicodashSegmentedOption[]) {
  return options
    .filter((option) => !segmentedOptionDisabled(option))
    .map((option) => segmentedOptionValue(option))
}

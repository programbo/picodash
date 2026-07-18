import { ToggleGroup } from 'radix-ui'
import { useEffect, useMemo, type ReactNode } from 'react'
import {
  TweakerControl,
  TweakerImportAllowedStringValuesProvider,
  useResolvedPanelProp,
  type ReactiveProp,
  type TweakerControlContextValue,
  type TweakerControlProps,
} from '../tweaker-control.js'
import { synchronizeTweakerFieldValue } from '../tweaker-control-value.js'
import { useTweakerPanelStoreApi } from '../tweaker-panel.js'
import { cn } from '../utils.js'
import { selectOptionValues } from './select.js'

export type TweakerSegmentedOption =
  | string
  | {
      disabled?: boolean
      icon?: ReactNode
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
  const importAllowedValuesKey = JSON.stringify(selectOptionValues(options))
  const importAllowedValues = useMemo(
    () => JSON.parse(importAllowedValuesKey) as string[],
    [importAllowedValuesKey],
  )

  return (
    <TweakerImportAllowedStringValuesProvider values={importAllowedValues}>
      <TweakerControl<string> {...controlProps} defaultValue={normalizedDefaultValue}>
        {(control) => {
          const value =
            normalizeSegmentedValue(control.value, options, normalizedDefaultValue) ?? ''

          return (
            <>
              <TweakerSegmentedValueSynchronizer
                control={control}
                fallback={normalizedDefaultValue}
                options={options}
              />
              <ToggleGroup.Root
                id={control.inputId}
                aria-label="Options"
                className="border-tweaker-control shadow-tweaker-sm col-span-2 inline-flex min-w-0 justify-self-start overflow-hidden rounded-(--tweaker-segmented-radius) border bg-(--tweaker-segmented-background) p-(--tweaker-space-0-5)"
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
                  const optionIcon = segmentedOptionIcon(option)

                  return (
                    <ToggleGroup.Item
                      key={`${optionValue}:${index}`}
                      id={`${control.inputId}:option-${index}`}
                      aria-label={typeof optionLabel === 'string' ? optionLabel : optionValue}
                      className={cn(
                        'inline-flex h-(--tweaker-segmented-item-height) min-w-(--tweaker-segmented-item-min-width) items-center justify-center gap-(--tweaker-space-1) border-l border-tweaker-control px-(--tweaker-space-2) text-(length:--tweaker-font-size-md) leading-none font-(--tweaker-font-medium) text-tweaker-muted outline-none transition-colors duration-(--tweaker-duration-fast) first:border-l-0 hover:bg-tweaker-surface-muted hover:text-tweaker-text focus-visible:relative focus-visible:z-(--tweaker-layer-raised) focus-visible:ring-2 focus-visible:ring-tweaker-focus data-[state=on]:bg-tweaker-accent data-[state=on]:text-tweaker-accent-text disabled:pointer-events-none disabled:opacity-(--tweaker-opacity-disabled-soft)',
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
      </TweakerControl>
    </TweakerImportAllowedStringValuesProvider>
  )
}

function TweakerSegmentedValueSynchronizer({
  control,
  fallback,
  options,
}: {
  control: TweakerControlContextValue<string>
  fallback?: string
  options: readonly TweakerSegmentedOption[]
}) {
  const store = useTweakerPanelStoreApi()

  useEffect(() => {
    synchronizeTweakerFieldValue(
      control,
      (currentValue) => normalizeSegmentedValue(currentValue, options, fallback),
      (currentValue, normalizedValue) => currentValue === normalizedValue,
      store,
    )
  }, [control, fallback, options, store])

  return null
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

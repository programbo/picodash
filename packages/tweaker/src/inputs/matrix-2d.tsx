import { useMemo, type ComponentPropsWithoutRef, type KeyboardEvent, type ReactNode } from 'react'
import {
  TweakerItem,
  useResolvedPanelProp,
  type ReactiveProp,
  type TweakerInputItemProps,
} from '../tweaker-control.js'
import type { TweakerValue } from '../tweaker-panel.js'
import type { TweakerParser } from '../tweaker-validation.js'
import { jsonCompatibilityError, jsonValuesEqual } from '../tweaker-validation.js'
import { cn } from '../utils.js'
import { canonicalTweakerValue, invalidTweakerValue } from './built-in-validation.js'

export type TweakerMatrix2DDirection = 'down' | 'left' | 'right' | 'up'
export type TweakerMatrix2DSelectionRole = 'radio' | 'toggle'

export interface TweakerMatrix2DPosition {
  column: number
  row: number
}

export type TweakerMatrix2DDataAttributes = {
  [TKey in `data-${string}`]?: boolean | number | string | undefined
}

export type TweakerMatrix2DContainerProps = Omit<ComponentPropsWithoutRef<'div'>, 'children'> &
  TweakerMatrix2DDataAttributes

export type TweakerMatrix2DOption<TValue extends TweakerValue> = Omit<
  ComponentPropsWithoutRef<'button'>,
  'children' | 'type' | 'value'
> &
  TweakerMatrix2DDataAttributes & {
    children: ReactNode
    value: TValue
  }

export interface TweakerMatrix2DProps<TValue extends TweakerValue> extends Omit<
  TweakerInputItemProps<TValue>,
  'children' | 'defaultValue' | 'parse'
> {
  containerProps?: TweakerMatrix2DContainerProps
  defaultValue?: TValue
  options: ReactiveProp<readonly (readonly TweakerMatrix2DOption<TValue>[])[]>
  selectionRole?: TweakerMatrix2DSelectionRole
  validationMessage?: string
}

export function TweakerMatrix2D<TValue extends TweakerValue>({
  containerProps,
  defaultValue,
  options: optionsProp,
  selectionRole = 'toggle',
  validationMessage = 'Matrix value must match one of its enabled options.',
  ...controlProps
}: TweakerMatrix2DProps<TValue>) {
  const options =
    useResolvedPanelProp<readonly (readonly TweakerMatrix2DOption<TValue>[])[]>(optionsProp, []) ??
    []
  const normalizedDefault = normalizeMatrix2DValue(defaultValue, options)
  const parse = useMemo<TweakerParser<TValue>>(
    () => (input, context) => {
      const position = findMatrix2DValuePosition(input, options)
      if (position) {
        const optionValue = options[position.row]?.[position.column]?.value
        if (optionValue !== undefined) {
          return canonicalTweakerValue(input, optionValue, validationMessage)
        }
      }

      const error = enabledMatrix2DOptions(options).length
        ? validationMessage
        : 'Matrix has no enabled options.'
      if (context.source === 'import' || normalizedDefault === undefined) {
        return invalidTweakerValue(error)
      }
      return canonicalTweakerValue(input, normalizedDefault, error)
    },
    [normalizedDefault, options, validationMessage],
  )

  return (
    <TweakerItem<TValue> {...controlProps} defaultValue={normalizedDefault} parse={parse}>
      {(control) => {
        const value = normalizeMatrix2DValue(control.value, options, normalizedDefault)
        const selectedPosition = findMatrix2DValuePosition(value, options)
        const tabbablePosition =
          selectedPosition ?? findFirstEnabledMatrix2DPosition(options) ?? undefined
        const {
          className: containerClassName,
          onKeyDown: onContainerKeyDown,
          style: containerStyle,
          ...resolvedContainerProps
        } = containerProps ?? {}
        const columnCount = Math.max(0, ...options.map((row) => row.length))

        return (
          <div
            {...resolvedContainerProps}
            id={control.inputId}
            aria-label={resolvedContainerProps['aria-label'] ?? 'Options'}
            className={cn('col-span-2 grid min-w-0 justify-self-start', containerClassName)}
            role={
              resolvedContainerProps.role ?? (selectionRole === 'radio' ? 'radiogroup' : 'group')
            }
            style={{
              gridTemplateColumns: `repeat(${Math.max(1, columnCount)}, minmax(0, 1fr))`,
              ...containerStyle,
            }}
            onKeyDown={onContainerKeyDown}
          >
            {options.flatMap((row, rowIndex) =>
              row.map((option, columnIndex) => {
                const {
                  children,
                  className,
                  disabled: optionDisabled,
                  onClick,
                  onKeyDown,
                  style,
                  value: optionValue,
                  ...optionProps
                } = option
                const disabled = control.disabled || control.readOnly || optionDisabled
                const selected = value !== undefined && matrix2DValuesEqual(value, optionValue)
                const position = { column: columnIndex, row: rowIndex }

                return (
                  <button
                    {...optionProps}
                    key={`${rowIndex}:${columnIndex}`}
                    id={optionProps.id ?? `${control.inputId}:option-${rowIndex}-${columnIndex}`}
                    aria-checked={
                      selectionRole === 'radio' ? selected : optionProps['aria-checked']
                    }
                    aria-pressed={selectionRole === 'toggle' ? selected : undefined}
                    className={cn(
                      'outline-none focus-visible:z-(--tweaker-layer-raised) focus-visible:ring-2 focus-visible:ring-tweaker-focus disabled:pointer-events-none disabled:opacity-(--tweaker-opacity-disabled-soft)',
                      className,
                    )}
                    data-column={columnIndex}
                    data-row={rowIndex}
                    data-state={selected ? 'on' : 'off'}
                    disabled={disabled}
                    role={selectionRole === 'radio' ? 'radio' : optionProps.role}
                    style={{
                      gridColumn: columnIndex + 1,
                      gridRow: rowIndex + 1,
                      ...style,
                    }}
                    tabIndex={
                      tabbablePosition?.row === rowIndex && tabbablePosition.column === columnIndex
                        ? 0
                        : -1
                    }
                    type="button"
                    onClick={(event) => {
                      onClick?.(event)
                      if (!event.defaultPrevented) control.setInput(optionValue)
                    }}
                    onKeyDown={(event) => {
                      onKeyDown?.(event)
                      if (!event.defaultPrevented) {
                        const next = moveMatrix2DFocus(event, options, position)
                        const nextValue =
                          next === undefined ? undefined : options[next.row]?.[next.column]?.value
                        if (selectionRole === 'radio' && nextValue !== undefined) {
                          control.setInput(nextValue)
                        }
                      }
                    }}
                  >
                    {children}
                  </button>
                )
              }),
            )}
          </div>
        )
      }}
    </TweakerItem>
  )
}

export function enabledMatrix2DOptions<TValue extends TweakerValue>(
  options: readonly (readonly TweakerMatrix2DOption<TValue>[])[],
) {
  return options.flat().filter((option) => !option.disabled)
}

export function normalizeMatrix2DValue<TValue extends TweakerValue>(
  value: unknown,
  options: readonly (readonly TweakerMatrix2DOption<TValue>[])[],
  fallback?: TValue,
): TValue | undefined {
  const enabledOptions = enabledMatrix2DOptions(options)
  const matchingOption = enabledOptions.find((option) => matrix2DValuesEqual(value, option.value))
  if (matchingOption) return matchingOption.value

  const fallbackOption = enabledOptions.find((option) =>
    matrix2DValuesEqual(fallback, option.value),
  )
  return fallbackOption?.value ?? enabledOptions[0]?.value
}

export function findMatrix2DValuePosition<TValue extends TweakerValue>(
  value: unknown,
  options: readonly (readonly TweakerMatrix2DOption<TValue>[])[],
): TweakerMatrix2DPosition | undefined {
  for (const [rowIndex, row] of options.entries()) {
    const columnIndex = row.findIndex(
      (option) => !option.disabled && matrix2DValuesEqual(value, option.value),
    )
    if (columnIndex >= 0) return { column: columnIndex, row: rowIndex }
  }
  return undefined
}

export function findFirstEnabledMatrix2DPosition<TValue extends TweakerValue>(
  options: readonly (readonly TweakerMatrix2DOption<TValue>[])[],
): TweakerMatrix2DPosition | undefined {
  for (const [rowIndex, row] of options.entries()) {
    const columnIndex = row.findIndex((option) => !option.disabled)
    if (columnIndex >= 0) return { column: columnIndex, row: rowIndex }
  }
  return undefined
}

export function findNextMatrix2DPosition<TValue extends TweakerValue>(
  options: readonly (readonly TweakerMatrix2DOption<TValue>[])[],
  current: TweakerMatrix2DPosition,
  direction: TweakerMatrix2DDirection,
): TweakerMatrix2DPosition | undefined {
  if (direction === 'left' || direction === 'right') {
    const row = options[current.row] ?? []
    const delta = direction === 'left' ? -1 : 1
    for (let column = current.column + delta; column >= 0 && column < row.length; column += delta) {
      if (!row[column]?.disabled) return { column, row: current.row }
    }
    return undefined
  }

  const delta = direction === 'up' ? -1 : 1
  for (let row = current.row + delta; row >= 0 && row < options.length; row += delta) {
    const candidates = (options[row] ?? [])
      .map((option, column) => ({ column, option }))
      .filter(({ option }) => !option.disabled)
      .sort(
        (left, right) =>
          Math.abs(left.column - current.column) - Math.abs(right.column - current.column),
      )
    if (candidates[0]) return { column: candidates[0].column, row }
  }
  return undefined
}

function moveMatrix2DFocus<TValue extends TweakerValue>(
  event: KeyboardEvent<HTMLButtonElement>,
  options: readonly (readonly TweakerMatrix2DOption<TValue>[])[],
  current: TweakerMatrix2DPosition,
) {
  const direction = matrix2DDirectionForKey(event.key)
  if (!direction) return

  const next = findNextMatrix2DPosition(options, current, direction)
  if (!next) return

  const selector = `[data-row="${next.row}"][data-column="${next.column}"]`
  const nextButton = event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(selector)
  if (!nextButton) return

  event.preventDefault()
  nextButton.focus()
  return next
}

function matrix2DDirectionForKey(key: string): TweakerMatrix2DDirection | undefined {
  if (key === 'ArrowDown') return 'down'
  if (key === 'ArrowLeft') return 'left'
  if (key === 'ArrowRight') return 'right'
  if (key === 'ArrowUp') return 'up'
  return undefined
}

function matrix2DValuesEqual(left: unknown, right: TweakerValue) {
  return (
    jsonCompatibilityError(left) === undefined &&
    jsonValuesEqual({ value: left as TweakerValue }, { value: right })
  )
}

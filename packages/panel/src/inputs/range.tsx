import { useMemo } from 'react'
import { Slider, SliderThumb, SliderTrack } from '../components/ui/slider.js'
import { formatNumericValue } from '../lib/formatting/number-format.js'
import {
  PicodashItem,
  useResolvedPanelProp,
  type ReactiveProp,
  type PicodashInputItemProps,
} from '../components/panel/PicodashItem.js'
import { picodashGeometryTokens } from '../lib/theme/theme.js'
import type { PicodashParser } from '../validation/picodash-validation.js'
import { canonicalPicodashValue, strictImportShape } from './internal/built-in-validation.js'

export type PicodashRangeValue = [low: number, high: number]

export interface PicodashRangeProps extends Omit<
  PicodashInputItemProps<PicodashRangeValue>,
  'children' | 'defaultValue' | 'parse'
> {
  defaultValue?: PicodashRangeValue
  formatOptions?: ReactiveProp<Intl.NumberFormatOptions>
  max?: ReactiveProp<number>
  min?: ReactiveProp<number>
  step?: ReactiveProp<number>
}

export interface PicodashRangeNormalizationOptions {
  fallback?: PicodashRangeValue
  max?: number
  min?: number
  step?: number
}

export interface PicodashRangeFillGeometry {
  highPercent: number
  insetInlineEnd: string
  insetInlineStart: string
  lowPercent: number
  midpointPercent: number
}

export function PicodashRange({
  defaultValue,
  formatOptions: formatOptionsProp,
  max: maxProp,
  min: minProp,
  step: stepProp,
  ...controlProps
}: PicodashRangeProps) {
  const minPropValue = useResolvedPanelProp(minProp, 0)
  const maxPropValue = useResolvedPanelProp(maxProp, 100)
  const stepPropValue = useResolvedPanelProp(stepProp, 1)
  const formatOptions = useResolvedPanelProp(formatOptionsProp)
  const { min, max, step } = normalizeRangeBounds(minPropValue, maxPropValue, stepPropValue)
  const normalizedDefaultValue = useMemo(
    () =>
      normalizeRangeValue(defaultValue, {
        fallback: [min, max],
        max,
        min,
        step,
      }),
    [defaultValue, max, min, step],
  )
  const [defaultLow, defaultHigh] = normalizedDefaultValue
  const parse = useMemo<PicodashParser<PicodashRangeValue>>(
    () => (input, context) => {
      const error = 'Range value must be a canonical two-number tuple within its bounds.'
      const shapeError = strictImportShape(context, Array.isArray(input), error)
      if (shapeError) return shapeError
      const value = normalizeRangeValue(input, {
        fallback: [defaultLow, defaultHigh],
        max,
        min,
        step,
      })
      return canonicalPicodashValue(input, value, error)
    },
    [defaultHigh, defaultLow, max, min, step],
  )

  return (
    <PicodashItem<PicodashRangeValue>
      {...controlProps}
      defaultValue={normalizedDefaultValue}
      parse={parse}
    >
      {(control) => {
        const value = normalizeRangeValue(control.value, {
          fallback: normalizedDefaultValue,
          max,
          min,
          step,
        })
        const formattedLow = formatNumericValue(value[0], { formatOptions, step })
        const formattedHigh = formatNumericValue(value[1], { formatOptions, step })
        const fillGeometry = projectPicodashRangeFill(value, min, max)

        return (
          <div className="col-span-2 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-(--picodash-space-2)">
            <Slider<PicodashRangeValue>
              id={control.inputId}
              aria-label="Range"
              className="relative flex h-(--picodash-control-height-xs) min-w-0 touch-none items-center select-none data-disabled:opacity-(--picodash-opacity-disabled) data-[disabled]:cursor-not-allowed"
              isDisabled={control.disabled || control.readOnly || min === max}
              maxValue={max}
              minValue={min}
              step={step}
              value={value}
              onChange={(nextValue) => {
                control.setInput(
                  normalizeRangeValue(nextValue, {
                    fallback: value,
                    max,
                    min,
                    step,
                  }),
                )
              }}
            >
              <SliderTrack className="relative h-(--picodash-control-height-xs) grow">
                <div className="bg-picodash-control absolute inset-x-0 top-1/2 h-(--_picodash-slider-track-height) -translate-y-1/2 overflow-hidden rounded-full">
                  <span
                    aria-hidden="true"
                    className="bg-picodash-accent absolute h-full"
                    style={{
                      insetInlineEnd: fillGeometry.insetInlineEnd,
                      insetInlineStart: fillGeometry.insetInlineStart,
                    }}
                  />
                </div>
                <SliderThumb
                  id={`${control.inputId}:low`}
                  aria-label="Lower value"
                  aria-valuetext={formattedLow}
                  index={0}
                  className="before:shadow-picodash-sm data-focus-visible:before:ring-picodash-focus data-focus-visible:before:ring-offset-picodash-canvas before:border-picodash-accent absolute top-1/2 block size-0 outline-none before:absolute before:top-1/2 before:left-1/2 before:size-(--_picodash-slider-thumb-size) before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:border before:bg-(--_picodash-slider-thumb) before:transition-[box-shadow,scale] before:duration-(--picodash-duration-fast) before:content-[''] data-disabled:pointer-events-none data-focus-visible:before:ring-2 data-focus-visible:before:ring-offset-1 data-hovered:before:scale-110"
                />
                <SliderThumb
                  id={`${control.inputId}:high`}
                  aria-label="Upper value"
                  aria-valuetext={formattedHigh}
                  index={1}
                  className="before:shadow-picodash-sm data-focus-visible:before:ring-picodash-focus data-focus-visible:before:ring-offset-picodash-canvas before:border-picodash-accent absolute top-1/2 block size-0 outline-none before:absolute before:top-1/2 before:left-1/2 before:size-(--_picodash-slider-thumb-size) before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:border before:bg-(--_picodash-slider-thumb) before:transition-[box-shadow,scale] before:duration-(--picodash-duration-fast) before:content-[''] data-disabled:pointer-events-none data-focus-visible:before:ring-2 data-focus-visible:before:ring-offset-1 data-hovered:before:scale-110"
                />
              </SliderTrack>
            </Slider>
            <output
              aria-live="off"
              className="text-picodash-text min-w-[9ch] justify-self-end text-right text-(length:--picodash-font-size-md) leading-(--picodash-line-none) tabular-nums"
            >
              {formattedLow}–{formattedHigh}
            </output>
          </div>
        )
      }}
    </PicodashItem>
  )
}

export function projectPicodashRangeFill(
  value: PicodashRangeValue,
  min = 0,
  max = 100,
): PicodashRangeFillGeometry {
  const bounds = normalizeRangeBounds(min, max, 1)
  const span = bounds.max - bounds.min
  const first = clampRangeProjectionValue(value[0], bounds.min, bounds.max, bounds.min)
  const second = clampRangeProjectionValue(value[1], bounds.min, bounds.max, bounds.max)
  const low = Math.min(first, second)
  const high = Math.max(first, second)
  const lowPercent = span === 0 ? 0 : ((low - bounds.min) / span) * 100
  const highPercent = span === 0 ? 0 : ((high - bounds.min) / span) * 100
  const midpointPercent = (lowPercent + highPercent) / 2

  return {
    highPercent,
    insetInlineEnd: rangeFillInset(100 - highPercent, 100 - midpointPercent),
    insetInlineStart: rangeFillInset(lowPercent, midpointPercent),
    lowPercent,
    midpointPercent,
  }
}

export function normalizeRangeValue(
  value: unknown,
  { fallback, max = 100, min = 0, step = 1 }: PicodashRangeNormalizationOptions = {},
): PicodashRangeValue {
  const bounds = normalizeRangeBounds(min, max, step)
  const safeFallback = fallback ?? [bounds.min, bounds.max]
  const candidate = Array.isArray(value) && value.length >= 2 ? value : safeFallback
  const low = normalizeRangeNumber(candidate[0], safeFallback[0], bounds)
  const high = normalizeRangeNumber(candidate[1], safeFallback[1], bounds)
  return low <= high ? [low, high] : [high, low]
}

function clampRangeProjectionValue(value: number, min: number, max: number, fallback: number) {
  const finiteValue = Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, finiteValue))
}

function rangeFillInset(edgePercent: number, midpointPercent: number) {
  return `min(calc(${formatRangePercent(edgePercent)}% + ${picodashGeometryTokens.rangeThumbRadius}px), ${formatRangePercent(midpointPercent)}%)`
}

function formatRangePercent(value: number) {
  return Number(value.toFixed(6))
}

export function normalizeRangeBounds(min?: number, max?: number, step?: number) {
  const finiteMin = typeof min === 'number' && Number.isFinite(min) ? min : 0
  const finiteMax = typeof max === 'number' && Number.isFinite(max) ? max : 100
  const normalizedStep = typeof step === 'number' && Number.isFinite(step) && step > 0 ? step : 1

  return finiteMin <= finiteMax
    ? { max: finiteMax, min: finiteMin, step: normalizedStep }
    : { max: finiteMin, min: finiteMax, step: normalizedStep }
}

function normalizeRangeNumber(
  value: unknown,
  fallback: unknown,
  bounds: ReturnType<typeof normalizeRangeBounds>,
) {
  const finiteFallback =
    typeof fallback === 'number' && Number.isFinite(fallback) ? fallback : bounds.min
  const finiteValue = typeof value === 'number' && Number.isFinite(value) ? value : finiteFallback
  const clamped = Math.min(bounds.max, Math.max(bounds.min, finiteValue))
  const snapped = bounds.min + Math.round((clamped - bounds.min) / bounds.step) * bounds.step
  const precision = Math.min(12, decimalPlaces(bounds.step))
  return Math.min(bounds.max, Math.max(bounds.min, Number(snapped.toFixed(precision))))
}

function decimalPlaces(value: number) {
  const text = value.toString().toLowerCase()
  const [coefficient = '', exponentText] = text.split('e')
  const exponent = exponentText === undefined ? 0 : Number(exponentText)
  return Math.max(0, (coefficient.split('.')[1]?.length ?? 0) - exponent)
}

import { Slider } from 'radix-ui'
import { useMemo } from 'react'
import { formatNumericValue } from '../number-format.js'
import {
  TweakerControl,
  useResolvedPanelProp,
  type ReactiveProp,
  type TweakerControlProps,
} from '../tweaker-control.js'

export type TweakerRangeValue = [low: number, high: number]

export interface TweakerRangeProps extends Omit<
  TweakerControlProps<TweakerRangeValue>,
  'children' | 'defaultValue'
> {
  defaultValue?: TweakerRangeValue
  formatOptions?: ReactiveProp<Intl.NumberFormatOptions>
  max?: ReactiveProp<number>
  min?: ReactiveProp<number>
  step?: ReactiveProp<number>
}

export interface TweakerRangeNormalizationOptions {
  fallback?: TweakerRangeValue
  max?: number
  min?: number
  step?: number
}

export interface TweakerRangeFillGeometry {
  highPercent: number
  insetInlineEnd: string
  insetInlineStart: string
  lowPercent: number
  midpointPercent: number
}

const rangeThumbRadius = 7

export function TweakerRange({
  defaultValue,
  formatOptions: formatOptionsProp,
  max: maxProp,
  min: minProp,
  step: stepProp,
  ...controlProps
}: TweakerRangeProps) {
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

  return (
    <TweakerControl<TweakerRangeValue> {...controlProps} defaultValue={normalizedDefaultValue}>
      {(control) => {
        const value = normalizeRangeValue(control.value, {
          fallback: normalizedDefaultValue,
          max,
          min,
          step,
        })
        const formattedLow = formatNumericValue(value[0], { formatOptions, step })
        const formattedHigh = formatNumericValue(value[1], { formatOptions, step })
        const fillGeometry = projectTweakerRangeFill(value, min, max)

        return (
          <div className="col-span-2 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <Slider.Root
              id={control.inputId}
              aria-label="Range"
              className="relative flex h-6 min-w-0 touch-none items-center select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
              disabled={control.disabled || control.readOnly || min === max}
              max={max}
              min={min}
              minStepsBetweenThumbs={0}
              step={step}
              value={value}
              onValueChange={(nextValue) => {
                control.setValue(
                  normalizeRangeValue(nextValue, {
                    fallback: value,
                    max,
                    min,
                    step,
                  }),
                )
              }}
            >
              <Slider.Track className="bg-input relative h-1 grow overflow-hidden rounded-full">
                <span
                  aria-hidden="true"
                  className="bg-primary absolute h-full"
                  style={{
                    insetInlineEnd: fillGeometry.insetInlineEnd,
                    insetInlineStart: fillGeometry.insetInlineStart,
                  }}
                />
              </Slider.Track>
              <Slider.Thumb
                id={`${control.inputId}:low`}
                aria-label="Lower value"
                aria-valuetext={formattedLow}
                className="focus-visible:before:ring-ring focus-visible:before:ring-offset-background before:border-primary before:bg-primary/60 relative block size-0 outline-none before:absolute before:top-1/2 before:left-1/2 before:size-3.5 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:border before:shadow before:transition-[box-shadow,scale] before:content-[''] hover:before:scale-110 focus-visible:before:ring-2 focus-visible:before:ring-offset-1 disabled:pointer-events-none"
              />
              <Slider.Thumb
                id={`${control.inputId}:high`}
                aria-label="Upper value"
                aria-valuetext={formattedHigh}
                className="focus-visible:before:ring-ring focus-visible:before:ring-offset-background before:border-primary before:bg-primary/60 relative block size-0 outline-none before:absolute before:top-1/2 before:left-1/2 before:size-3.5 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:border before:shadow before:transition-[box-shadow,scale] before:content-[''] hover:before:scale-110 focus-visible:before:ring-2 focus-visible:before:ring-offset-1 disabled:pointer-events-none"
              />
            </Slider.Root>
            <output
              aria-live="off"
              className="text-foreground min-w-[9ch] justify-self-end text-right text-[11px] leading-none tabular-nums"
            >
              {formattedLow}–{formattedHigh}
            </output>
          </div>
        )
      }}
    </TweakerControl>
  )
}

export function projectTweakerRangeFill(
  value: TweakerRangeValue,
  min = 0,
  max = 100,
): TweakerRangeFillGeometry {
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
  { fallback, max = 100, min = 0, step = 1 }: TweakerRangeNormalizationOptions = {},
): TweakerRangeValue {
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
  return `min(calc(${formatRangePercent(edgePercent)}% + ${rangeThumbRadius}px), ${formatRangePercent(midpointPercent)}%)`
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

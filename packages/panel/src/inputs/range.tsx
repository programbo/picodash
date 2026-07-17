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
                <Slider.Range className="bg-primary absolute h-full" />
              </Slider.Track>
              <Slider.Thumb
                id={`${control.inputId}:low`}
                aria-label="Lower value"
                aria-valuetext={formattedLow}
                className="border-primary bg-background focus-visible:ring-ring focus-visible:ring-offset-background block size-3.5 rounded-full border shadow transition-[box-shadow,transform] outline-none hover:scale-110 focus-visible:ring-2 focus-visible:ring-offset-1 disabled:pointer-events-none"
              />
              <Slider.Thumb
                id={`${control.inputId}:high`}
                aria-label="Upper value"
                aria-valuetext={formattedHigh}
                className="border-primary bg-background focus-visible:ring-ring focus-visible:ring-offset-background block size-3.5 rounded-full border shadow transition-[box-shadow,transform] outline-none hover:scale-110 focus-visible:ring-2 focus-visible:ring-offset-1 disabled:pointer-events-none"
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

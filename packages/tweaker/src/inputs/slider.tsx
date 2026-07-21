import { useMemo, type ReactNode } from 'react'
import { Slider, SliderThumb, SliderTrack } from '../components/ui/slider.js'
import {
  TweakerItem,
  useResolvedPanelProp,
  type ReactiveProp,
  type TweakerInputItemProps,
} from '../tweaker-control.js'
import type { TweakerPanelState } from '../tweaker-panel.js'
import { formatNumericValue } from '../number-format.js'
import type { TweakerParser } from '../tweaker-validation.js'
import { canonicalTweakerValue, invalidTweakerValue } from './built-in-validation.js'

export type TweakerSliderMark =
  | number
  | {
      label?: ReactNode
      value: number
    }

export type TweakerSliderMarks = boolean | number | TweakerSliderMark[]

export interface TweakerSliderProps extends Omit<
  TweakerInputItemProps<number>,
  'children' | 'defaultValue' | 'parse'
> {
  defaultValue?: number
  formatOptions?: ReactiveProp<Intl.NumberFormatOptions>
  formatValue?: (value: number, state: TweakerPanelState) => ReactNode
  marks?: ReactiveProp<TweakerSliderMarks>
  max?: ReactiveProp<number>
  min?: ReactiveProp<number>
  step?: ReactiveProp<number>
}

export function TweakerSlider({
  defaultValue,
  formatOptions: formatOptionsProp,
  formatValue,
  marks: marksProp,
  max: maxProp,
  min: minProp,
  step: stepProp,
  ...controlProps
}: TweakerSliderProps) {
  const rawMin = useResolvedPanelProp(minProp, 0) ?? 0
  const rawMax = useResolvedPanelProp(maxProp, 100) ?? 100
  const rawStep = useResolvedPanelProp(stepProp, 1) ?? 1
  const { min, max, step } = normalizeSliderBounds(rawMin, rawMax, rawStep)
  const normalizedDefault = normalizeSliderValue(defaultValue ?? min, min, max, step)
  const formatOptions = useResolvedPanelProp(formatOptionsProp)
  const marks = marksFromProp(useResolvedPanelProp(marksProp, []), min, max)
  const formattedValue = useResolvedPanelProp((state) => {
    const raw = controlProps.field === undefined ? defaultValue : state.values[controlProps.field]
    const value =
      typeof raw === 'number' ? normalizeSliderValue(raw, min, max, step) : normalizedDefault
    return formatValue?.(value, state) ?? formatNumericValue(value, { formatOptions, step })
  })
  const parse = useMemo<TweakerParser<number>>(
    () => (input, context) => {
      const error = 'Slider value must be a finite number aligned to its bounds and step.'
      if (typeof input !== 'number' || !Number.isFinite(input)) {
        return context.source === 'import'
          ? invalidTweakerValue(error)
          : { errors: [error], repair: { value: normalizedDefault }, success: false }
      }
      return canonicalTweakerValue(input, normalizeSliderValue(input, min, max, step), error)
    },
    [max, min, normalizedDefault, step],
  )

  return (
    <TweakerItem<number> {...controlProps} defaultValue={normalizedDefault} parse={parse}>
      {(control) => {
        const value =
          typeof control.value === 'number'
            ? normalizeSliderValue(control.value, min, max, step)
            : normalizedDefault

        return (
          <Slider<number>
            aria-labelledby={`${control.id}:label`}
            className="col-span-2 grid min-w-0 grid-cols-subgrid items-center"
            isDisabled={control.disabled || control.readOnly}
            maxValue={max}
            minValue={min}
            step={step}
            value={value}
            onChange={control.setInput}
          >
            <SliderTrack className="relative col-start-1 h-(--tweaker-icon-md) min-w-0">
              <div
                aria-hidden="true"
                className="bg-tweaker-control absolute inset-x-0 top-1/2 h-(--_tweaker-slider-track-height) -translate-y-1/2 overflow-hidden rounded-full"
              >
                {marks.map((mark, index) => {
                  const value = markValue(mark)
                  const position = markPosition(value, min, max)

                  return (
                    <span
                      key={`${value}:${index}`}
                      className={`bg-tweaker-text absolute inset-y-0 w-(--tweaker-border-thin) ${markTranslateClass(position)}`}
                      style={{ left: `${position}%` }}
                    />
                  )
                })}
              </div>
              <SliderThumb
                id={control.inputId}
                index={0}
                className="before:shadow-tweaker-sm data-focus-visible:before:ring-tweaker-focus data-focus-visible:before:ring-offset-tweaker-canvas before:border-tweaker-accent absolute top-1/2 z-(--tweaker-layer-raised) block size-0 cursor-pointer outline-none before:absolute before:top-1/2 before:left-1/2 before:size-(--_tweaker-slider-thumb-size) before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:border before:bg-(--_tweaker-slider-thumb) before:transition-[box-shadow,scale] before:duration-(--tweaker-duration-fast) before:content-[''] data-disabled:cursor-not-allowed data-focus-visible:before:ring-2 data-focus-visible:before:ring-offset-1 data-hovered:before:scale-110"
              />
              {marks.length > 0 ? (
                <div className="text-tweaker-muted pointer-events-none absolute inset-x-0 top-4 h-(--tweaker-space-3) text-(length:--tweaker-font-size-sm) leading-(--tweaker-line-none)">
                  {marks.map((mark, index) => {
                    const value = markValue(mark)
                    const label =
                      typeof mark === 'number'
                        ? formatNumericValue(mark, { formatOptions, step })
                        : (mark.label ?? value)
                    const position = markPosition(value, min, max)

                    return (
                      <span
                        key={`${value}:${index}`}
                        className={`absolute top-0 whitespace-nowrap ${markTranslateClass(position)}`}
                        style={{ left: `${position}%` }}
                      >
                        {label}
                      </span>
                    )
                  })}
                </div>
              ) : null}
            </SliderTrack>
            <output className="text-tweaker-text col-start-2 ml-(--tweaker-space-2) min-w-[4.5ch] justify-self-end text-right text-(length:--tweaker-font-size-lg) leading-(--tweaker-line-none) font-(--tweaker-font-normal) tabular-nums">
              {formattedValue}
            </output>
          </Slider>
        )
      }}
    </TweakerItem>
  )
}

function normalizeSliderBounds(min: number, max: number, step: number) {
  const finiteMin = Number.isFinite(min) ? min : 0
  const finiteMax = Number.isFinite(max) ? max : 100
  return {
    max: Math.max(finiteMin, finiteMax),
    min: Math.min(finiteMin, finiteMax),
    step: Number.isFinite(step) && step > 0 ? step : 1,
  }
}

function normalizeSliderValue(value: number, min: number, max: number, step: number) {
  const clamped = Math.min(max, Math.max(min, value))
  const snapped = min + Math.round((clamped - min) / step) * step
  return Math.min(max, Math.max(min, Number(snapped.toFixed(Math.min(12, decimalPlaces(step))))))
}

function decimalPlaces(value: number) {
  const text = value.toString().toLowerCase()
  const [coefficient = '', exponentText] = text.split('e')
  const exponent = exponentText === undefined ? 0 : Number(exponentText)
  return Math.max(0, (coefficient.split('.')[1]?.length ?? 0) - exponent)
}

function marksFromProp(
  marks: TweakerSliderMarks | undefined,
  min: number,
  max: number,
): TweakerSliderMark[] {
  if (marks === undefined || marks === false) return []
  if (marks === true) return [min, max]
  if (Array.isArray(marks)) return marks.toSorted(compareMarks)

  const additionalMarks = Math.max(0, Math.floor(marks))
  const intervals = additionalMarks + 1
  return Array.from({ length: additionalMarks + 2 }, (_, index) => {
    if (index === 0) return min
    if (index === additionalMarks + 1) return max
    return min + ((max - min) * index) / intervals
  })
}

function compareMarks(left: TweakerSliderMark, right: TweakerSliderMark) {
  return markValue(left) - markValue(right)
}

function markValue(mark: TweakerSliderMark) {
  return typeof mark === 'number' ? mark : mark.value
}

function markPosition(value: number, min: number, max: number) {
  if (max === min) return 0
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
}

function markTranslateClass(position: number) {
  if (position <= 0) return 'translate-x-0'
  if (position >= 100) return '-translate-x-full'
  return '-translate-x-1/2'
}

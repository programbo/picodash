import type { ReactNode } from 'react'
import {
  TweakerControl,
  useResolvedPanelProp,
  type ReactiveProp,
  type TweakerControlProps,
} from '../tweaker-control.js'
import type { TweakerPanelState } from '../tweaker-panel.js'
import { formatNumericValue } from '../number-format.js'

export type TweakerSliderMark =
  | number
  | {
      label?: ReactNode
      value: number
    }

export type TweakerSliderMarks = boolean | number | TweakerSliderMark[]

export interface TweakerSliderProps extends Omit<
  TweakerControlProps<number>,
  'children' | 'defaultValue'
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
  const min = useResolvedPanelProp(minProp, 0) ?? 0
  const max = useResolvedPanelProp(maxProp, 100) ?? 100
  const step = useResolvedPanelProp(stepProp, 1) ?? 1
  const formatOptions = useResolvedPanelProp(formatOptionsProp)
  const marks = marksFromProp(useResolvedPanelProp(marksProp, []), min, max)
  const formattedValue = useResolvedPanelProp((state) => {
    const raw = controlProps.field === undefined ? defaultValue : state.values[controlProps.field]
    const value = typeof raw === 'number' ? raw : (defaultValue ?? min)
    return formatValue?.(value, state) ?? formatNumericValue(value, { formatOptions, step })
  })

  return (
    <TweakerControl<number> {...controlProps} defaultValue={defaultValue ?? min}>
      {(control) => {
        const value = typeof control.value === 'number' ? control.value : (defaultValue ?? min)

        return (
          <div className="col-span-2 grid min-w-0 grid-cols-subgrid items-center">
            <div className="relative col-start-1 h-4 min-w-0">
              <div
                aria-hidden="true"
                className="bg-input absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full"
              >
                {marks.map((mark, index) => {
                  const value = markValue(mark)
                  const position = markPosition(value, min, max)

                  return (
                    <span
                      key={`${value}:${index}`}
                      className={`bg-foreground absolute inset-y-0 w-px ${markTranslateClass(position)}`}
                      style={{ left: `${position}%` }}
                    />
                  )
                })}
              </div>
              <input
                id={control.inputId}
                className="accent-primary [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-primary/60 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-primary/60 absolute top-1/2 -left-2 z-10 h-4 w-[calc(100%+1rem)] min-w-0 -translate-y-1/2 cursor-pointer appearance-none bg-transparent outline-none disabled:cursor-not-allowed disabled:opacity-50 [&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:transition-transform hover:[&::-moz-range-thumb]:scale-110 [&::-moz-range-track]:h-1 [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:-mt-1.25 [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-110"
                disabled={control.disabled || control.readOnly}
                max={max}
                min={min}
                step={step}
                type="range"
                value={value}
                onChange={(event) => control.setValue(event.currentTarget.valueAsNumber)}
              />
              {marks.length > 0 ? (
                <div className="text-muted-foreground pointer-events-none absolute inset-x-0 top-4.5 h-3 text-[10px] leading-none">
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
            </div>
            <output className="text-foreground col-start-2 ml-2 min-w-[5ch] justify-self-end text-right text-xs leading-none font-normal tabular-nums">
              {formattedValue}
            </output>
          </div>
        )
      }}
    </TweakerControl>
  )
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

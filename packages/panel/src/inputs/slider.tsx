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
          <div className="col-span-2 grid min-w-0 grid-cols-subgrid gap-y-1.5">
            <input
              id={control.inputId}
              className="bg-input accent-primary [&::-moz-range-thumb]:bg-primary [&::-webkit-slider-thumb]:bg-primary col-start-1 h-2 min-w-0 cursor-pointer appearance-none self-center rounded-full disabled:cursor-not-allowed disabled:opacity-50 [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full"
              disabled={control.disabled || control.readOnly}
              max={max}
              min={min}
              step={step}
              type="range"
              value={value}
              onChange={(event) => control.setValue(event.currentTarget.valueAsNumber)}
            />
            <output className="text-foreground col-start-2 min-w-max justify-self-end text-right text-xs tabular-nums">
              {formattedValue}
            </output>
            {marks.length > 0 ? (
              <div className="text-muted-foreground relative col-start-1 h-3 text-[10px] leading-none">
                {marks.map((mark, index) => {
                  const value = typeof mark === 'number' ? mark : mark.value
                  const label =
                    typeof mark === 'number'
                      ? formatNumericValue(mark, { formatOptions, step })
                      : (mark.label ?? value)
                  const position = markPosition(value, min, max)

                  return (
                    <span
                      key={`${value}:${index}`}
                      className={`absolute top-0 whitespace-nowrap ${markTranslateClass(position)}`}
                      style={{
                        left: `${position}%`,
                      }}
                    >
                      {label}
                    </span>
                  )
                })}
              </div>
            ) : null}
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

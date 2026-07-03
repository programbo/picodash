import type { ReactNode } from 'react'
import {
  TweakerControl,
  useResolvedPanelProp,
  type ReactiveProp,
  type TweakerControlProps,
} from '../tweaker-control.js'
import type { TweakerPanelState } from '../tweaker-panel.js'

export type TweakerSliderMark =
  | number
  | {
      label?: ReactNode
      value: number
    }

export interface TweakerSliderProps extends Omit<
  TweakerControlProps<number>,
  'children' | 'defaultValue'
> {
  defaultValue?: number
  formatValue?: (value: number, state: TweakerPanelState) => ReactNode
  marks?: ReactiveProp<TweakerSliderMark[]>
  max?: ReactiveProp<number>
  min?: ReactiveProp<number>
  step?: ReactiveProp<number>
}

export function TweakerSlider({
  defaultValue,
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
  const marks = useResolvedPanelProp(marksProp, [])
  const formattedValue = useResolvedPanelProp((state) => {
    const raw = controlProps.field === undefined ? defaultValue : state.values[controlProps.field]
    const value = typeof raw === 'number' ? raw : (defaultValue ?? min)
    return formatValue?.(value, state) ?? formatNumber(value)
  })

  return (
    <TweakerControl<number> {...controlProps} defaultValue={defaultValue ?? min}>
      {(control) => {
        const value = typeof control.value === 'number' ? control.value : (defaultValue ?? min)

        return (
          <div className="grid gap-1.5">
            <div className="flex items-center gap-2">
              <input
                id={control.inputId}
                className="bg-input accent-primary [&::-moz-range-thumb]:bg-primary [&::-webkit-slider-thumb]:bg-primary h-2 min-w-0 flex-1 cursor-pointer appearance-none rounded-full disabled:cursor-not-allowed disabled:opacity-50 [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full"
                disabled={control.disabled || control.readOnly}
                max={max}
                min={min}
                step={step}
                type="range"
                value={value}
                onChange={(event) => control.setValue(event.currentTarget.valueAsNumber)}
              />
              <output className="text-foreground min-w-10 text-right text-xs tabular-nums">
                {formattedValue}
              </output>
            </div>
            {marks && marks.length > 0 ? (
              <div className="text-muted-foreground flex justify-between text-[10px] leading-none">
                {marks.map((mark) => {
                  const value = typeof mark === 'number' ? mark : mark.value
                  const label =
                    typeof mark === 'number' ? formatNumber(mark) : (mark.label ?? value)

                  return <span key={value}>{label}</span>
                })}
              </div>
            ) : null}
          </div>
        )
      }}
    </TweakerControl>
  )
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: Math.abs(value) >= 10 ? 0 : 2,
  }).format(value)
}

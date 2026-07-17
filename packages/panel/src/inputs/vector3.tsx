import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import {
  TweakerControl,
  useResolvedPanelProp,
  type ReactiveProp,
  type TweakerControlContextValue,
  type TweakerControlProps,
} from '../tweaker-control.js'
import { Input } from '../ui.js'

export type TweakerVector3Value = {
  x: number
  y: number
  z: number
}

export interface TweakerVector3Props extends Omit<
  TweakerControlProps<TweakerVector3Value>,
  'children' | 'defaultValue'
> {
  defaultValue?: TweakerVector3Value
  max?: ReactiveProp<number>
  min?: ReactiveProp<number>
  step?: ReactiveProp<number>
}

const zeroVector: TweakerVector3Value = { x: 0, y: 0, z: 0 }
const axes = ['x', 'y', 'z'] as const

export function TweakerVector3({
  defaultValue = zeroVector,
  max: maxProp,
  min: minProp,
  step: stepProp,
  ...controlProps
}: TweakerVector3Props) {
  const min = useResolvedPanelProp(minProp)
  const max = useResolvedPanelProp(maxProp)
  const bounds = normalizeVectorBounds(min, max)
  const step = normalizeVectorStep(useResolvedPanelProp(stepProp, 1))
  const normalizedDefaultValue = useMemo(
    () => normalizeVector3Value(defaultValue, zeroVector, bounds.min, bounds.max),
    [bounds.max, bounds.min, defaultValue],
  )

  return (
    <TweakerControl<TweakerVector3Value> {...controlProps} defaultValue={normalizedDefaultValue}>
      {(control) => {
        const value = normalizeVector3Value(
          control.value,
          normalizedDefaultValue,
          bounds.min,
          bounds.max,
        )

        return (
          <div className="col-span-2 grid min-w-0 grid-cols-3 gap-1">
            {axes.map((axis) => (
              <VectorAxisInput
                key={axis}
                axis={axis}
                control={control}
                max={bounds.max}
                min={bounds.min}
                step={step}
                value={value}
                onValueChange={(nextAxisValue) => {
                  control.setValue(
                    normalizeVector3Value(
                      { ...value, [axis]: nextAxisValue },
                      value,
                      bounds.min,
                      bounds.max,
                    ),
                  )
                }}
              />
            ))}
          </div>
        )
      }}
    </TweakerControl>
  )
}

function VectorAxisInput({
  axis,
  control,
  max,
  min,
  onValueChange,
  step,
  value,
}: {
  axis: (typeof axes)[number]
  control: TweakerControlContextValue<TweakerVector3Value>
  max: number | undefined
  min: number | undefined
  onValueChange: (value: number) => void
  step: number
  value: TweakerVector3Value
}) {
  const axisValue = value[axis]
  const [draft, setDraft] = useState(String(axisValue))
  const [focused, setFocused] = useState(false)
  const inputId = `${control.inputId}:${axis}`

  useEffect(() => {
    if (!focused) setDraft(String(axisValue))
  }, [axisValue, focused])

  return (
    <label className="relative min-w-0" htmlFor={inputId}>
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-1.5 z-10 -translate-y-1/2 text-[9px] font-semibold uppercase">
        {axis}
      </span>
      <Input
        id={inputId}
        aria-label={`${axis.toUpperCase()} axis`}
        className="h-7 min-w-0 pr-1 pl-4 text-right tabular-nums"
        disabled={control.disabled}
        inputMode="decimal"
        max={max}
        min={min}
        readOnly={control.readOnly}
        step={step}
        type="number"
        value={focused ? draft : String(axisValue)}
        onBlur={() => {
          setFocused(false)
          setDraft(String(axisValue))
        }}
        onChange={(event) => {
          const nextDraft = event.currentTarget.value
          setDraft(nextDraft)
          const nextValue = Number(nextDraft)
          if (Number.isFinite(nextValue)) onValueChange(nextValue)
        }}
        onFocus={(event) => {
          setFocused(true)
          setDraft(String(axisValue))
          event.currentTarget.select()
        }}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
    </label>
  )
}

export function normalizeVector3Value(
  value: unknown,
  fallback: TweakerVector3Value = zeroVector,
  min?: number,
  max?: number,
): TweakerVector3Value {
  const bounds = normalizeVectorBounds(min, max)
  const candidate = isVector3Record(value) ? value : fallback

  return {
    x: normalizeVectorCoordinate(candidate.x, fallback.x, bounds.min, bounds.max),
    y: normalizeVectorCoordinate(candidate.y, fallback.y, bounds.min, bounds.max),
    z: normalizeVectorCoordinate(candidate.z, fallback.z, bounds.min, bounds.max),
  }
}

export function normalizeVectorBounds(min?: number, max?: number) {
  const finiteMin = finiteBound(min)
  const finiteMax = finiteBound(max)
  if (finiteMin !== undefined && finiteMax !== undefined && finiteMin > finiteMax) {
    return { max: finiteMin, min: finiteMax }
  }
  return { max: finiteMax, min: finiteMin }
}

export function normalizeVectorStep(step: number | undefined) {
  return typeof step === 'number' && Number.isFinite(step) && step > 0 ? step : 1
}

function isVector3Record(value: unknown): value is Partial<TweakerVector3Value> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeVectorCoordinate(
  value: unknown,
  fallback: unknown,
  min: number | undefined,
  max: number | undefined,
) {
  const finiteFallback = typeof fallback === 'number' && Number.isFinite(fallback) ? fallback : 0
  const finiteValue = typeof value === 'number' && Number.isFinite(value) ? value : finiteFallback
  return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, finiteValue))
}

function finiteBound(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

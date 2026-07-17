import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react'
import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import {
  TweakerControl,
  useResolvedPanelProp,
  type ReactiveProp,
  type TweakerControlContextValue,
  type TweakerControlProps,
} from '../tweaker-control.js'
import { cn } from '../utils.js'

export type TweakerXYValue = { x: number; y: number }

export interface TweakerXYBounds {
  step: number
  xMax: number
  xMin: number
  yMax: number
  yMin: number
}

export interface TweakerXYPadProps extends Omit<
  TweakerControlProps<TweakerXYValue>,
  'children' | 'defaultValue'
> {
  ariaLabel?: string
  defaultValue?: TweakerXYValue
  padClassName?: string
  step?: ReactiveProp<number>
  xMax?: ReactiveProp<number>
  xMin?: ReactiveProp<number>
  yMax?: ReactiveProp<number>
  yMin?: ReactiveProp<number>
}

const defaultBounds: TweakerXYBounds = {
  step: 0.01,
  xMax: 1,
  xMin: 0,
  yMax: 1,
  yMin: 0,
}

export function TweakerXYPad({
  ariaLabel = 'Two-dimensional value',
  contentLayout = 'block',
  defaultValue,
  padClassName,
  step: stepProp,
  xMax: xMaxProp,
  xMin: xMinProp,
  yMax: yMaxProp,
  yMin: yMinProp,
  ...controlProps
}: TweakerXYPadProps) {
  const step = useResolvedPanelProp(stepProp, defaultBounds.step)
  const xMax = useResolvedPanelProp(xMaxProp, defaultBounds.xMax)
  const xMin = useResolvedPanelProp(xMinProp, defaultBounds.xMin)
  const yMax = useResolvedPanelProp(yMaxProp, defaultBounds.yMax)
  const yMin = useResolvedPanelProp(yMinProp, defaultBounds.yMin)
  const bounds = useMemo(
    () => normalizeTweakerXYBounds({ step, xMax, xMin, yMax, yMin }),
    [step, xMax, xMin, yMax, yMin],
  )
  const initialValue = useMemo(
    () => normalizeTweakerXYValue(defaultValue, bounds),
    [bounds, defaultValue],
  )

  return (
    <TweakerControl<TweakerXYValue>
      {...controlProps}
      contentLayout={contentLayout}
      defaultValue={initialValue}
    >
      {(control) => (
        <XYPadSurface
          ariaLabel={ariaLabel}
          bounds={bounds}
          className={padClassName}
          control={control}
          fallbackValue={initialValue}
        />
      )}
    </TweakerControl>
  )
}

function XYPadSurface({
  ariaLabel,
  bounds,
  className,
  control,
  fallbackValue,
}: {
  ariaLabel: string
  bounds: TweakerXYBounds
  className?: string
  control: TweakerControlContextValue<TweakerXYValue>
  fallbackValue: TweakerXYValue
}) {
  const padRef = useRef<HTMLDivElement | null>(null)
  const thumbRef = useRef<HTMLSpanElement | null>(null)
  const activePointerRef = useRef<number | null>(null)
  const travelRef = useRef({ x: 0, y: 0 })
  const prefersReducedMotion = useReducedMotion()
  const value = normalizeTweakerXYValue(control.value ?? fallbackValue, bounds)
  const projected = projectTweakerXYValue(value, bounds)
  const projectedRef = useRef(projected)
  projectedRef.current = projected
  const cursorX = useMotionValue(0)
  const cursorY = useMotionValue(0)
  const springX = useSpring(cursorX, { damping: 28, mass: 0.35, stiffness: 380 })
  const springY = useSpring(cursorY, { damping: 28, mass: 0.35, stiffness: 380 })
  const visualX = prefersReducedMotion ? cursorX : springX
  const visualY = prefersReducedMotion ? cursorY : springY
  const unavailable = control.disabled || control.readOnly
  const padId = `${control.inputId}:pad`
  const instructionsId = `${control.inputId}:instructions`

  useEffect(() => {
    const measure = () => {
      const pad = padRef.current
      const thumb = thumbRef.current
      if (!pad || !thumb) return
      travelRef.current = {
        x: Math.max(0, pad.clientWidth - thumb.offsetWidth),
        y: Math.max(0, pad.clientHeight - thumb.offsetHeight),
      }
      cursorX.set(projectedRef.current.x * travelRef.current.x)
      cursorY.set(projectedRef.current.y * travelRef.current.y)
    }

    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    if (padRef.current) observer.observe(padRef.current)
    if (thumbRef.current) observer.observe(thumbRef.current)
    return () => observer.disconnect()
  }, [cursorX, cursorY])

  useEffect(() => {
    cursorX.set(projected.x * travelRef.current.x)
    cursorY.set(projected.y * travelRef.current.y)
  }, [cursorX, cursorY, projected.x, projected.y])

  const updateFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (unavailable || activePointerRef.current !== event.pointerId) return
    const rect = padRef.current?.getBoundingClientRect()
    if (!rect) return

    const nextValue = projectTweakerXYPointer(event.clientX, event.clientY, rect, bounds)
    const nextPosition = projectTweakerXYValue(nextValue, bounds)
    cursorX.set(nextPosition.x * travelRef.current.x)
    cursorY.set(nextPosition.y * travelRef.current.y)
    control.setValue(nextValue)
  }

  return (
    <div className="col-span-full grid gap-1.5">
      <div className="focus-within:ring-ring focus-within:ring-offset-background rounded-md focus-within:ring-2 focus-within:ring-offset-1">
        <div
          ref={padRef}
          aria-describedby={instructionsId}
          aria-disabled={unavailable || undefined}
          aria-label={ariaLabel}
          className={cn(
            'bg-muted/50 relative aspect-[2/1] min-h-24 touch-none overflow-hidden rounded-md border border-input outline-none',
            'before:bg-border/70 before:absolute before:inset-y-0 before:left-1/2 before:w-px after:bg-border/70 after:absolute after:inset-x-0 after:top-1/2 after:h-px',
            unavailable ? 'cursor-not-allowed opacity-50' : 'cursor-crosshair',
            className,
          )}
          id={padId}
          role="group"
          onPointerCancel={(event) => {
            if (activePointerRef.current === event.pointerId) activePointerRef.current = null
          }}
          onPointerDown={(event) => {
            if (unavailable || event.button !== 0) return
            activePointerRef.current = event.pointerId
            event.currentTarget.setPointerCapture(event.pointerId)
            updateFromPointer(event)
          }}
          onPointerMove={updateFromPointer}
          onPointerUp={(event) => {
            if (activePointerRef.current !== event.pointerId) return
            updateFromPointer(event)
            activePointerRef.current = null
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId)
            }
          }}
        >
          <motion.span
            ref={thumbRef}
            aria-hidden="true"
            className="border-primary-foreground bg-primary pointer-events-none absolute top-0 left-0 size-3 rounded-full border-2 shadow-sm"
            style={{ x: visualX, y: visualY, willChange: 'transform' }}
          />
        </div>
        <input
          aria-controls={padId}
          aria-describedby={instructionsId}
          aria-label={`${ariaLabel}, X axis`}
          className="sr-only"
          disabled={unavailable}
          id={control.inputId}
          max={bounds.xMax}
          min={bounds.xMin}
          step={bounds.step}
          type="range"
          value={value.x}
          onChange={(event) => {
            control.setValue(
              normalizeTweakerXYValue({ ...value, x: event.currentTarget.valueAsNumber }, bounds),
            )
          }}
        />
        <input
          aria-controls={padId}
          aria-describedby={instructionsId}
          aria-label={`${ariaLabel}, Y axis`}
          className="sr-only"
          disabled={unavailable}
          id={`${control.inputId}:y`}
          max={bounds.yMax}
          min={bounds.yMin}
          step={bounds.step}
          type="range"
          value={value.y}
          onChange={(event) => {
            control.setValue(
              normalizeTweakerXYValue({ ...value, y: event.currentTarget.valueAsNumber }, bounds),
            )
          }}
        />
      </div>
      <output
        aria-live="polite"
        className="text-muted-foreground flex justify-between text-[10px] leading-none tabular-nums"
      >
        <span>X {formatXYValue(value.x, bounds.step)}</span>
        <span>Y {formatXYValue(value.y, bounds.step)}</span>
      </output>
      <p id={instructionsId} className="text-muted-foreground text-[10px] leading-4">
        Drag the pad, or focus the X or Y slider and use arrow keys.
      </p>
    </div>
  )
}

export function normalizeTweakerXYBounds(
  bounds: Partial<Record<keyof TweakerXYBounds, number | undefined>>,
): TweakerXYBounds {
  const rawXMin = finiteOr(bounds.xMin, defaultBounds.xMin)
  const rawXMax = finiteOr(bounds.xMax, defaultBounds.xMax)
  const rawYMin = finiteOr(bounds.yMin, defaultBounds.yMin)
  const rawYMax = finiteOr(bounds.yMax, defaultBounds.yMax)
  return {
    step: Math.max(Number.EPSILON, Math.abs(finiteOr(bounds.step, defaultBounds.step))),
    xMax: Math.max(rawXMin, rawXMax),
    xMin: Math.min(rawXMin, rawXMax),
    yMax: Math.max(rawYMin, rawYMax),
    yMin: Math.min(rawYMin, rawYMax),
  }
}

export function normalizeTweakerXYValue(
  value: TweakerXYValue | undefined,
  bounds: TweakerXYBounds,
): TweakerXYValue {
  const x = finiteOr(value?.x, bounds.xMin)
  const y = finiteOr(value?.y, bounds.yMin)
  return {
    x: snapAndClamp(x, bounds.xMin, bounds.xMax, bounds.step),
    y: snapAndClamp(y, bounds.yMin, bounds.yMax, bounds.step),
  }
}

export function projectTweakerXYValue(value: TweakerXYValue, bounds: TweakerXYBounds) {
  return {
    x: rangeProgress(value.x, bounds.xMin, bounds.xMax),
    y: 1 - rangeProgress(value.y, bounds.yMin, bounds.yMax),
  }
}

export function projectTweakerXYPointer(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'height' | 'left' | 'top' | 'width'>,
  bounds: TweakerXYBounds,
): TweakerXYValue {
  const xProgress = rect.width <= 0 ? 0 : clamp((clientX - rect.left) / rect.width, 0, 1)
  const yProgress = rect.height <= 0 ? 0 : 1 - clamp((clientY - rect.top) / rect.height, 0, 1)
  return normalizeTweakerXYValue(
    {
      x: bounds.xMin + xProgress * (bounds.xMax - bounds.xMin),
      y: bounds.yMin + yProgress * (bounds.yMax - bounds.yMin),
    },
    bounds,
  )
}

function snapAndClamp(value: number, min: number, max: number, step: number) {
  const snapped = min + Math.round((value - min) / step) * step
  return clamp(Number(snapped.toPrecision(12)), min, max)
}

function rangeProgress(value: number, min: number, max: number) {
  if (max === min) return 0
  return clamp((value - min) / (max - min), 0, 1)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function finiteOr(value: number | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function formatXYValue(value: number, step: number) {
  const fractionDigits = Math.min(8, Math.max(0, Math.ceil(-Math.log10(step))))
  return value.toFixed(fractionDigits)
}

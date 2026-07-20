import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react'
import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { tweakerGeometryTokens, tweakerMotionTokens } from '../theme.js'
import {
  TweakerItem,
  useResolvedPanelProp,
  type ReactiveProp,
  type TweakerItemContextValue,
  type TweakerInputItemProps,
} from '../tweaker-control.js'
import type { TweakerParser } from '../tweaker-validation.js'
import { cn } from '../utils.js'
import { canonicalTweakerValue, strictImportShape } from './built-in-validation.js'

export type TweakerXYValue = { x: number; y: number }

export interface TweakerXYBounds {
  step: number
  xMax: number
  xMin: number
  yMax: number
  yMin: number
}

export interface TweakerXYLabelMetrics {
  gap: number
  labelHeight: number
  labelWidth: number
  padWidth: number
  pointWidth: number
}

export interface TweakerXYPadProps extends Omit<
  TweakerInputItemProps<TweakerXYValue>,
  'children' | 'defaultValue' | 'parse'
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
  const { x: defaultX, y: defaultY } = initialValue
  const parse = useMemo<TweakerParser<TweakerXYValue>>(
    () => (input, context) => {
      const error = 'XY value must contain exactly finite x and y coordinates within bounds.'
      const isObject = typeof input === 'object' && input !== null && !Array.isArray(input)
      const shapeError = strictImportShape(context, isObject, error)
      if (shapeError) return shapeError
      const value = normalizeTweakerXYValue(input, bounds, { x: defaultX, y: defaultY })
      return canonicalTweakerValue(input, value, error)
    },
    [bounds, defaultX, defaultY],
  )

  return (
    <TweakerItem<TweakerXYValue>
      {...controlProps}
      contentLayout={contentLayout}
      defaultValue={initialValue}
      parse={parse}
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
    </TweakerItem>
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
  control: TweakerItemContextValue<TweakerXYValue>
  fallbackValue: TweakerXYValue
}) {
  const padRef = useRef<HTMLDivElement | null>(null)
  const thumbRef = useRef<HTMLSpanElement | null>(null)
  const coordinateRef = useRef<HTMLOutputElement | null>(null)
  const activePointerRef = useRef<number | null>(null)
  const pointerRectRef = useRef<Pick<DOMRect, 'height' | 'left' | 'top' | 'width'> | null>(null)
  const travelRef = useRef({ x: 0, y: 0 })
  const prefersReducedMotion = useReducedMotion()
  const value = normalizeTweakerXYValue(control.value, bounds, fallbackValue)
  const projected = projectTweakerXYValue(value, bounds)
  const projectedRef = useRef(projected)
  projectedRef.current = projected
  const cursorX = useMotionValue(0)
  const cursorY = useMotionValue(0)
  const coordinateWidth = useMotionValue(0)
  const coordinateHeight = useMotionValue(0)
  const padWidth = useMotionValue(0)
  const pointWidth = useMotionValue(0)
  const springX = useSpring(cursorX, tweakerMotionTokens.xySpring)
  const springY = useSpring(cursorY, tweakerMotionTokens.xySpring)
  const visualX = prefersReducedMotion ? cursorX : springX
  const visualY = prefersReducedMotion ? cursorY : springY
  const coordinateX = useTransform(
    () =>
      projectTweakerXYLabelPosition(visualX.get(), visualY.get(), {
        gap: tweakerGeometryTokens.xyLabelGap,
        labelHeight: coordinateHeight.get(),
        labelWidth: coordinateWidth.get(),
        padWidth: padWidth.get(),
        pointWidth: pointWidth.get(),
      }).x,
  )
  const coordinateY = useTransform(
    () =>
      projectTweakerXYLabelPosition(visualX.get(), visualY.get(), {
        gap: tweakerGeometryTokens.xyLabelGap,
        labelHeight: coordinateHeight.get(),
        labelWidth: coordinateWidth.get(),
        padWidth: padWidth.get(),
        pointWidth: pointWidth.get(),
      }).y,
  )
  const unavailable = control.disabled || control.readOnly
  const padId = `${control.inputId}:pad`
  const instructionsId = `${control.inputId}:instructions`

  useEffect(() => {
    const measure = () => {
      const pad = padRef.current
      const thumb = thumbRef.current
      const coordinate = coordinateRef.current
      if (!pad || !thumb || !coordinate) return
      padWidth.set(pad.clientWidth)
      pointWidth.set(thumb.offsetWidth)
      coordinateWidth.set(coordinate.offsetWidth)
      coordinateHeight.set(coordinate.offsetHeight)
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
    if (coordinateRef.current) observer.observe(coordinateRef.current)
    return () => observer.disconnect()
  }, [coordinateHeight, coordinateWidth, cursorX, cursorY, padWidth, pointWidth])

  useEffect(() => {
    cursorX.set(projected.x * travelRef.current.x)
    cursorY.set(projected.y * travelRef.current.y)
  }, [cursorX, cursorY, projected.x, projected.y])

  const updateFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (unavailable || activePointerRef.current !== event.pointerId) return
    const rect = pointerRectRef.current
    if (!rect) return

    const nextValue = projectTweakerXYPointer(event.clientX, event.clientY, rect, bounds)
    const nextPosition = projectTweakerXYValue(nextValue, bounds)
    cursorX.set(nextPosition.x * travelRef.current.x)
    cursorY.set(nextPosition.y * travelRef.current.y)
    control.setInput(nextValue)
  }

  return (
    <div className="col-span-full grid gap-(--tweaker-space-1-5)">
      <div className="focus-within:ring-tweaker-focus focus-within:ring-offset-tweaker-canvas rounded-tweaker-control focus-within:ring-2 focus-within:ring-offset-1">
        <div
          ref={padRef}
          aria-describedby={instructionsId}
          aria-disabled={unavailable || undefined}
          aria-label={ariaLabel}
          className={cn(
            'relative aspect-[2/1] min-h-(--tweaker-field-surface-min-height) touch-none overflow-hidden rounded-tweaker-control border border-tweaker-control bg-(--_tweaker-xy-background) outline-none',
            'before:absolute before:inset-y-0 before:left-1/2 before:w-(--tweaker-border-thin) before:bg-(--_tweaker-xy-grid) after:absolute after:inset-x-0 after:top-1/2 after:h-(--tweaker-border-thin) after:bg-(--_tweaker-xy-grid)',
            unavailable
              ? 'cursor-not-allowed opacity-(--tweaker-opacity-disabled)'
              : 'cursor-crosshair',
            className,
          )}
          id={padId}
          role="group"
          onPointerCancel={(event) => {
            if (activePointerRef.current === event.pointerId) {
              activePointerRef.current = null
              pointerRectRef.current = null
            }
          }}
          onPointerDown={(event) => {
            if (unavailable || event.button !== 0) return
            activePointerRef.current = event.pointerId
            pointerRectRef.current = event.currentTarget.getBoundingClientRect()
            event.currentTarget.setPointerCapture(event.pointerId)
            updateFromPointer(event)
          }}
          onPointerMove={updateFromPointer}
          onPointerUp={(event) => {
            if (activePointerRef.current !== event.pointerId) return
            updateFromPointer(event)
            activePointerRef.current = null
            pointerRectRef.current = null
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId)
            }
          }}
        >
          <motion.span
            ref={thumbRef}
            aria-hidden="true"
            className="border-tweaker-accent-text bg-tweaker-accent shadow-tweaker-sm pointer-events-none absolute top-0 left-0 size-(--tweaker-icon-xs) rounded-full border-2"
            style={{ x: visualX, y: visualY, willChange: 'transform' }}
          />
          <motion.output
            ref={coordinateRef}
            aria-hidden="true"
            className="bg-tweaker-text/90 text-tweaker-canvas rounded-tweaker-control pointer-events-none absolute top-0 left-0 z-(--tweaker-layer-raised) px-(--tweaker-space-1-5) py-(--tweaker-space-1) text-(length:--tweaker-font-size-xs) leading-(--tweaker-line-none) font-(--tweaker-font-medium) whitespace-nowrap tabular-nums shadow-(--tweaker-shadow-md)"
            style={{ x: coordinateX, y: coordinateY, willChange: 'transform' }}
          >
            X {formatXYValue(value.x, bounds.step)} · Y {formatXYValue(value.y, bounds.step)}
          </motion.output>
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
            control.setInput(
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
            control.setInput(
              normalizeTweakerXYValue({ ...value, y: event.currentTarget.valueAsNumber }, bounds),
            )
          }}
        />
      </div>
      <p
        id={instructionsId}
        className="text-tweaker-muted text-(length:--tweaker-font-size-sm) leading-(--tweaker-line-tight)"
      >
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
  value: unknown,
  bounds: TweakerXYBounds,
  fallback: TweakerXYValue = { x: bounds.xMin, y: bounds.yMin },
): TweakerXYValue {
  const fallbackX = finiteOr(fallback.x, bounds.xMin)
  const fallbackY = finiteOr(fallback.y, bounds.yMin)
  const candidate = isTweakerXYRecord(value) ? value : { x: fallbackX, y: fallbackY }
  const x = finiteOr(candidate.x, fallbackX)
  const y = finiteOr(candidate.y, fallbackY)
  return {
    x: snapAndClamp(x, bounds.xMin, bounds.xMax, bounds.step),
    y: snapAndClamp(y, bounds.yMin, bounds.yMax, bounds.step),
  }
}

function isTweakerXYRecord(value: unknown): value is Partial<TweakerXYValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function projectTweakerXYValue(value: TweakerXYValue, bounds: TweakerXYBounds) {
  return {
    x: rangeProgress(value.x, bounds.xMin, bounds.xMax),
    y: 1 - rangeProgress(value.y, bounds.yMin, bounds.yMax),
  }
}

export function projectTweakerXYLabelPosition(
  pointX: number,
  pointY: number,
  metrics: TweakerXYLabelMetrics,
) {
  const maxX = Math.max(0, metrics.padWidth - metrics.labelWidth)
  const anchorX = pointX + metrics.pointWidth / 2
  const left = anchorX - metrics.labelWidth - metrics.gap
  const right = anchorX + metrics.gap
  return {
    x: clamp(left >= 0 ? left : right, 0, maxX),
    y: Math.max(0, pointY - metrics.labelHeight - metrics.gap),
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

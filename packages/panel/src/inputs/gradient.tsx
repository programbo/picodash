import { Plus, Trash2 } from 'lucide-react'
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  TweakerControl,
  type TweakerControlContextValue,
  type TweakerControlProps,
} from '../tweaker-control.js'
import { Button, Input } from '../ui.js'
import { cn } from '../utils.js'

export type TweakerGradientStop = { color: string; id: string; position: number }
export type TweakerGradientValue = TweakerGradientStop[]

export interface TweakerGradientProps extends Omit<
  TweakerControlProps<TweakerGradientValue>,
  'children' | 'defaultValue'
> {
  defaultValue?: TweakerGradientValue
  gradientClassName?: string
}

const fallbackGradient: TweakerGradientValue = [
  { color: '#111827', id: 'start', position: 0 },
  { color: '#f9fafb', id: 'end', position: 1 },
]

export function TweakerGradient({
  contentLayout = 'block',
  defaultValue,
  gradientClassName,
  ...controlProps
}: TweakerGradientProps) {
  const normalizedDefault = useMemo(() => normalizeTweakerGradient(defaultValue), [defaultValue])

  return (
    <TweakerControl<TweakerGradientValue>
      {...controlProps}
      contentLayout={contentLayout}
      defaultValue={normalizedDefault}
    >
      {(control) => (
        <GradientEditor
          className={gradientClassName}
          control={control}
          fallbackValue={normalizedDefault}
        />
      )}
    </TweakerControl>
  )
}

function GradientEditor({
  className,
  control,
  fallbackValue,
}: {
  className?: string
  control: TweakerControlContextValue<TweakerGradientValue>
  fallbackValue: TweakerGradientValue
}) {
  const reactId = useId().replaceAll(':', '')
  const idCounterRef = useRef(0)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ pointerId: number; stopId: string } | null>(null)
  const stops = normalizeTweakerGradient(control.value ?? fallbackValue)
  const [selectedId, setSelectedId] = useState(stops[0]?.id ?? '')
  const selectedStop = stops.find((stop) => stop.id === selectedId) ?? stops[0]
  const unavailable = control.disabled || control.readOnly

  useEffect(() => {
    if (!stops.some((stop) => stop.id === selectedId)) {
      setSelectedId(stops[0]?.id ?? '')
    }
  }, [selectedId, stops])

  const setStops = (nextStops: TweakerGradientValue) => {
    control.setValue(normalizeTweakerGradient(nextStops))
  }

  const moveStopFromPointer = (event: ReactPointerEvent<HTMLButtonElement>, stopId: string) => {
    if (unavailable || dragRef.current?.pointerId !== event.pointerId) return
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return
    const position = projectTweakerGradientPosition(event.clientX, rect)
    setStops(stops.map((stop) => (stop.id === stopId ? { ...stop, position } : stop)))
  }

  const addStop = (position = 0.5) => {
    if (unavailable) return
    const id = `gradient-${reactId}-${idCounterRef.current++}`
    const stop = {
      color: colorAtGradientPosition(stops, position),
      id,
      position: clamp(position, 0, 1),
    }
    setSelectedId(id)
    setStops([...stops, stop])
  }

  const removeStop = (stopId: string) => {
    if (unavailable || stops.length <= 2) return
    const index = stops.findIndex((stop) => stop.id === stopId)
    const nextStops = stops.filter((stop) => stop.id !== stopId)
    setSelectedId(nextStops[Math.min(Math.max(0, index - 1), nextStops.length - 1)]?.id ?? '')
    setStops(nextStops)
  }

  return (
    <div className={cn('col-span-full grid gap-2', className)}>
      <div
        ref={trackRef}
        className="border-input relative mt-2 h-9 rounded-md border shadow-inner"
        id={control.inputId}
        style={{ backgroundImage: gradientCssValue(stops) }}
        onDoubleClick={(event) => {
          if (unavailable) return
          const rect = event.currentTarget.getBoundingClientRect()
          addStop(projectTweakerGradientPosition(event.clientX, rect))
        }}
      >
        {stops.map((stop) => (
          <button
            key={stop.id}
            aria-label={`Gradient stop at ${Math.round(stop.position * 100)} percent`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={Math.round(stop.position * 100)}
            className={cn(
              'focus-visible:ring-ring absolute top-full z-10 mt-1 size-4 -translate-x-1/2 touch-none rounded-full border-2 border-background shadow ring-1 ring-border outline-none focus-visible:ring-2',
              selectedStop?.id === stop.id && 'ring-2 ring-primary',
              unavailable ? 'cursor-not-allowed opacity-60' : 'cursor-ew-resize',
            )}
            disabled={control.disabled}
            role="slider"
            style={{ backgroundColor: stop.color, left: `${stop.position * 100}%` }}
            type="button"
            onClick={() => setSelectedId(stop.id)}
            onKeyDown={(event) => {
              handleStopKeyDown(event, stop, stops, unavailable, setStops, removeStop)
            }}
            onPointerCancel={(event) => {
              if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
            }}
            onPointerDown={(event) => {
              if (unavailable || event.button !== 0) return
              setSelectedId(stop.id)
              dragRef.current = { pointerId: event.pointerId, stopId: stop.id }
              event.currentTarget.setPointerCapture(event.pointerId)
            }}
            onPointerMove={(event) => moveStopFromPointer(event, stop.id)}
            onPointerUp={(event) => {
              if (dragRef.current?.pointerId !== event.pointerId) return
              moveStopFromPointer(event, stop.id)
              dragRef.current = null
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId)
              }
            }}
          />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-1.5">
        <input
          aria-label="Selected stop color"
          className="border-input size-7 cursor-pointer rounded border bg-transparent p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={unavailable || !selectedStop}
          type="color"
          value={selectedStop?.color ?? '#000000'}
          onChange={(event) => {
            if (!selectedStop) return
            const color = normalizeTweakerHexColor(event.currentTarget.value)
            setStops(stops.map((stop) => (stop.id === selectedStop.id ? { ...stop, color } : stop)))
          }}
        />
        <Input
          aria-label="Selected stop position"
          className="h-7 min-w-0"
          disabled={control.disabled || !selectedStop}
          max={100}
          min={0}
          readOnly={control.readOnly}
          step={1}
          type="number"
          value={selectedStop ? Math.round(selectedStop.position * 100) : 0}
          onChange={(event) => {
            if (!selectedStop || !Number.isFinite(event.currentTarget.valueAsNumber)) return
            const position = clamp(event.currentTarget.valueAsNumber / 100, 0, 1)
            setStops(
              stops.map((stop) => (stop.id === selectedStop.id ? { ...stop, position } : stop)),
            )
          }}
        />
        <Button
          aria-label="Add gradient stop"
          className="size-7"
          disabled={unavailable}
          size="icon"
          variant="outline"
          onClick={() => addStop(selectedStop?.position ?? 0.5)}
        >
          <Plus className="size-3.5" aria-hidden="true" />
        </Button>
        <Button
          aria-label="Remove selected gradient stop"
          className="size-7"
          disabled={unavailable || !selectedStop || stops.length <= 2}
          size="icon"
          variant="ghost"
          onClick={() => {
            if (selectedStop) removeStop(selectedStop.id)
          }}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
      <p className="text-muted-foreground text-[10px] leading-4">
        Drag stops or use arrow keys. Double-click the gradient to add a stop.
      </p>
    </div>
  )
}

function handleStopKeyDown(
  event: KeyboardEvent<HTMLButtonElement>,
  stop: TweakerGradientStop,
  stops: TweakerGradientValue,
  unavailable: boolean,
  setStops: (stops: TweakerGradientValue) => void,
  removeStop: (id: string) => void,
) {
  if (unavailable) return
  const step = event.shiftKey ? 0.1 : 0.01
  let position: number | undefined
  if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') position = stop.position - step
  if (event.key === 'ArrowRight' || event.key === 'ArrowUp') position = stop.position + step
  if (event.key === 'Home') position = 0
  if (event.key === 'End') position = 1
  if ((event.key === 'Delete' || event.key === 'Backspace') && stops.length > 2) {
    event.preventDefault()
    removeStop(stop.id)
    return
  }
  if (position === undefined) return
  event.preventDefault()
  setStops(
    stops.map((candidate) =>
      candidate.id === stop.id ? { ...candidate, position: clamp(position, 0, 1) } : candidate,
    ),
  )
}

export function normalizeTweakerGradient(value: unknown): TweakerGradientValue {
  const candidates = Array.isArray(value) ? value.filter(isUnknownRecord) : []
  const source = candidates.length > 0 ? candidates : fallbackGradient
  const usedIds = new Set<string>()
  const stops = source.map((stop, index) => {
    const rawId =
      typeof stop.id === 'string' && stop.id.trim() ? stop.id.trim() : `stop-${index + 1}`
    let id = rawId
    let suffix = 2
    while (usedIds.has(id)) id = `${rawId}-${suffix++}`
    usedIds.add(id)
    return {
      color: normalizeTweakerHexColor(stop.color),
      id,
      position: clamp(finiteOr(stop.position, index === 0 ? 0 : 1), 0, 1),
      sourceIndex: index,
    }
  })

  if (stops.length === 1) {
    const only = stops[0]
    const id = usedIds.has('end') ? 'end-2' : 'end'
    stops.push({
      color: only?.color ?? '#ffffff',
      id,
      position: only?.position === 1 ? 0 : 1,
      sourceIndex: 1,
    })
  }

  return stops
    .toSorted(
      (left, right) => left.position - right.position || left.sourceIndex - right.sourceIndex,
    )
    .map(({ color, id, position }) => ({ color, id, position }))
}

export function normalizeTweakerHexColor(value: unknown) {
  if (typeof value !== 'string') return '#000000'
  const shortMatch = /^#([\da-f])([\da-f])([\da-f])$/i.exec(value.trim())
  if (shortMatch) {
    const [, red, green, blue] = shortMatch
    return `#${red}${red}${green}${green}${blue}${blue}`.toLowerCase()
  }
  return /^#[\da-f]{6}$/i.test(value.trim()) ? value.trim().toLowerCase() : '#000000'
}

export function projectTweakerGradientPosition(
  clientX: number,
  rect: Pick<DOMRect, 'left' | 'width'>,
) {
  if (rect.width <= 0) return 0
  return clamp((clientX - rect.left) / rect.width, 0, 1)
}

export function gradientCssValue(stops: TweakerGradientValue) {
  const normalized = normalizeTweakerGradient(stops)
  return `linear-gradient(to right, ${normalized
    .map((stop) => `${stop.color} ${stop.position * 100}%`)
    .join(', ')})`
}

function colorAtGradientPosition(stops: TweakerGradientValue, position: number) {
  const normalized = normalizeTweakerGradient(stops)
  const rightIndex = normalized.findIndex((stop) => stop.position >= position)
  if (rightIndex <= 0) return normalized[0]?.color ?? '#000000'
  if (rightIndex < 0) return normalized.at(-1)?.color ?? '#ffffff'
  const left = normalized[rightIndex - 1]
  const right = normalized[rightIndex]
  if (!left || !right || right.position === left.position) return right?.color ?? '#000000'
  const progress = (position - left.position) / (right.position - left.position)
  return interpolateHex(left.color, right.color, progress)
}

function interpolateHex(left: string, right: string, progress: number) {
  const leftValue = Number.parseInt(left.slice(1), 16)
  const rightValue = Number.parseInt(right.slice(1), 16)
  const channel = (shift: number) =>
    Math.round(
      ((leftValue >> shift) & 0xff) * (1 - progress) + ((rightValue >> shift) & 0xff) * progress,
    )
      .toString(16)
      .padStart(2, '0')
  return `#${channel(16)}${channel(8)}${channel(0)}`
}

function finiteOr(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

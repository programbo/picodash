'use client'
import { useContext, useEffect, useId, useLayoutEffect, useRef } from 'react'
import { animate } from 'motion'
import { thumbSnapSpring, minimumStepPixels } from './stepped-thumb-motion.js'
import type { NumberRangeValue, RangeSliderProps } from './ui-values.js'
import { usePrimaryControlRef, useReadOnlyDescription } from './control-accessibility.js'
import { composeControlClassName } from './ui-class-name.js'
import { useValueControlGesture } from './numeric-control-gesture.js'
import { DashGroupAncestryContext } from './structure.js'
import {
  detentIndex,
  detentValue,
  detentKey,
  detentPointer,
  detentLastValue,
  detentPosition,
  detentGeometry,
  detentPhase,
  type DetentPhase,
} from './detent-model.js'

type End = 'start' | 'end'
type Session =
  | { kind: 'idle' }
  | { kind: 'dragging'; pointerId: number; end: End; offset: number; phase: DetentPhase }
export function DetentRangeSlider({
  value,
  onChange,
  min,
  max,
  step,
  startDetent,
  endDetent,
  createGesture,
  formatOptions,
  formatValue,
  ...props
}: RangeSliderProps & { min: number; max: number; step: number }) {
  const rootRef = useRef<HTMLDivElement>(null),
    trackRef = useRef<HTMLDivElement>(null)
  const startRef = usePrimaryControlRef<HTMLInputElement>(),
    endRef = usePrimaryControlRef<HTMLInputElement>()
  const startThumb = useRef<HTMLDivElement>(null),
    endThumb = useRef<HTMLDivElement>(null)
  const { visible } = useContext(DashGroupAncestryContext)
  const disabled = !!(props.disabled || props.readOnly)
  const configuration = JSON.stringify([min, max, step, startDetent?.value, endDetent?.value])
  const change = useValueControlGesture({
    ref: rootRef,
    createGesture,
    onChange,
    configuration,
    disabled,
  })
  const scale = { min, max, step, startDetent, endDetent }
  const last = detentLastValue(scale)
  const clamp = (end: End, next: number, current: NumberRangeValue): NumberRangeValue =>
    end === 'start'
      ? {
          ...current,
          start: Math.max(startDetent?.value ?? min, Math.min(next, current.end, last)),
        }
      : { ...current, end: Math.min(endDetent?.value ?? last, Math.max(next, current.start, min)) }
  const latest = useRef({ value, change, scale, disabled, clamp })
  latest.current = { value, change, scale, disabled, clamp }
  const session = useRef<Session>({ kind: 'idle' })
  const id = useId()
  const readOnly = useReadOnlyDescription(props.readOnly, props['aria-describedby'])
  const text = (n: number) =>
    n === startDetent?.value
      ? startDetent.label
      : n === endDetent?.value
        ? endDetent.label
        : new Intl.NumberFormat(undefined, formatOptions).format(n)
  const position = (n: number) =>
    n === startDetent?.value
      ? '0px'
      : n === endDetent?.value
        ? '100%'
        : `calc(var(--_picodash-detent-start) + (100% - var(--_picodash-detent-start) - var(--_picodash-detent-end)) * ${max === min ? 0 : (n - min) / (max - min)})`
  const previous = useRef<{ value: NumberRangeValue; configuration: string } | null>(null)
  useLayoutEffect(() => {
    const old = previous.current
    previous.current = { value, configuration }
    const track = trackRef.current
    if (!old || old.configuration !== configuration || !track || disabled || !visible) return
    const media = track.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)')
    if (media?.matches) return
    const width = track.getBoundingClientRect().width,
      direction = getComputedStyle(track).direction === 'rtl' ? -1 : 1
    const motions: ReturnType<typeof animate>[] = []
    for (const end of ['start', 'end'] as const) {
      const thumb = (end === 'start' ? startThumb : endThumb).current
      if (!thumb || old.value[end] === value[end]) continue
      const phaseChanged = detentPhase(old.value[end], scale) !== detentPhase(value[end], scale)
      if (
        !phaseChanged &&
        (max === min ||
          ((detentGeometry(width, scale).end - detentGeometry(width, scale).start) * step) /
            (max - min) <
            minimumStepPixels)
      )
        continue
      const offset =
        (detentPosition(old.value[end], width, scale) - detentPosition(value[end], width, scale)) *
        direction
      thumb.style.setProperty('--_picodash-step-snap', `${offset}px`)
      motions.push(
        animate(offset, 0, {
          ...thumbSnapSpring,
          onUpdate: (x) => thumb.style.setProperty('--_picodash-step-snap', `${x}px`),
        }),
      )
    }
    const stop = () => {
      motions.forEach((m) => m.stop())
      startThumb.current?.style.removeProperty('--_picodash-step-snap')
      endThumb.current?.style.removeProperty('--_picodash-step-snap')
    }
    const changed = () => {
      if (media?.matches) stop()
    }
    media?.addEventListener('change', changed)
    return () => {
      stop()
      media?.removeEventListener('change', changed)
    }
  }, [value.start, value.end, configuration, disabled, visible])
  useEffect(() => {
    const root = rootRef.current,
      track = trackRef.current,
      start = startThumb.current,
      end = endThumb.current
    if (!root || !track || !start || !end) return
    const doc = root.ownerDocument
    const rtl = () => getComputedStyle(root).direction === 'rtl'
    const thumb = (which: End) => (which === 'start' ? start : end)
    const input = (which: End) => (which === 'start' ? startRef.current : endRef.current)
    const stop = () => {
      const current = session.current
      session.current = { kind: 'idle' }
      for (const t of [start, end]) {
        t.removeAttribute('data-dragging')
        t.style.removeProperty('--_picodash-detent-pull')
      }
      if (current.kind === 'dragging' && root.hasPointerCapture?.(current.pointerId))
        root.releasePointerCapture(current.pointerId)
    }
    const coords = (x: number) => {
      const box = track.getBoundingClientRect()
      return { point: rtl() ? box.right - x : x - box.left, width: box.width }
    }
    const down = (event: PointerEvent) => {
      if (
        event.button !== 0 ||
        latest.current.disabled ||
        !visible ||
        session.current.kind !== 'idle' ||
        !event.composedPath().includes(track)
      )
        return
      event.preventDefault()
      const { point, width } = coords(event.clientX),
        current = latest.current
      const onStart = event.composedPath().includes(start),
        onEnd = event.composedPath().includes(end)
      const which: End = onStart
        ? 'start'
        : onEnd
          ? 'end'
          : Math.abs(point - detentPosition(current.value.start, width, current.scale)) <
              Math.abs(point - detentPosition(current.value.end, width, current.scale))
            ? 'start'
            : 'end'
      input(which)?.focus({ preventScroll: true })
      session.current = {
        kind: 'dragging',
        pointerId: event.pointerId,
        end: which,
        offset:
          onStart || onEnd ? point - detentPosition(current.value[which], width, current.scale) : 0,
        phase: detentPhase(current.value[which], current.scale),
      }
      thumb(which).setAttribute('data-dragging', 'true')
      root.setPointerCapture?.(event.pointerId)
      if (!onStart && !onEnd) {
        const bounds = detentGeometry(width, current.scale)
        const next = detentPointer(
          Math.max(bounds.start, Math.min(bounds.end, point)),
          width,
          'range',
          current.scale,
        )
        current.change(current.clamp(which, next.value, current.value))
        session.current.phase = detentPhase(
          current.clamp(which, next.value, current.value)[which],
          current.scale,
        )
      }
    }
    const move = (event: PointerEvent) => {
      const s = session.current
      if (s.kind !== 'dragging' || s.pointerId !== event.pointerId) return
      event.preventDefault()
      const { point, width } = coords(event.clientX),
        current = latest.current
      const next = detentPointer(point - s.offset, width, s.phase, current.scale),
        value = current.clamp(s.end, next.value, current.value)
      s.phase = detentPhase(value[s.end], current.scale)
      thumb(s.end).style.setProperty(
        '--_picodash-detent-pull',
        `${value[s.end] === next.value ? next.pull * (rtl() ? -1 : 1) : 0}px`,
      )
      current.change(value)
    }
    const up = (e: PointerEvent) => {
      if (session.current.kind === 'dragging' && session.current.pointerId === e.pointerId) stop()
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stop()
        return
      }
      const which: End | undefined =
        e.target === startRef.current ? 'start' : e.target === endRef.current ? 'end' : undefined
      if (!which) return
      const c = latest.current,
        next = detentKey(c.value[which], e.key, e.repeat, rtl(), c.scale)
      if (next !== undefined) {
        e.preventDefault()
        if (!c.disabled && visible) c.change(c.clamp(which, next, c.value))
      }
    }
    root.addEventListener('pointerdown', down)
    root.addEventListener('keydown', key, true)
    root.addEventListener('lostpointercapture', stop)
    doc.addEventListener('pointermove', move, { passive: false })
    doc.addEventListener('pointerup', up)
    doc.addEventListener('pointercancel', up)
    return () => {
      root.removeEventListener('pointerdown', down)
      root.removeEventListener('keydown', key, true)
      root.removeEventListener('lostpointercapture', stop)
      doc.removeEventListener('pointermove', move)
      doc.removeEventListener('pointerup', up)
      doc.removeEventListener('pointercancel', up)
      stop()
    }
  }, [configuration, disabled, visible, startRef, endRef])
  return (
    <>
      <div
        ref={rootRef}
        id={props.id}
        role="group"
        aria-label={props['aria-label']}
        aria-labelledby={props['aria-labelledby']}
        className={composeControlClassName('picodash-dashstack-range-slider', props.className)}
        data-detent-range
        data-disabled={props.disabled || undefined}
        data-readonly={props.readOnly || undefined}
      >
        <output aria-hidden="true">
          {formatValue ? formatValue(value) : `${text(value.start)}–${text(value.end)}`}
        </output>
        <div
          ref={trackRef}
          className="picodash-dashstack-range-slider-track"
          data-picodash-detent-track
          data-start-detent={!!startDetent || undefined}
          data-end-detent={!!endDetent || undefined}
        >
          {(['start', 'end'] as const).map((which, index) => {
            const lo = which === 'start' ? (startDetent?.value ?? min) : Math.max(min, value.start),
              hi = which === 'end' ? (endDetent?.value ?? last) : Math.min(last, value.end)
            return (
              <div
                key={which}
                ref={which === 'start' ? startThumb : endThumb}
                data-picodash-dashstack-range-slider-thumb
                data-picodash-range-end={which}
                data-picodash-range-upper-overlap={
                  (which === 'start' && value.start === value.end && value.end === last) ||
                  undefined
                }
                data-picodash-range-lower-overlap={
                  (which === 'end' && value.start === value.end && value.start === min) || undefined
                }
                style={{ insetInlineStart: position(value[which]) }}
                onPointerEnter={(e) => e.currentTarget.setAttribute('data-hovered', 'true')}
                onPointerLeave={(e) => e.currentTarget.removeAttribute('data-hovered')}
                onFocus={(e) => e.currentTarget.setAttribute('data-focus-visible', 'true')}
                onBlur={(e) => e.currentTarget.removeAttribute('data-focus-visible')}
              >
                <input
                  ref={which === 'start' ? startRef : endRef}
                  type="range"
                  className="picodash-visually-hidden"
                  min={detentIndex(lo, scale)}
                  max={detentIndex(hi, scale)}
                  step={1}
                  value={detentIndex(value[which], scale)}
                  disabled={props.disabled}
                  aria-label={
                    props['aria-labelledby']
                      ? undefined
                      : `${index === 0 ? 'Start' : 'End'}${props['aria-label'] ? ` ${props['aria-label']}` : ''}`
                  }
                  aria-labelledby={
                    props['aria-labelledby']
                      ? `${id}-${which} ${props['aria-labelledby']}`
                      : undefined
                  }
                  aria-describedby={[readOnly.describedBy, id].filter(Boolean).join(' ')}
                  aria-valuemin={lo}
                  aria-valuemax={hi}
                  aria-valuenow={value[which]}
                  aria-valuetext={text(value[which])}
                  aria-invalid={props['aria-invalid']}
                  aria-errormessage={props['aria-errormessage']}
                  onChange={(e) => {
                    if (!disabled && visible)
                      change(clamp(which, detentValue(e.currentTarget.valueAsNumber, scale), value))
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>
      <span hidden id={`${id}-start`}>
        Start
      </span>
      <span hidden id={`${id}-end`}>
        End
      </span>
      <span hidden id={id}>
        Numeric range {min} to {last}.{' '}
        {startDetent ? `Start Home selects ${startDetent.label}. ` : ''}
        {endDetent ? `End End selects ${endDetent.label}. ` : ''}Release and press again at an
        endpoint to enter its extra stop.
      </span>
      {readOnly.description}
    </>
  )
}

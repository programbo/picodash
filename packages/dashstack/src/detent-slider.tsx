'use client'

import { useContext, useEffect, useId, useLayoutEffect, useRef } from 'react'
import { Group } from 'react-aria-components'
import { animate } from 'motion'
import { thumbSnapSpring, minimumStepPixels } from './stepped-thumb-motion.js'
import type { SliderProps } from './ui.js'
import { usePrimaryControlRef, useReadOnlyDescription } from './control-accessibility.js'
import { composeControlClassName } from './ui-class-name.js'
import { useNumericControlGesture } from './numeric-control-gesture.js'
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

type Props = SliderProps & { min: number; max: number; step: number }
type PointerSession =
  | { kind: 'idle' }
  | { kind: 'dragging'; pointerId: number; offset: number; phase: DetentPhase }

export function DetentSlider({
  value,
  onChange,
  min,
  max,
  step,
  startDetent,
  endDetent,
  createGesture,
  marks,
  formatOptions,
  formatValue,
  ...props
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const readoutRef = useRef<HTMLSpanElement>(null)
  const inputRef = usePrimaryControlRef<HTMLInputElement>()
  const { visible } = useContext(DashGroupAncestryContext)
  const disabled = !!(props.disabled || props.readOnly)
  const configuration = JSON.stringify([min, max, step, startDetent?.value, endDetent?.value])
  const change = useNumericControlGesture({
    ref: rootRef,
    createGesture,
    onChange,
    configuration,
    disabled,
  })
  const scale = { min, max, step, startDetent, endDetent }
  const latest = useRef({ value, change, scale, disabled })
  latest.current = { value, change, scale, disabled }
  const session = useRef<PointerSession>({ kind: 'idle' })
  const descriptionId = useId()
  const readOnly = useReadOnlyDescription(props.readOnly, props['aria-describedby'])
  const formatted =
    value === startDetent?.value
      ? startDetent.label
      : value === endDetent?.value
        ? endDetent.label
        : new Intl.NumberFormat(undefined, formatOptions).format(value)
  const position = (number: number) =>
    number === startDetent?.value
      ? '0px'
      : number === endDetent?.value
        ? '100%'
        : `calc(var(--_picodash-detent-start) + (100% - var(--_picodash-detent-start) - var(--_picodash-detent-end)) * ${max === min ? 0 : (number - min) / (max - min)})`

  const stops = [
    ...new Set([
      ...(startDetent ? [startDetent.value] : []),
      min,
      ...(marks?.map((mark) => mark.value) ?? []),
      detentLastValue(scale),
      ...(endDetent ? [endDetent.value] : []),
    ]),
  ].sort((a, b) => a - b)
  const readout =
    value === startDetent?.value || value === endDetent?.value
      ? formatted
      : formatValue
        ? formatValue(value)
        : formatted

  // Measure only the readout, so arbitrary authored units stay inside the thumb edges.
  useLayoutEffect(() => {
    const label = readoutRef.current,
      track = trackRef.current
    if (!label || !track) return
    const paint = () =>
      track.style.setProperty(
        '--_picodash-detent-readout-width',
        `${label.getBoundingClientRect().width}px`,
      )
    paint()
    const Observer = track.ownerDocument.defaultView?.ResizeObserver
    const observer = Observer ? new Observer(paint) : undefined
    observer?.observe(label)
    return () => observer?.disconnect()
  }, [readout])

  const previousPaint = useRef<{ value: number; phase: DetentPhase; configuration: string } | null>(
    null,
  )
  useLayoutEffect(() => {
    const thumb = thumbRef.current,
      track = trackRef.current
    const previous = previousPaint.current
    const phase = detentPhase(value, scale)
    previousPaint.current = { value, phase, configuration }
    if (
      !thumb ||
      !track ||
      !previous ||
      previous.configuration !== configuration ||
      (previous.phase === phase &&
        (max === min ||
          ((detentGeometry(track.getBoundingClientRect().width, scale).end -
            detentGeometry(track.getBoundingClientRect().width, scale).start) *
            step) /
            (max - min) <
            minimumStepPixels)) ||
      disabled ||
      !visible
    )
      return
    const view = track.ownerDocument.defaultView
    const media = view?.matchMedia('(prefers-reduced-motion: reduce)')
    if (media?.matches) return
    const width = track.getBoundingClientRect().width
    const direction = view?.getComputedStyle(track).direction === 'rtl' ? -1 : 1
    const offset =
      (detentPosition(previous.value, width, scale) - detentPosition(value, width, scale)) *
      direction
    track.style.setProperty('--_picodash-detent-snap', `${offset}px`)
    const motion = animate(offset, 0, {
      ...thumbSnapSpring,
      onUpdate: (next) => track.style.setProperty('--_picodash-detent-snap', `${next}px`),
    })
    const stop = () => {
      motion.stop()
      track.style.removeProperty('--_picodash-detent-snap')
    }
    const changed = () => {
      if (media?.matches) stop()
    }
    media?.addEventListener('change', changed)
    return () => {
      stop()
      media?.removeEventListener('change', changed)
    }
  }, [value, configuration, disabled, visible])

  useEffect(() => {
    const root = rootRef.current,
      track = trackRef.current,
      thumb = thumbRef.current,
      input = inputRef.current
    if (!root || !track || !thumb || !input) return
    const document = root.ownerDocument
    const rtl = () => document.defaultView?.getComputedStyle(root).direction === 'rtl'
    const stop = () => {
      const current = session.current
      session.current = { kind: 'idle' }
      thumb.removeAttribute('data-dragging')
      thumb.style.removeProperty('--_picodash-detent-pull')
      if (current.kind === 'dragging' && root.hasPointerCapture?.(current.pointerId))
        root.releasePointerCapture(current.pointerId)
    }
    const coordinate = (clientX: number) => {
      const box = track.getBoundingClientRect()
      return { position: rtl() ? box.right - clientX : clientX - box.left, width: box.width }
    }
    const down = (event: PointerEvent) => {
      if (
        event.button !== 0 ||
        latest.current.disabled ||
        !visible ||
        session.current.kind !== 'idle'
      )
        return
      if (!event.composedPath().includes(track)) return
      event.preventDefault()
      input.focus({ preventScroll: true })
      const { position: point, width } = coordinate(event.clientX)
      const current = latest.current
      const isThumb = event.composedPath().includes(thumb)
      session.current = {
        kind: 'dragging',
        pointerId: event.pointerId,
        offset: isThumb ? point - detentPosition(current.value, width, current.scale) : 0,
        phase: detentPhase(current.value, current.scale),
      }
      thumb.setAttribute('data-dragging', 'true')
      root.setPointerCapture?.(event.pointerId)
      // Track clicks select a valid size; pulling or keyboard actions cross a detent gap.
      if (!isThumb) {
        const { start, end } = detentGeometry(width, current.scale)
        const next = detentPointer(
          Math.max(start, Math.min(end, point)),
          width,
          'range',
          current.scale,
        )
        session.current.phase = next.phase
        current.change(next.value)
      }
    }
    const move = (event: PointerEvent) => {
      const current = session.current
      if (current.kind !== 'dragging' || current.pointerId !== event.pointerId) return
      event.preventDefault()
      const { position: point, width } = coordinate(event.clientX)
      const next = detentPointer(point - current.offset, width, current.phase, latest.current.scale)
      current.phase = next.phase
      thumb.style.setProperty('--_picodash-detent-pull', `${next.pull * (rtl() ? -1 : 1)}px`)
      latest.current.change(next.value)
    }
    const up = (event: PointerEvent) => {
      if (session.current.kind === 'dragging' && session.current.pointerId === event.pointerId)
        stop()
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        stop()
        return
      }
      const next = detentKey(
        latest.current.value,
        event.key,
        event.repeat,
        rtl(),
        latest.current.scale,
      )
      if (next !== undefined) {
        event.preventDefault()
        if (!latest.current.disabled) latest.current.change(next)
      }
    }
    root.addEventListener('pointerdown', down)
    root.addEventListener('keydown', key, true)
    root.addEventListener('lostpointercapture', stop)
    document.addEventListener('pointermove', move, { passive: false })
    document.addEventListener('pointerup', up)
    document.addEventListener('pointercancel', up)
    return () => {
      root.removeEventListener('pointerdown', down)
      root.removeEventListener('keydown', key, true)
      root.removeEventListener('lostpointercapture', stop)
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      document.removeEventListener('pointercancel', up)
      stop()
    }
  }, [configuration, disabled, visible, inputRef])

  return (
    <>
      <div
        ref={rootRef}
        id={props.id}
        className={composeControlClassName('picodash-dashstack-slider', props.className)}
        data-detents
        data-reference-labels={marks?.some((mark) => mark.label !== '') || undefined}
        data-disabled={props.disabled || undefined}
        data-readonly={props.readOnly || undefined}
      >
        <div
          ref={trackRef}
          className="picodash-dashstack-slider-track"
          data-picodash-detent-track
          data-start-detent={!!startDetent || undefined}
          data-end-detent={!!endDetent || undefined}
        >
          <span aria-hidden="true" data-picodash-detent-interval />
          {stops.map((stop, index) => (
            <span
              key={index}
              aria-hidden="true"
              data-picodash-detent-dot={stop}
              data-selected={value === stop || undefined}
              data-motion={visible ? undefined : 'false'}
              style={{ insetInlineStart: position(stop) }}
            />
          ))}
          {!stops.includes(value) && (
            <span
              aria-hidden="true"
              data-picodash-detent-value-stem
              style={{ insetInlineStart: position(value) }}
            />
          )}
          <span
            ref={readoutRef}
            aria-hidden="true"
            data-picodash-detent-readout
            style={{
              insetInlineStart: `clamp(calc(-1 * var(--_picodash-detent-thumb-half)), calc(${position(value)} - var(--_picodash-detent-readout-width, 0px) / 2), calc(100% + var(--_picodash-detent-thumb-half) - var(--_picodash-detent-readout-width, 0px)))`,
            }}
          >
            {readout}
          </span>
          <Group
            role="presentation"
            ref={thumbRef}
            data-picodash-dashstack-slider-thumb
            data-detent-phase={detentPhase(value, scale)}
            style={{ insetInlineStart: position(value) }}
          >
            <input
              ref={inputRef}
              type="range"
              className="picodash-visually-hidden"
              min={0}
              max={detentIndex(endDetent?.value ?? detentLastValue(scale), scale)}
              step={1}
              value={detentIndex(value, scale)}
              disabled={props.disabled}
              aria-label={props['aria-label']}
              aria-labelledby={props['aria-labelledby']}
              aria-describedby={[readOnly.describedBy, descriptionId].filter(Boolean).join(' ')}
              aria-invalid={props['aria-invalid']}
              aria-errormessage={props['aria-errormessage']}
              aria-valuemin={startDetent?.value ?? min}
              aria-valuemax={endDetent?.value ?? detentLastValue(scale)}
              aria-valuenow={value}
              aria-valuetext={formatted}
              onChange={(event) => {
                if (!disabled) change(detentValue(event.currentTarget.valueAsNumber, scale))
              }}
            />
          </Group>
          {marks?.map((mark, index) => (
            <span
              key={index}
              aria-hidden="true"
              data-picodash-detent-mark
              style={{ insetInlineStart: position(mark.value) }}
            >
              {mark.label ?? mark.value}
            </span>
          ))}
        </div>
      </div>
      <span id={descriptionId} hidden>
        Range {min} to {detentLastValue(scale)}.{' '}
        {startDetent ? `Home selects ${startDetent.label}. ` : ''}
        {endDetent ? `End selects ${endDetent.label}. ` : ''}At an endpoint, release and press its
        arrow again to enter the extra stop.
      </span>
      {readOnly.description}
    </>
  )
}

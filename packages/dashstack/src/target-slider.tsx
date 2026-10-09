'use client'

import { useContext, useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { animate } from 'motion'
import { useLocale } from 'react-aria-components'
import { NumberField, Slider, type SliderMark, type SliderProps } from './ui.js'
import { SliderTrackAccessoryContext } from './slider-accessory.js'
import { DashGroupAncestryContext } from './structure.js'
import { validateSliderOptions } from './slider-options.js'
import { isNumberCompatible } from './number-compatibility.js'
import { composeControlClassName } from './ui-class-name.js'

import { targetResultValue, targetResultMessage, type TargetResult } from './target-result.js'

function targetPosition(value: number, min: number, max: number): number {
  return min === max ? 50 : ((value - min) / (max - min)) * 100
}

export type TargetSliderResult = TargetResult
export type TargetSliderProps = Omit<
  SliderProps,
  'fillOrigin' | 'startDetent' | 'endDetent' | 'onChange'
> & {
  readonly result: TargetSliderResult
  readonly onChange: (value: number | null) => void
  readonly inputValue?: number | null
  readonly unit?: string
  readonly formatValue?: (value: number) => ReactNode
}

function AchievedMarker({
  position,
  pointer = 'arrow',
  children,
}: {
  position: number
  pointer?: 'arrow' | 'stem' | 'none'
  children: ReactNode
}) {
  const { visible } = useContext(DashGroupAncestryContext)
  const ref = useRef<HTMLSpanElement>(null)
  const painted = useRef<number | null>(null)
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const media = node.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)')
    const paint = (value: number) => {
      painted.current = value
      node.style.setProperty('--_picodash-achieved-position', `${value}%`)
    }
    let motion: ReturnType<typeof animate> | undefined
    const snap = () => {
      motion?.stop()
      paint(position)
    }
    if (painted.current === null || media?.matches || !visible) snap()
    else
      motion = animate(painted.current, position, {
        duration: 0.18,
        ease: [0.22, 1, 0.36, 1],
        onUpdate: paint,
      })
    const changed = () => {
      if (media?.matches) snap()
    }
    media?.addEventListener('change', changed)
    return () => {
      motion?.stop()
      media?.removeEventListener('change', changed)
    }
  }, [position, visible])
  return (
    <span
      ref={ref}
      aria-hidden="true"
      data-picodash-achieved-marker
      style={{ '--_picodash-achieved-label-offset': `${-position}%` } as React.CSSProperties}
    >
      <span aria-hidden="true" data-picodash-achieved-pointer={pointer} />
      <span data-picodash-achieved-readout>{children}</span>
    </span>
  )
}

function TargetReferenceMarks({
  marks,
  min,
  max,
  selected,
}: {
  marks: readonly SliderMark[]
  min: number
  max: number
  selected: number
}) {
  const { visible } = useContext(DashGroupAncestryContext)
  return (
    <span
      aria-hidden="true"
      data-picodash-dashstack-slider-marks
      data-picodash-target-marks
      data-motion={visible ? undefined : 'false'}
    >
      {marks.map((mark, index) => (
        <span
          key={`${mark.value}:${index}`}
          data-picodash-dashstack-slider-mark={mark.value}
          data-selected={index === selected || undefined}
          style={
            {
              '--_picodash-dashstack-slider-mark-position': `${targetPosition(mark.value, min, max)}%`,
            } as React.CSSProperties
          }
        >
          {mark.label ?? mark.value}
        </span>
      ))}
    </span>
  )
}

export function TargetSlider({
  result,
  value,
  inputValue,
  unit,
  formatValue,
  onChange,
  min = 0,
  max = 100,
  step = 0.01,
  marks,
  ...props
}: TargetSliderProps) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max)
    throw new TypeError('TargetSlider requires a finite ordered scale.')
  if (!Number.isFinite(step) || step <= 0) throw new TypeError('step must be finite and positive.')
  if (marks?.some((mark) => !Number.isFinite(mark.value) || mark.value < min || mark.value > max))
    throw new TypeError('marks must be finite and within the scale.')
  validateSliderOptions(min, max, step, { allowedRange: props.allowedRange })
  const { locale } = useLocale()
  const singleton = min === max
  const achieved = targetResultValue(result)
  const prefix = useId(),
    marksId = useId()
  const lower = props.allowedRange?.min ?? min,
    upper = props.allowedRange?.max ?? max
  const mismatch = !isNumberCompatible(value, lower, upper, step)
  const achievedOutside = achieved !== undefined && (achieved < min || achieved > max)
  const formatted = (value: number) =>
    formatValue ? formatValue(value) : String(Number(value.toFixed(6)))
  const readout =
    achieved === undefined ? null : (
      <>
        {formatted(achieved)}
        {!formatValue && unit ? ` ${unit}` : ''}
      </>
    )
  // Match the actual result, not the requested target or a nearest reference mark.
  // Only tolerate binary rounding at the scale of the two numbers.
  const selectedMark =
    marks?.findIndex(
      (mark) =>
        achieved !== undefined &&
        !achievedOutside &&
        Math.abs(mark.value - achieved) <=
          Number.EPSILON * Math.max(1, Math.abs(mark.value), Math.abs(achieved)) * 8,
    ) ?? -1
  const status = targetResultMessage(result)
  const statusId = `${prefix}-status`
  const singletonId = `${prefix}-singleton`
  const feedback =
    achieved !== undefined && !achievedOutside ? (
      <AchievedMarker
        key={`${min}:${max}`}
        position={targetPosition(achieved, min, max)}
        pointer={marks?.length ? (selectedMark >= 0 ? 'none' : 'stem') : 'arrow'}
      >
        {readout}
      </AchievedMarker>
    ) : (
      <span
        data-picodash-target-result-message
        aria-hidden="true"
        onPointerDown={(event) => {
          // Feedback below the track is readable text, not another target-editing surface.
          event.preventDefault()
          event.stopPropagation()
        }}
        title={
          achievedOutside
            ? `${achieved}${unit ? ` ${unit}` : ''} · outside scale`
            : result.status === 'pending'
              ? undefined
              : status || undefined
        }
      >
        {result.status === 'no-fit' ? (
          'No match'
        ) : result.status === 'error' ? (
          'Unavailable'
        ) : achievedOutside ? (
          <>{readout} · outside scale</>
        ) : (
          '—'
        )}
      </span>
    )
  const trackAccessory = (
    <>
      {feedback}
      {marks?.length ? (
        <TargetReferenceMarks marks={marks} min={min} max={max} selected={selectedMark} />
      ) : null}
    </>
  )
  const position = Math.max(0, Math.min(100, targetPosition(value, min, max)))
  const input = inputValue === null ? Number.NaN : (inputValue ?? value)
  const labelChars = Math.max(8, String(Number(input.toFixed(6))).length + (unit?.length ?? 0) + 3)
  const description =
    [
      props['aria-describedby'],
      singleton ? singletonId : undefined,
      marks?.length ? marksId : undefined,
      status || achievedOutside ? statusId : undefined,
    ]
      .filter(Boolean)
      .join(' ') || undefined
  const label = props['aria-labelledby'] ? `${prefix} ${props['aria-labelledby']}` : undefined
  const trackSlot = useRef<HTMLDivElement>(null)
  const trackHadFocus = useRef(false)
  useLayoutEffect(() => {
    const slot = trackSlot.current
    if (
      slot &&
      !props.disabled &&
      trackHadFocus.current &&
      slot.ownerDocument.activeElement === slot.ownerDocument.body
    ) {
      // The track renderer changes at a singleton boundary. Keep keyboard focus in the control.
      slot.querySelector<HTMLElement>('[role="slider"], input[type="range"]')?.focus()
    }
  }, [singleton, mismatch, props.disabled])
  return (
    <div
      className="picodash-dashstack-target-slider"
      data-result={result.status}
      data-singleton={singleton || undefined}
      aria-busy={result.status === 'pending'}
    >
      <span id={prefix} className="picodash-visually-hidden">
        Target
      </span>
      <div
        data-picodash-target-track
        style={
          {
            '--_picodash-target-ratio': position / 100,
            '--_picodash-target-label-width': `${labelChars}ch`,
          } as React.CSSProperties
        }
      >
        <div data-picodash-target-label-slot>
          <NumberField
            id={props.id}
            value={input}
            unit={unit}
            onChange={onChange}
            step={step}
            formatOptions={props.formatOptions}
            disabled={props.disabled}
            readOnly={props.readOnly}
            aria-label={label ? undefined : `Target ${props['aria-label'] ?? 'value'}`}
            aria-labelledby={label}
            aria-describedby={description}
            aria-invalid={props['aria-invalid']}
            aria-errormessage={props['aria-errormessage']}
          />
        </div>
        <div
          ref={trackSlot}
          onFocusCapture={() => {
            trackHadFocus.current = true
          }}
          onBlurCapture={(event) => {
            trackHadFocus.current = event.currentTarget.contains(event.relatedTarget)
          }}
        >
          <SliderTrackAccessoryContext.Provider value={trackAccessory}>
            {singleton && !mismatch ? (
              <div
                className={composeControlClassName('picodash-dashstack-slider', props.className)}
                data-disabled={props.disabled || undefined}
              >
                <div className="picodash-dashstack-slider-track" data-picodash-singleton-track>
                  <div
                    role="slider"
                    tabIndex={props.disabled ? -1 : 0}
                    aria-label={label ? undefined : `Target ${props['aria-label'] ?? 'value'}`}
                    aria-labelledby={label}
                    aria-describedby={description}
                    aria-valuemin={min}
                    aria-valuemax={max}
                    aria-valuenow={value}
                    aria-valuetext={`${new Intl.NumberFormat(locale, props.formatOptions).format(value)}${unit ? ` ${unit}` : ''}`}
                    aria-readonly="true"
                    aria-disabled={props.disabled || undefined}
                    aria-invalid={props['aria-invalid']}
                    aria-errormessage={props['aria-errormessage']}
                    data-picodash-dashstack-slider-thumb
                    data-picodash-singleton-thumb
                    onKeyDown={(event) => {
                      if (
                        [
                          'ArrowLeft',
                          'ArrowRight',
                          'ArrowUp',
                          'ArrowDown',
                          'Home',
                          'End',
                          'PageUp',
                          'PageDown',
                        ].includes(event.key)
                      )
                        event.preventDefault()
                    }}
                  />
                  {trackAccessory}
                </div>
              </div>
            ) : mismatch ? (
              <div className="picodash-dashstack-slider">
                <div className="picodash-dashstack-slider-track">{trackAccessory}</div>
              </div>
            ) : (
              <Slider
                {...props}
                id={undefined}
                value={value}
                min={min}
                max={max}
                step={step}
                onChange={onChange}
                disabled={props.disabled}
                aria-label={label ? undefined : `Target ${props['aria-label'] ?? 'value'}`}
                aria-labelledby={label}
                aria-describedby={description}
              />
            )}
          </SliderTrackAccessoryContext.Provider>
        </div>
      </div>
      {singleton ? (
        <span id={singletonId} className="picodash-visually-hidden">
          Only available value: {formatted(min)}
          {!formatValue && unit ? ` ${unit}` : ''}. Slider is read only.
        </span>
      ) : null}
      {mismatch ? (
        <p data-picodash-target-warning>
          Target {formatted(value)} is outside the configured interval or step.
        </p>
      ) : null}
      {achieved !== undefined ? (
        <output aria-label="Achieved" aria-live="off" className="picodash-visually-hidden">
          {readout}
          {achievedOutside ? ' · outside scale' : ''}
        </output>
      ) : null}
      <span id={statusId} role="status" className="picodash-visually-hidden">
        {status}
        {achievedOutside ? (
          <>
            {status ? ' · ' : ''}
            {readout} · outside scale
          </>
        ) : null}
      </span>
      {marks?.length ? (
        <span id={marksId} className="picodash-visually-hidden">
          Reference marks:{' '}
          {marks.map((mark, index) => (
            <span key={index}>
              {index ? ', ' : ''}
              {mark.label ?? mark.value} ({mark.value})
            </span>
          ))}
        </span>
      ) : null}
    </div>
  )
}

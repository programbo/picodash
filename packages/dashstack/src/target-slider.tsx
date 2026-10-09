'use client'

import { useContext, useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { animate } from 'motion'
import { NumberField, Slider, type SliderProps } from './ui.js'
import { SliderTrackAccessoryContext } from './slider-accessory.js'
import { DashGroupAncestryContext } from './structure.js'
import { validateSliderOptions } from './slider-options.js'
import { isNumberCompatible } from './number-compatibility.js'

export type TargetSliderResult =
  | { readonly status: 'ready'; readonly value: number }
  | { readonly status: 'pending'; readonly lastValue?: number }
  | { readonly status: 'no-fit'; readonly message?: string }
  | { readonly status: 'error'; readonly message: string }
export type TargetSliderProps = Omit<SliderProps, 'fillOrigin' | 'onChange'> & {
  readonly result: TargetSliderResult
  readonly onChange: (value: number | null) => void
  readonly inputValue?: number | null
  readonly formatValue?: (value: number) => ReactNode
}

function AchievedMarker({ position, children }: { position: number; children: ReactNode }) {
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
      <span aria-hidden="true" data-picodash-achieved-pointer />
      <span data-picodash-achieved-readout>{children}</span>
    </span>
  )
}

export function TargetSlider({
  result,
  value,
  inputValue,
  formatValue,
  onChange,
  min = 0,
  max = 100,
  step = 0.01,
  marks,
  ...props
}: TargetSliderProps) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max)
    throw new TypeError('TargetSlider requires a finite increasing scale.')
  if (!Number.isFinite(step) || step <= 0) throw new TypeError('step must be finite and positive.')
  if (marks?.some((mark) => !Number.isFinite(mark.value) || mark.value < min || mark.value > max))
    throw new TypeError('marks must be finite and within the scale.')
  validateSliderOptions(min, max, step, { allowedRange: props.allowedRange })
  const achieved =
    result.status === 'ready'
      ? result.value
      : result.status === 'pending'
        ? result.lastValue
        : undefined
  if (achieved !== undefined && !Number.isFinite(achieved))
    throw new TypeError('Achieved values must be finite.')
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
        {result.status === 'pending' ? 'Previous ' : ''}
        {formatted(achieved)}
      </>
    )
  const status =
    result.status === 'pending'
      ? 'Calculating'
      : result.status === 'no-fit'
        ? (result.message ?? 'No feasible result')
        : result.status === 'error'
          ? result.message
          : ''
  const description =
    [props['aria-describedby'], marks?.length ? marksId : undefined].filter(Boolean).join(' ') ||
    undefined
  const label = props['aria-labelledby'] ? `${prefix} ${props['aria-labelledby']}` : undefined
  return (
    <div className="picodash-dashstack-target-slider" data-result={result.status}>
      <span id={prefix} className="picodash-visually-hidden">
        Target
      </span>
      <NumberField
        id={props.id}
        value={inputValue === null ? Number.NaN : (inputValue ?? value)}
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
      <div data-picodash-target-track>
        <SliderTrackAccessoryContext.Provider
          value={
            achieved !== undefined && !achievedOutside ? (
              <AchievedMarker
                key={`${min}:${max}`}
                position={((achieved - min) / (max - min)) * 100}
              >
                {readout}
              </AchievedMarker>
            ) : null
          }
        >
          {mismatch ? (
            <div className="picodash-dashstack-slider">
              <div className="picodash-dashstack-slider-track">
                {achieved !== undefined && !achievedOutside ? (
                  <AchievedMarker
                    key={`${min}:${max}`}
                    position={((achieved - min) / (max - min)) * 100}
                  >
                    {readout}
                  </AchievedMarker>
                ) : null}
              </div>
            </div>
          ) : (
            <Slider
              {...props}
              id={undefined}
              value={value}
              min={min}
              max={max}
              step={step}
              marks={marks}
              onChange={onChange}
              disabled={props.disabled}
              aria-label={label ? undefined : `Target ${props['aria-label'] ?? 'value'}`}
              aria-labelledby={label}
              aria-describedby={description}
            />
          )}
        </SliderTrackAccessoryContext.Provider>
      </div>
      {mismatch ? (
        <p data-picodash-target-warning>
          Target {formatted(value)} is outside the configured interval or step.
        </p>
      ) : null}
      {achieved !== undefined ? (
        <output
          aria-label="Achieved"
          aria-live="off"
          className={achievedOutside ? undefined : 'picodash-visually-hidden'}
        >
          {readout}
          {achievedOutside ? ' · outside scale' : ''}
        </output>
      ) : null}
      {status ? <span role="status">{status}</span> : null}
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

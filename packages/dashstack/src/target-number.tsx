'use client'

import { useId, type ReactNode } from 'react'
import { NumberField, type NumberFieldProps } from './ui.js'
import { targetResultValue, targetResultMessage, type TargetResult } from './target-result.js'

export type TargetNumberResult = TargetResult
export type TargetNumberProps = NumberFieldProps & {
  readonly result: TargetNumberResult
  readonly targetLabel?: string
  readonly actualLabel?: string
  readonly formatValue?: (value: number) => ReactNode
}

/** Two fields with one editable target and one application-owned actual result. */
export function TargetNumber({
  result,
  targetLabel = 'Target',
  actualLabel = 'Actual',
  formatValue,
  unit,
  ...props
}: TargetNumberProps) {
  const id = useId()
  const targetId = `${id}-target`
  const actualId = `${id}-actual`
  const statusId = `${id}-status`
  const actual = targetResultValue(result)
  const message = targetResultMessage(result)
  const name = props['aria-label'] ?? 'value'
  return (
    <div
      className="picodash-dashstack-target-number"
      data-result={result.status}
      data-disabled={props.disabled || undefined}
      aria-busy={result.status === 'pending'}
    >
      <div data-picodash-target-number-field>
        <span id={targetId} data-picodash-target-field-label>
          {targetLabel}
        </span>
        <NumberField
          {...props}
          unit={unit}
          aria-label={props['aria-labelledby'] ? undefined : `${targetLabel} ${name}`}
          aria-labelledby={
            props['aria-labelledby'] ? `${targetId} ${props['aria-labelledby']}` : undefined
          }
        />
      </div>
      <div data-picodash-target-number-field>
        <span id={actualId} data-picodash-target-field-label>
          {actualLabel}
        </span>
        <output
          className="picodash-dashstack-control"
          data-picodash-target-actual
          aria-label={props['aria-labelledby'] ? undefined : `${actualLabel} ${name}`}
          aria-labelledby={
            props['aria-labelledby'] ? `${actualId} ${props['aria-labelledby']}` : undefined
          }
          aria-describedby={message ? statusId : undefined}
          aria-live="off"
        >
          <span>
            {actual === undefined
              ? '—'
              : formatValue
                ? formatValue(actual)
                : props.formatOptions
                  ? new Intl.NumberFormat(undefined, props.formatOptions).format(actual)
                  : String(Number(actual.toFixed(6)))}
          </span>
          {unit && actual !== undefined ? <span data-picodash-number-unit>{unit}</span> : null}
        </output>
      </div>
      <span id={statusId} className="picodash-visually-hidden" role="status">
        {message}
      </span>
    </div>
  )
}

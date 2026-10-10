'use client'
import { useId } from 'react'
import { useLocale } from 'react-aria-components'
import { AchievedMarker } from './achieved-marker.js'
import { targetResultValue, targetResultMessage } from './target-result.js'
import type { RangeSliderProps } from './ui-values.js'

// Results are readouts, not edits: even a value outside the selected interval is truthful.
export function useRangeResult({
  result,
  formatResult,
  formatOptions,
  min,
  max,
  startDetent,
  endDetent,
}: Pick<
  RangeSliderProps,
  'result' | 'formatResult' | 'formatOptions' | 'startDetent' | 'endDetent'
> & {
  min: number
  max: number
}) {
  const id = useId()
  const { locale } = useLocale()
  if (!result) return { id: undefined, marker: null, description: null }
  const value = targetResultValue(result)
  const atStart = value !== undefined && value === startDetent?.value
  const atEnd = value !== undefined && value === endDetent?.value
  const outside = value !== undefined && !atStart && !atEnd && (value < min || value > max)
  const readout =
    value === undefined
      ? null
      : formatResult
        ? formatResult(value)
        : atStart
          ? startDetent?.label
          : atEnd
            ? endDetent?.label
            : new Intl.NumberFormat(locale, formatOptions).format(value)
  const status = targetResultMessage(result)
  const position = atStart
    ? 0
    : atEnd
      ? 100
      : value === undefined || min === max
        ? 50
        : ((value - min) / (max - min)) * 100
  return {
    id,
    marker:
      value !== undefined && !outside ? (
        <span data-picodash-range-result-scale={atStart || atEnd ? 'detent' : 'numeric'}>
          <AchievedMarker
            key={`${min}:${max}:${startDetent?.value}:${endDetent?.value}`}
            position={position}
          >
            {readout}
          </AchievedMarker>
        </span>
      ) : (
        <span data-picodash-range-result-message aria-hidden="true">
          {outside ? (
            <>{readout} · outside scale</>
          ) : result.status === 'no-fit' ? (
            'No match'
          ) : result.status === 'error' ? (
            'Unavailable'
          ) : (
            '—'
          )}
        </span>
      ),
    description: (
      <span id={id} className="picodash-visually-hidden">
        {value !== undefined ? (
          <>
            Actual:{' '}
            <output aria-label="Actual" aria-live="off">
              {readout}
              {outside ? ' · outside scale' : ''}
            </output>
          </>
        ) : null}
        <span role="status">{status}</span>
      </span>
    ),
  }
}

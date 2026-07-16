import type { NormalizedControl } from '../types.js'

const numberFormatCache = new Map<string, Intl.NumberFormat>()
const maxNumberFormatCacheSize = 64

function numberFormatKey(formatOptions: Intl.NumberFormatOptions) {
  return Object.entries(formatOptions)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${String(value)}`)
    .join('|')
}

function formatNumber(value: number, formatOptions: Intl.NumberFormatOptions) {
  const key = numberFormatKey(formatOptions)
  let formatter = numberFormatCache.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(undefined, formatOptions)
    if (numberFormatCache.size >= maxNumberFormatCacheSize) {
      const oldestKey = numberFormatCache.keys().next().value
      if (oldestKey !== undefined) numberFormatCache.delete(oldestKey)
    }
    numberFormatCache.set(key, formatter)
  }
  return formatter.format(value)
}

/**
 * Formats a display control's value for rendering. Numbers honor the control's
 * `formatOptions` (Intl.NumberFormatOptions); strings are used verbatim. A
 * `format` template (e.g. "Total: {value}") then wraps the result if present.
 */
export function formatDisplayValue(control: NormalizedControl): string {
  const value = control.value
  let formatted: string
  if (typeof value === 'number') {
    formatted = control.formatOptions ? formatNumber(value, control.formatOptions) : String(value)
  } else {
    formatted = typeof value === 'string' ? value : ''
  }
  return control.format ? control.format.replace('{value}', formatted) : formatted
}

export function formatSliderValue(control: NormalizedControl): string {
  const value = typeof control.value === 'number' ? control.value : Number(control.value)
  const digits = fractionDigitsForStep(control.step ?? 0.01)
  const formatOptions = sliderFormatOptions(control.formatOptions, digits)

  return formatNumber(Number.isFinite(value) ? value : 0, formatOptions)
}

function sliderFormatOptions(
  formatOptions: Intl.NumberFormatOptions | undefined,
  inferredFractionDigits: number,
) {
  const next = { ...formatOptions }
  if (next.minimumFractionDigits === undefined && next.maximumFractionDigits === undefined) {
    next.minimumFractionDigits = inferredFractionDigits
    next.maximumFractionDigits = inferredFractionDigits
  } else if (next.minimumFractionDigits !== undefined && next.maximumFractionDigits === undefined) {
    next.maximumFractionDigits = Math.max(next.minimumFractionDigits, inferredFractionDigits)
  }
  return next
}

function fractionDigitsForStep(step: number) {
  if (!Number.isFinite(step) || step <= 0) return 2

  const text = String(step).toLowerCase()
  const [coefficient, exponentPart] = text.split('e-')
  if (exponentPart) {
    const exponent = Number(exponentPart)
    const coefficientDigits = coefficient.includes('.') ? coefficient.split('.')[1]!.length : 0
    return Math.min(20, Math.max(0, exponent + coefficientDigits))
  }

  if (!text.includes('.')) return 0
  return Math.min(20, text.split('.')[1]!.length)
}

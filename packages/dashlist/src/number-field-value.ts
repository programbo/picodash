import { NumberParser } from '@internationalized/number'

const IGNORABLE_NUMBER_MARK = /[\s\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u

type ParsedExponent = {
  readonly exponent: number
  readonly suffix: string
}

type LocatedExponent = ParsedExponent & {
  readonly index: number
  readonly separator: string
}

function exponentSeparators(
  input: string,
  locale: string,
  formatOptions: Intl.NumberFormatOptions | undefined,
): readonly string[] {
  const localized = new Intl.NumberFormat(locale, { notation: 'scientific' })
    .formatToParts(1e3)
    .find((part) => part.type === 'exponentSeparator')?.value
  const usesScientificNotation = ['scientific', 'engineering'].includes(
    formatOptions?.notation ?? '',
  )
  const hasAsciiExponent = /[eE][+-]?\d/u.test(input)
  return [
    ...(usesScientificNotation && localized ? [localized] : []),
    ...(usesScientificNotation || hasAsciiExponent ? ['e', 'E'] : []),
  ]
}

function parseLocalizedExponent(input: string, locale: string): ParsedExponent | null {
  const digitFormatter = new Intl.NumberFormat(locale, { useGrouping: false })
  const digits = Array.from({ length: 10 }, (_, digit) => digitFormatter.format(digit))
  const minusSign = new Intl.NumberFormat(locale, { notation: 'scientific' })
    .formatToParts(1e-3)
    .find((part) => part.type === 'exponentMinusSign')?.value
  let index = 0
  let sign = 1
  let normalized = ''

  while (index < input.length && IGNORABLE_NUMBER_MARK.test(input[index]!)) index += 1
  if (input.startsWith('-', index) || (minusSign && input.startsWith(minusSign, index))) {
    sign = -1
    index += input.startsWith('-', index) ? 1 : minusSign!.length
  } else if (input.startsWith('+', index)) index += 1

  while (index < input.length) {
    if (IGNORABLE_NUMBER_MARK.test(input[index]!)) {
      index += 1
      continue
    }
    const digit = digits.findIndex((candidate) => input.startsWith(candidate, index))
    if (digit < 0) break
    normalized += String(digit)
    index += digits[digit]!.length
  }

  if (!normalized) return null
  return { exponent: sign * Number(normalized), suffix: input.slice(index) }
}

function findExponent(
  input: string,
  locale: string,
  formatOptions: Intl.NumberFormatOptions | undefined,
): LocatedExponent | null {
  let found: LocatedExponent | null = null
  for (const separator of new Set(exponentSeparators(input, locale, formatOptions))) {
    let index = input.indexOf(separator)
    while (index >= 0) {
      const parsed = parseLocalizedExponent(input.slice(index + separator.length), locale)
      if (parsed && (!found || index < found.index)) found = { ...parsed, index, separator }
      index = input.indexOf(separator, index + separator.length)
    }
  }
  return found
}

function parseFormattedNumber(
  input: string,
  locale: string,
  formatOptions: Intl.NumberFormatOptions | undefined,
  parser: NumberParser,
): number {
  const exponent = findExponent(input, locale, formatOptions)
  if (!exponent)
    return exponentSeparators(input, locale, formatOptions).some((separator) =>
      input.includes(separator),
    )
      ? Number.NaN
      : parser.parse(input)
  const baseOptions = { ...formatOptions, notation: 'standard' as const }
  const baseParser = new NumberParser(locale, baseOptions)
  const base = baseParser.parse(input.slice(0, exponent.index) + exponent.suffix)
  return Number(`${base}e${exponent.exponent}`)
}

export function createNumberFieldValueAdapter(
  locale: string,
  formatOptions: Intl.NumberFormatOptions | undefined,
): {
  readonly parse: (input: string) => number
  readonly normalize: (input: string) => number
} {
  const options = { ...formatOptions }
  const parser = new NumberParser(locale, options)
  const formatter = new Intl.NumberFormat(locale, options)
  const parse = (input: string) => parseFormattedNumber(input, locale, formatOptions, parser)
  return {
    parse,
    normalize: (input) => {
      const parsed = parse(input)
      return Number.isFinite(parsed) ? parse(formatter.format(parsed)) : Number.NaN
    },
  }
}

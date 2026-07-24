export function formatNumericValue(
  value: number,
  {
    formatOptions,
    step = 1,
  }: {
    formatOptions?: Intl.NumberFormatOptions
    step?: number
  } = {},
) {
  return new Intl.NumberFormat(undefined, numberFormatOptions(value, step, formatOptions)).format(
    value,
  )
}

function numberFormatOptions(
  value: number,
  step: number,
  formatOptions: Intl.NumberFormatOptions | undefined,
) {
  if (hasExplicitPrecision(formatOptions)) return formatOptions

  const inferredMaximumFractionDigits = Math.max(fractionDigits(value), fractionDigits(step))

  return {
    ...formatOptions,
    maximumFractionDigits: Math.min(inferredMaximumFractionDigits, 100),
  } satisfies Intl.NumberFormatOptions
}

function hasExplicitPrecision(formatOptions: Intl.NumberFormatOptions | undefined) {
  return (
    formatOptions?.maximumFractionDigits !== undefined ||
    formatOptions?.minimumFractionDigits !== undefined ||
    formatOptions?.maximumSignificantDigits !== undefined ||
    formatOptions?.minimumSignificantDigits !== undefined
  )
}

function fractionDigits(value: number) {
  if (!Number.isFinite(value)) return 0

  const text = value.toString().toLowerCase()
  const [coefficient, exponentPart] = text.split('e')
  const exponent = exponentPart ? Number(exponentPart) : 0
  const decimalPlaces = coefficient?.split('.')[1]?.length ?? 0
  return Math.max(0, decimalPlaces - exponent)
}

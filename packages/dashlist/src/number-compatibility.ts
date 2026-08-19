function stepPrecision(step: number): number {
  let precision = 0
  const stepString = step.toString()
  const exponentIndex = stepString.toLowerCase().indexOf('e-')

  if (exponentIndex > 0)
    precision = Math.abs(Math.floor(Math.log10(Math.abs(step)))) + exponentIndex
  else {
    const pointIndex = stepString.indexOf('.')
    if (pointIndex >= 0) precision = stepString.length - pointIndex
  }

  return precision
}

export function isStepPrecisionScalable(step: number): boolean {
  return Number.isFinite(Math.pow(10, stepPrecision(step)))
}

type DecimalInteger = {
  readonly coefficient: bigint
  readonly exponent: number
}

function decimalInteger(value: number): DecimalInteger {
  const [mantissa, exponentText = '0'] = Math.abs(value).toString().toLowerCase().split('e')
  const [whole, fraction = ''] = mantissa!.split('.')
  const sign = value < 0 ? -1n : 1n
  return {
    coefficient: sign * BigInt(`${whole}${fraction}`),
    exponent: Number(exponentText) - fraction.length,
  }
}

function alignDecimalIntegers(values: readonly number[]): {
  readonly coefficients: readonly bigint[]
  readonly exponent: number
} {
  const decimals = values.map(decimalInteger)
  const exponent = Math.min(...decimals.map((value) => value.exponent))
  return {
    coefficients: decimals.map(
      (value) => value.coefficient * 10n ** BigInt(value.exponent - exponent),
    ),
    exponent,
  }
}

function numberFromDecimalInteger(coefficient: bigint, exponent: number): number {
  return Number(`${coefficient}e${exponent}`)
}

export function addUnscaledStep(
  value: number,
  step: number,
  direction: 'increment' | 'decrement',
): number {
  const { coefficients, exponent } = alignDecimalIntegers([value, step])
  const [valueCoefficient, stepCoefficient] = coefficients
  return numberFromDecimalInteger(
    direction === 'increment'
      ? valueCoefficient! + stepCoefficient!
      : valueCoefficient! - stepCoefficient!,
    exponent,
  )
}

function snapNumberToUnscaledStep(
  value: number,
  min: number | undefined,
  max: number | undefined,
  step: number,
): number {
  const anchor = min ?? 0
  const values = max === undefined ? [value, anchor, step] : [value, anchor, step, max]
  const { coefficients, exponent } = alignDecimalIntegers(values)
  const [valueCoefficient, anchorCoefficient, stepCoefficient, maxCoefficient] = coefficients
  const delta = valueCoefficient! - anchorCoefficient!
  const remainder = delta % stepCoefficient!
  let stepCount = delta / stepCoefficient!
  if ((remainder < 0n ? -remainder : remainder) * 2n >= stepCoefficient!)
    stepCount += remainder < 0n ? -1n : 1n
  let snapped = anchorCoefficient! + stepCount * stepCoefficient!

  if (min !== undefined && snapped < anchorCoefficient!) snapped = anchorCoefficient!
  if (maxCoefficient !== undefined && snapped > maxCoefficient) {
    const available = maxCoefficient - anchorCoefficient!
    snapped = anchorCoefficient! + (available / stepCoefficient!) * stepCoefficient!
  }

  const result = numberFromDecimalInteger(snapped, exponent)
  return result === 0 && Object.is(value, -0) ? -0 : result
}

function roundToStepPrecision(value: number, step: number): number {
  const precision = stepPrecision(step)

  if (precision === 0) return value
  const power = Math.pow(10, precision)
  if (!Number.isFinite(power)) return value
  return Math.round(value * power) / power
}

/** Mirrors the installed React Stately step algorithm without importing a private module. */
export function snapNumberToStep(
  value: number,
  min: number | undefined,
  max: number | undefined,
  step: number,
): number {
  if (!isStepPrecisionScalable(step)) return snapNumberToUnscaledStep(value, min, max, step)
  const numericMin = Number(min)
  const numericMax = Number(max)
  const anchor = Number.isNaN(numericMin) ? 0 : numericMin
  const remainder = (value - anchor) % step
  let snappedValue = roundToStepPrecision(
    Math.abs(remainder) * 2 >= step
      ? value + Math.sign(remainder) * (step - Math.abs(remainder))
      : value - remainder,
    step,
  )

  if (!Number.isNaN(numericMin)) {
    if (snappedValue < numericMin) snappedValue = numericMin
    else if (!Number.isNaN(numericMax) && snappedValue > numericMax)
      snappedValue =
        numericMin + Math.floor(roundToStepPrecision((numericMax - numericMin) / step, step)) * step
  } else if (!Number.isNaN(numericMax) && snappedValue > numericMax)
    snappedValue = Math.floor(roundToStepPrecision(numericMax / step, step)) * step

  return roundToStepPrecision(snappedValue, step)
}

export function isNumberCompatible(
  value: number,
  min: number | undefined,
  max: number | undefined,
  step: number | undefined,
): boolean {
  if (!Number.isFinite(value)) return false
  if (min !== undefined && value < min) return false
  if (max !== undefined && value > max) return false
  if (step === undefined) return true

  // Equality intentionally treats +0 and -0 as the same canonical JSON number.
  return snapNumberToStep(value, min, max, step) === value
}

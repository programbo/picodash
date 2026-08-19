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

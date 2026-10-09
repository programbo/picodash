import { isNumberCompatible } from './number-compatibility.js'

export type SliderDetent = {
  /** Numeric sentinel outside the interval. Values in the intervening gap are never emitted. */
  readonly value: number
  readonly label: string
}

export type SliderOptions = {
  readonly startDetent?: SliderDetent
  readonly endDetent?: SliderDetent
  /** Interactive bounds within the unchanged min/max track scale. */
  readonly allowedRange?: { readonly min: number; readonly max: number }
  /** Fill from this value, using accent above it and danger below it. */
  readonly fillOrigin?: number
}

export function validateSliderOptions(
  min: number,
  max: number,
  step: number,
  { allowedRange, fillOrigin, startDetent, endDetent }: SliderOptions,
): void {
  for (const [detent, bound, start] of [
    [startDetent, min, true],
    [endDetent, max, false],
  ] as const) {
    if (
      detent &&
      (!Number.isFinite(detent.value) ||
        (start ? detent.value >= bound : detent.value <= bound) ||
        !detent.label.trim())
    )
      throw new TypeError(
        'Detents require a finite value outside their endpoint and a nonempty label.',
      )
  }
  if (startDetent || endDetent) {
    if (allowedRange || fillOrigin !== undefined)
      throw new TypeError('Detents cannot be combined with allowedRange or fillOrigin.')
    if (!Number.isSafeInteger(Math.ceil((max - min) / step) + 2))
      throw new TypeError('Detents require a safely representable number of steps.')
  }
  if (allowedRange) {
    if (
      !Number.isFinite(allowedRange.min) ||
      !Number.isFinite(allowedRange.max) ||
      allowedRange.min < min ||
      allowedRange.max > max ||
      allowedRange.min > allowedRange.max ||
      !isNumberCompatible(allowedRange.min, min, max, step) ||
      !isNumberCompatible(allowedRange.max, min, max, step)
    )
      throw new TypeError('allowedRange must be ordered, inside min/max, and aligned to step.')
  }
  if (
    fillOrigin !== undefined &&
    (!Number.isFinite(fillOrigin) || fillOrigin < min || fillOrigin > max)
  )
    throw new TypeError('fillOrigin must be finite and within the slider bounds.')
}

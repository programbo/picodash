import { isNumberCompatible } from './number-compatibility.js'

export type SliderOptions = {
  /** Interactive bounds within the unchanged min/max track scale. */
  readonly allowedRange?: { readonly min: number; readonly max: number }
  /** Fill from this value, using accent above it and danger below it. */
  readonly fillOrigin?: number
}

export function validateSliderOptions(
  min: number,
  max: number,
  step: number,
  { allowedRange, fillOrigin }: SliderOptions,
): void {
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

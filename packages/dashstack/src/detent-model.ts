import { snapNumberToStep } from './number-compatibility.js'
import type { SliderDetent } from './slider-options.js'

export type DetentScale = {
  min: number
  max: number
  step: number
  startDetent?: SliderDetent
  endDetent?: SliderDetent
}
export type DetentPhase = 'start' | 'range' | 'end'
export function detentLastValue(scale: DetentScale) {
  return snapNumberToStep(scale.max, scale.min, scale.max, scale.step)
}
export function detentPhase(value: number, scale: DetentScale): DetentPhase {
  return value === scale.startDetent?.value
    ? 'start'
    : value === scale.endDetent?.value
      ? 'end'
      : 'range'
}
export function detentIndex(value: number, scale: DetentScale): number {
  if (value === scale.startDetent?.value) return 0
  if (value === scale.endDetent?.value) return detentIndex(detentLastValue(scale), scale) + 1
  return (scale.startDetent ? 1 : 0) + Math.round((value - scale.min) / scale.step)
}
export function detentValue(index: number, scale: DetentScale): number {
  if (scale.startDetent && index <= 0) return scale.startDetent.value
  if (scale.endDetent && index > detentIndex(detentLastValue(scale), scale))
    return scale.endDetent.value
  return snapNumberToStep(
    scale.min + (index - (scale.startDetent ? 1 : 0)) * scale.step,
    scale.min,
    scale.max,
    scale.step,
  )
}
export function detentKey(
  value: number,
  key: string,
  repeat: boolean,
  rtl: boolean,
  scale: DetentScale,
): number | undefined {
  if (key === 'Home') return scale.startDetent?.value ?? scale.min
  if (key === 'End') return scale.endDetent?.value ?? detentLastValue(scale)
  const direction =
    key === 'ArrowUp' || key === (rtl ? 'ArrowLeft' : 'ArrowRight') || key === 'PageUp'
      ? 1
      : key === 'ArrowDown' || key === (rtl ? 'ArrowRight' : 'ArrowLeft') || key === 'PageDown'
        ? -1
        : 0
  if (!direction) return undefined
  if (direction < 0 && value === scale.min)
    return repeat ? value : (scale.startDetent?.value ?? value)
  if (direction > 0 && value === detentLastValue(scale))
    return repeat ? value : (scale.endDetent?.value ?? value)
  if (value === scale.startDetent?.value) return direction > 0 ? scale.min : value
  if (value === scale.endDetent?.value) return direction < 0 ? detentLastValue(scale) : value
  const steps = key.startsWith('Page') ? 10 : 1
  const index = Math.max(
    detentIndex(scale.min, scale),
    Math.min(
      detentIndex(detentLastValue(scale), scale),
      detentIndex(value, scale) + direction * steps,
    ),
  )
  return detentValue(index, scale)
}
export function detentGeometry(width: number, scale: DetentScale) {
  const gap = Math.min(24, width * 0.3)
  return { gap, start: scale.startDetent ? gap : 0, end: width - (scale.endDetent ? gap : 0) }
}
export function detentPosition(value: number, width: number, scale: DetentScale) {
  if (value === scale.startDetent?.value) return 0
  if (value === scale.endDetent?.value) return width
  const { start, end } = detentGeometry(width, scale)
  return (
    start +
    (end - start) * (scale.max === scale.min ? 0 : (value - scale.min) / (scale.max - scale.min))
  )
}
/** Pixel-domain hysteresis never becomes an intermediate numeric value. */
export function detentPointer(
  position: number,
  width: number,
  phase: DetentPhase,
  scale: DetentScale,
) {
  const { gap, start, end } = detentGeometry(width, scale)
  const threshold = (gap * 2) / 3
  if (scale.startDetent && position < (phase === 'start' ? threshold : start - threshold))
    return {
      phase: 'start' as const,
      value: scale.startDetent.value,
      pull: Math.max(0, Math.min(threshold, position)) / 4,
    }
  if (scale.endDetent && position > (phase === 'end' ? width - threshold : end + threshold))
    return {
      phase: 'end' as const,
      value: scale.endDetent.value,
      pull: -Math.max(0, Math.min(threshold, width - position)) / 4,
    }
  const ratio = Math.max(0, Math.min(1, (position - start) / Math.max(1, end - start)))
  return {
    phase: 'range' as const,
    value: snapNumberToStep(
      scale.min + ratio * (scale.max - scale.min),
      scale.min,
      scale.max,
      scale.step,
    ),
    pull:
      (position < start && scale.startDetent
        ? position - start
        : position > end && scale.endDetent
          ? position - end
          : 0) / 4,
  }
}

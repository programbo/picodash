import type { JsonValue, NormalizedControl, TweakerControlRegistry } from '../types.js'
import { definitionForControl } from './definition.js'

export function clamp(value: number, min?: number, max?: number) {
  let next = value
  if (typeof min === 'number') next = Math.max(min, next)
  if (typeof max === 'number') next = Math.min(max, next)
  return next
}

function hasValue(values: Record<string, JsonValue>, id: string) {
  return Object.prototype.hasOwnProperty.call(values, id)
}

export function jsonValuesEqual(left: JsonValue, right: JsonValue) {
  return Object.is(left, right) || JSON.stringify(left) === JSON.stringify(right)
}

/**
 * Returns a value that is valid for the control's current configuration.
 *
 * Numbers/sliders are clamped to [min, max] so dynamic bounds changes can never
 * leave an out-of-range value. Selects whose current value is no longer in the
 * options list fall back to the default value (if still valid) or the first
 * option. Checkbox values are coerced to boolean. Custom controls are
 * JSON-opaque and returned unchanged.
 */
export function sanitizeValueForControl(control: NormalizedControl, value: JsonValue): JsonValue {
  return sanitizeValueWithRegistry(control, value)
}

export function sanitizeValueWithRegistry(
  control: NormalizedControl,
  value: JsonValue,
  registry?: TweakerControlRegistry,
): JsonValue {
  const definition = definitionForControl(control, registry)
  if (definition?.sanitize) return definition.sanitize(value, control)

  if (control.kind === 'number' || control.kind === 'slider') {
    const fallback = typeof control.defaultValue === 'number' ? control.defaultValue : 0
    const numeric = typeof value === 'number' && Number.isFinite(value) ? value : fallback
    return clamp(numeric, control.min, control.max)
  }

  if (control.kind === 'select') {
    const options = control.options ?? []
    const isValid = (candidate: unknown): candidate is string =>
      typeof candidate === 'string' && options.some((option) => option.value === candidate)
    if (isValid(value)) return value
    if (isValid(control.defaultValue)) return control.defaultValue
    return options[0]?.value ?? ''
  }

  if (control.kind === 'checkbox') {
    return typeof value === 'boolean' ? value : Boolean(control.defaultValue)
  }

  if (control.kind === 'display') {
    if (typeof value === 'number' || typeof value === 'string') return value
    return typeof control.defaultValue === 'number' || typeof control.defaultValue === 'string'
      ? control.defaultValue
      : ''
  }

  return value
}

export function valuesForControls(
  controls: NormalizedControl[],
  values: Record<string, JsonValue>,
): NormalizedControl[] {
  return controls.map((control) => {
    const value = valueForControl(control, values)
    return jsonValuesEqual(control.value, value) ? control : { ...control, value }
  })
}

export function valueForControl(
  control: NormalizedControl,
  values: Record<string, JsonValue>,
): JsonValue {
  // Display and transient values ignore stale persisted entries. Display values
  // derive from registration; transient values keep their in-memory state.
  if (control.valueMode === 'display') {
    return control.defaultValue
  }
  if (control.valueMode === 'transient') return control.value
  return hasValue(values, control.persistId) ? values[control.persistId]! : control.defaultValue
}

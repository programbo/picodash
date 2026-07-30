import type { PicodashJsonValue } from './types.js'

export function clonePicodashValue(
  value: PicodashJsonValue,
  seen = new Set<object>(),
): PicodashJsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Picodash values must contain finite numbers.')
    return value
  }

  if (typeof value !== 'object') {
    throw new TypeError('Picodash values must be JSON-compatible.')
  }

  if (seen.has(value)) throw new TypeError('Picodash values cannot contain circular references.')
  seen.add(value)

  try {
    if (Array.isArray(value)) {
      const clone: PicodashJsonValue[] = []
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) {
          throw new TypeError('Picodash values cannot contain sparse arrays.')
        }
        clone.push(clonePicodashValue(value[index]!, seen))
      }
      return clone
    }

    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('Picodash values must contain only plain objects.')
    }

    const clone: Record<string, PicodashJsonValue> = {}
    for (const [key, entry] of Object.entries(value)) {
      clone[key] = clonePicodashValue(entry, seen)
    }
    return clone
  } finally {
    seen.delete(value)
  }
}

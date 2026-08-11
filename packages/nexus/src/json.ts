import type { PicodashJsonValue } from './kernel/index.js'

/** Internal strict JSON clone used at Nexus trust boundaries. */
export function clonePicodashValue(
  value: PicodashJsonValue,
  seen = new Set<object>(),
): PicodashJsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Picodash values must contain finite numbers.')
    return Object.is(value, -0) ? 0 : value
  }
  if (typeof value !== 'object') throw new TypeError('Picodash values must be JSON-compatible.')
  if (seen.has(value)) throw new TypeError('Picodash values cannot contain circular references.')
  seen.add(value)
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) {
        throw new TypeError('Picodash values must contain only plain arrays.')
      }
      const descriptors = Object.getOwnPropertyDescriptors(value)
      const keys = Reflect.ownKeys(descriptors)
      for (const key of keys) {
        if (
          typeof key !== 'string' ||
          (key !== 'length' && (!/^0$|^[1-9]\d*$/.test(key) || Number(key) >= value.length))
        ) {
          throw new TypeError('Picodash arrays cannot contain extension properties.')
        }
        if (key !== 'length' && !descriptors[key]!.enumerable)
          throw new TypeError('Picodash arrays cannot contain non-enumerable indices.')
      }
      const clone: PicodashJsonValue[] = []
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = descriptors[String(index)]
        if (!descriptor || !('value' in descriptor))
          throw new TypeError('Picodash values cannot contain sparse arrays.')
        clone.push(clonePicodashValue(descriptor.value, seen))
      }
      return Object.freeze(clone)
    }
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null)
      throw new TypeError('Picodash values must contain only plain objects.')
    const clone = Object.create(null) as Record<string, PicodashJsonValue>
    for (const key of Reflect.ownKeys(Object.getOwnPropertyDescriptors(value))) {
      if (typeof key !== 'string')
        throw new TypeError('Picodash objects cannot contain symbol keys.')
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!
      if (!('value' in descriptor) || !descriptor.enumerable)
        throw new TypeError(
          'Picodash objects cannot contain accessors or non-enumerable properties.',
        )
      Object.defineProperty(clone, key, {
        value: clonePicodashValue(descriptor.value, seen),
        enumerable: true,
        writable: true,
        configurable: true,
      })
    }
    return Object.freeze(clone)
  } finally {
    seen.delete(value)
  }
}

export function picodashJsonEqual(left: PicodashJsonValue, right: PicodashJsonValue): boolean {
  if (typeof left === 'number' && typeof right === 'number')
    return Object.is(left, right) || (left === 0 && right === 0)
  if (Object.is(left, right)) return true
  if (Array.isArray(left) && Array.isArray(right))
    return (
      left.length === right.length && left.every((entry, i) => picodashJsonEqual(entry, right[i]!))
    )
  if (
    left &&
    right &&
    typeof left === 'object' &&
    typeof right === 'object' &&
    !Array.isArray(left) &&
    !Array.isArray(right)
  ) {
    const leftRecord = left as { readonly [key: string]: PicodashJsonValue }
    const rightRecord = right as { readonly [key: string]: PicodashJsonValue }
    const lk = Object.keys(leftRecord),
      rk = Object.keys(rightRecord)
    return (
      lk.length === rk.length &&
      lk.every(
        (key) =>
          Object.prototype.hasOwnProperty.call(right, key) &&
          picodashJsonEqual(leftRecord[key]!, rightRecord[key]!),
      )
    )
  }
  return false
}

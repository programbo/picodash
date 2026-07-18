import type {
  TweakerFieldOutput,
  TweakerParseResult,
  TweakerValidationContext,
} from '../tweaker-validation.js'
import type { TweakerValue } from '../tweaker-panel-types.js'

export type DistributiveOmit<TValue, TKeys extends PropertyKey> = TValue extends unknown
  ? Omit<TValue, Extract<keyof TValue, TKeys>>
  : never

export function canonicalTweakerValue<TValue extends TweakerValue>(
  input: unknown,
  value: TValue,
  error: string,
): TweakerParseResult<TValue> {
  return deepEqual(input, value)
    ? { output: { value }, success: true }
    : { errors: [error], repair: { value }, success: false }
}

export function unsetTweakerValue<TValue extends TweakerValue>(
  input: unknown,
  error: string,
): TweakerParseResult<TValue> {
  return input === undefined
    ? { output: { unset: true }, success: true }
    : { errors: [error], repair: { unset: true }, success: false }
}

export function invalidTweakerValue(error: string): {
  errors: readonly string[]
  success: false
}
export function invalidTweakerValue<TValue extends TweakerValue>(
  error: string,
  repair: TweakerFieldOutput<TValue>,
): TweakerParseResult<TValue>
export function invalidTweakerValue<TValue extends TweakerValue>(
  error: string,
  repair?: TweakerFieldOutput<TValue>,
): TweakerParseResult<TValue> | { errors: readonly string[]; success: false } {
  return repair === undefined
    ? { errors: [error], success: false }
    : { errors: [error], repair, success: false }
}

export function strictImportShape(
  context: TweakerValidationContext,
  matches: boolean,
  error: string,
) {
  return context.source === 'import' && !matches ? invalidTweakerValue(error) : undefined
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((entry, index) => deepEqual(entry, right[index]))
    )
  }
  if (!isRecord(left) || !isRecord(right)) return false
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) => Object.prototype.hasOwnProperty.call(right, key) && deepEqual(left[key], right[key]),
    )
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

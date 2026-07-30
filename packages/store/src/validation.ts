import type { StandardSchemaV1 } from '@standard-schema/spec'
import { clonePicodashValue } from './json.js'
import type {
  PicodashField,
  PicodashFieldDefinition,
  PicodashFieldOutput,
  PicodashJsonValue,
  PicodashValidationContext,
  PicodashValidationSource,
} from './types.js'

export type PicodashFieldResolution<TValue> =
  | { readonly output: PicodashFieldOutput<TValue>; readonly success: true }
  | {
      readonly errors: readonly string[]
      readonly repair?: PicodashFieldOutput<TValue>
      readonly success: false
    }

const unsupportedAsyncError =
  'Asynchronous parsers and validators are not supported. Return a synchronous result.'

export function resolvePicodashFieldValue<
  TValues extends object,
  TKey extends Extract<keyof TValues, string>,
>(
  definition: PicodashFieldDefinition<TValues[TKey]>,
  field: PicodashField<TValues, TKey>,
  input: unknown,
  source: PicodashValidationSource,
  currentValue: TValues[TKey] | undefined,
  defaultValue: TValues[TKey],
): PicodashFieldResolution<TValues[TKey]> {
  const context: PicodashValidationContext<TValues[TKey]> = {
    currentValue,
    defaultValue,
    field,
    source,
  }
  const attempt = runContract(definition, input, context)
  if (attempt.success || attempt.repair === undefined) return attempt

  const verified = resolveOutput(definition, attempt.repair, context)
  return verified.success
    ? { errors: attempt.errors, repair: verified.output, success: false }
    : { errors: uniqueErrors([...attempt.errors, ...verified.errors]), success: false }
}

function runContract<TValue>(
  definition: PicodashFieldDefinition<TValue>,
  input: unknown,
  context: PicodashValidationContext<TValue>,
): PicodashFieldResolution<TValue> {
  let parsed: unknown
  try {
    parsed =
      definition.parse === undefined
        ? { output: { value: input }, success: true }
        : definition.parse(input, context)
  } catch (error) {
    return { errors: [errorMessage(error, 'Parser failed.')], success: false }
  }

  if (isPromiseLike(parsed)) return { errors: [unsupportedAsyncError], success: false }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('success' in parsed) ||
    typeof parsed.success !== 'boolean'
  ) {
    return { errors: ['Parser returned an invalid result.'], success: false }
  }

  const result = parsed as Record<string, unknown> & { success: boolean }
  if (!result.success) {
    if (!isStringArray(result.errors)) {
      return { errors: ['Parser returned an invalid result.'], success: false }
    }
    if (result.repair !== undefined && !isFieldOutput(result.repair)) {
      return { errors: ['Parser returned an invalid result.'], success: false }
    }
    if (isUnset(result.repair) && !definition.allowUnset) {
      return { errors: ['Field does not allow unset values.'], success: false }
    }
    return {
      errors: normalizedErrors(result.errors, 'Value could not be parsed.'),
      repair: result.repair as PicodashFieldOutput<TValue> | undefined,
      success: false,
    }
  }

  if (!isFieldOutput(result.output)) {
    return { errors: ['Parser returned an invalid result.'], success: false }
  }
  return resolveOutput(definition, result.output as PicodashFieldOutput<TValue>, context)
}

function resolveOutput<TValue>(
  definition: PicodashFieldDefinition<TValue>,
  output: PicodashFieldOutput<TValue>,
  context: PicodashValidationContext<TValue>,
): PicodashFieldResolution<TValue> {
  if ('unset' in output) {
    return definition.allowUnset
      ? { output: { unset: true }, success: true }
      : { errors: ['Field does not allow unset values.'], success: false }
  }

  let cloned: PicodashJsonValue
  try {
    cloned = clonePicodashValue(output.value as PicodashJsonValue)
  } catch (error) {
    return { errors: [errorMessage(error, 'Value is not JSON-compatible.')], success: false }
  }
  if (definition.validate === undefined) {
    return { output: { value: cloned as never }, success: true }
  }

  const validated = runValidator(definition.validate, cloned, context)
  return validated.success
    ? { output: { value: validated.value as never }, success: true }
    : validated
}

function runValidator<TValue>(
  validator: NonNullable<PicodashFieldDefinition<TValue>['validate']>,
  value: PicodashJsonValue,
  context: PicodashValidationContext<TValue>,
):
  | { readonly success: true; readonly value: PicodashJsonValue }
  | {
      readonly errors: readonly string[]
      readonly success: false
    } {
  try {
    if (typeof validator === 'function') {
      const result = validator(value as TValue, context)
      if (isPromiseLike(result)) return { errors: [unsupportedAsyncError], success: false }
      if (
        typeof result !== 'object' ||
        result === null ||
        !('success' in result) ||
        typeof result.success !== 'boolean'
      ) {
        return { errors: ['Validator returned an invalid result.'], success: false }
      }
      if (result.success) return { success: true, value }
      if (!isStringArray(result.errors)) {
        return { errors: ['Validator returned an invalid result.'], success: false }
      }
      return {
        errors: normalizedErrors(result.errors, 'Value is invalid.'),
        success: false,
      }
    }

    const standard = (validator as StandardSchemaV1)['~standard']
    if (standard === undefined || typeof standard.validate !== 'function') {
      return {
        errors: ['Validator must be a function or implement Standard Schema v1.'],
        success: false,
      }
    }
    const result = standard.validate(value)
    if (isPromiseLike(result)) return { errors: [unsupportedAsyncError], success: false }
    if (typeof result !== 'object' || result === null) {
      return { errors: ['Standard Schema validator returned an invalid result.'], success: false }
    }
    if ('issues' in result && result.issues !== undefined) {
      if (!Array.isArray(result.issues)) {
        return { errors: ['Standard Schema validator returned an invalid result.'], success: false }
      }
      return {
        errors: normalizedErrors(result.issues.map(formatStandardSchemaIssue), 'Value is invalid.'),
        success: false,
      }
    }
    if (!('value' in result)) {
      return { errors: ['Standard Schema validator returned an invalid result.'], success: false }
    }
    return { success: true, value: clonePicodashValue(result.value as PicodashJsonValue) }
  } catch (error) {
    return { errors: [errorMessage(error, 'Validator failed.')], success: false }
  }
}

function formatStandardSchemaIssue(issue: StandardSchemaV1.Issue) {
  if (typeof issue !== 'object' || issue === null || typeof issue.message !== 'string') {
    return 'Standard Schema validator returned an invalid issue.'
  }
  const path =
    issue.path === undefined
      ? ''
      : ` at ${issue.path
          .map((segment) =>
            String(typeof segment === 'object' && segment !== null ? segment.key : segment),
          )
          .join('.')}`
  return `${issue.message}${path}`
}

function normalizedErrors(errors: readonly string[], fallback: string) {
  const normalized = errors.map((error) => error.trim()).filter(Boolean)
  return normalized.length > 0 ? normalized : [fallback]
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

function isFieldOutput(value: unknown): value is PicodashFieldOutput<PicodashJsonValue> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const hasValue = Object.prototype.hasOwnProperty.call(value, 'value')
  const hasUnset = Object.prototype.hasOwnProperty.call(value, 'unset')
  if (hasValue === hasUnset) return false
  return hasValue || (value as Record<string, unknown>).unset === true
}

function isUnset(value: unknown): value is { readonly unset: true } {
  return isFieldOutput(value) && 'unset' in value
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    'then' in value &&
    typeof value.then === 'function'
  )
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}

function uniqueErrors(errors: readonly string[]) {
  return [...new Set(errors)]
}

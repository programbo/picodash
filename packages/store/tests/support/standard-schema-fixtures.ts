import type { StandardSchemaV1 } from '@standard-schema/spec'

export type StandardSchemaResult<T> =
  | { readonly value: T; readonly issues?: undefined }
  | { readonly issues: readonly StandardSchemaV1.Issue[] }

const defaultVendor = 'picodash-test-fixture'

/** Make a small Standard Schema v1 object without adding Store-specific behavior. */
export function syncStandardSchema<Output>(
  validate: (value: unknown) => StandardSchemaResult<Output>,
  vendor = defaultVendor,
): StandardSchemaV1<unknown, Output> {
  return {
    '~standard': {
      version: 1,
      vendor,
      validate: validate as StandardSchemaV1<unknown, Output>['~standard']['validate'],
    },
  }
}

export function asyncStandardSchema<Output>(
  validate: (
    value: unknown,
  ) => StandardSchemaResult<Output> | PromiseLike<StandardSchemaResult<Output>>,
  vendor = defaultVendor,
): StandardSchemaV1<unknown, Output> {
  return {
    '~standard': {
      version: 1,
      vendor,
      validate: validate as StandardSchemaV1<unknown, Output>['~standard']['validate'],
    },
  }
}

export function runStandardSchemaSynchronously<Input, Output>(
  schema: StandardSchemaV1<Input, Output>,
  value: Input,
): StandardSchemaV1.Result<Output> {
  const result = schema['~standard'].validate(value)
  if (isPromiseLike(result)) {
    throw new TypeError('Standard Schema fixture runner received an asynchronous result.')
  }
  return result
}

export function schemaSuccess<T>(value: T): StandardSchemaV1.SuccessResult<T> {
  return { value, issues: undefined }
}

export function schemaFailure(
  issues: readonly StandardSchemaV1.Issue[],
): StandardSchemaV1.FailureResult {
  return { issues }
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    'then' in value &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}

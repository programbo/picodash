import type { StandardSchemaV1 } from '@standard-schema/spec'
import type {
  PicodashItemRegistration,
  PicodashPanelState,
  PicodashPanelStore,
  PicodashValue,
} from '../state/panel/picodash-panel-types.js'

export type PicodashValidationSource =
  | 'interactive'
  | 'programmatic'
  | 'import'
  | 'initial'
  | 'constraint'
  | 'default'
  | 'reset'

export interface PicodashValidationContext {
  currentValue?: PicodashValue
  defaultValue?: PicodashValue
  field: string
  source: PicodashValidationSource
}

export type PicodashFieldOutput<T extends PicodashValue = PicodashValue> =
  | { value: T }
  | { unset: true }

export type PicodashParseResult<T extends PicodashValue = PicodashValue> =
  | { output: PicodashFieldOutput<T>; success: true }
  | {
      errors: readonly string[]
      repair?: PicodashFieldOutput<T>
      success: false
    }

export type PicodashValidationResult =
  | { success: true }
  | { errors: readonly string[]; success: false }

export type PicodashParser<T extends PicodashValue = PicodashValue> = (
  input: unknown,
  context: PicodashValidationContext,
) => PicodashParseResult<T>

export type PicodashFunctionValidator<T extends PicodashValue = PicodashValue> = (
  value: T,
  context: PicodashValidationContext,
) => PicodashValidationResult

export type PicodashStandardSchemaValidator<T extends PicodashValue = PicodashValue> =
  StandardSchemaV1<unknown, T>

export type PicodashValidator<T extends PicodashValue = PicodashValue> =
  | PicodashFunctionValidator<T>
  | PicodashStandardSchemaValidator<T>

export interface PicodashFieldContract<T extends PicodashValue = PicodashValue> {
  parse?: PicodashParser<T>
  validate?: PicodashValidator<T>
}

export type PicodashFieldResolution =
  | { output: PicodashFieldOutput; success: true }
  | {
      errors: readonly string[]
      repair?: PicodashFieldOutput
      success: false
    }

export interface PicodashWriteFailure {
  errors: Record<string, readonly string[]>
  success: false
}

export interface PicodashWriteSuccess {
  success: true
}

export type PicodashWriteResult = PicodashWriteFailure | PicodashWriteSuccess

export interface PicodashConstraintRepair {
  after: PicodashFieldOutput
  before: PicodashFieldOutput
  errors: readonly string[]
  field: string
}

export type PicodashConstraintAnalysis =
  | { status: 'valid' }
  | { errors: readonly string[]; status: 'invalid' }
  | { repair: PicodashConstraintRepair; status: 'repair' }

type ValidationState = Pick<PicodashPanelState, 'fields' | 'items' | 'values'>

interface ContractAttempt {
  errors: string[]
  output?: PicodashFieldOutput
  repair?: PicodashFieldOutput
}

const unsupportedAsyncError =
  'Asynchronous parsers and validators are not supported. Return a synchronous result.'

export function resolvePicodashFieldValue(
  state: ValidationState,
  field: string,
  input: unknown,
  source: PicodashValidationSource,
): PicodashFieldResolution {
  const context: PicodashValidationContext = {
    currentValue: state.values[field],
    defaultValue: state.fields[field]?.defaultValue,
    field,
    source,
  }
  const defaultConflict = defaultConflictError(state.items, field)
  if (defaultConflict !== undefined) {
    return { errors: [defaultConflict], success: false }
  }
  const contracts = contractsForField(state.items, field)
  if (contracts.length === 0) {
    const jsonError = jsonCompatibilityError(input)
    return jsonError === undefined
      ? { output: { value: input as PicodashValue }, success: true }
      : { errors: [jsonError], success: false }
  }

  const attempts = contracts.map((contract) => runContract(contract, input, context))
  const errors = attempts.flatMap((attempt) => attempt.errors)
  const outputs = attempts
    .map((attempt) => attempt.output)
    .filter((output): output is PicodashFieldOutput => output !== undefined)

  if (errors.length === 0) {
    const disagreement = outputDisagreement(outputs)
    return disagreement === undefined
      ? { output: outputs[0] ?? { value: input as PicodashValue }, success: true }
      : { errors: [disagreementMessage(field, 'canonical', disagreement)], success: false }
  }

  const repairs = attempts.map((attempt) => attempt.repair ?? attempt.output)
  if (repairs.some((repair) => repair === undefined)) {
    return { errors: uniqueErrors(errors), success: false }
  }
  const repairOutputs = repairs as PicodashFieldOutput[]
  const disagreement = outputDisagreement(repairOutputs)
  if (disagreement !== undefined) {
    return {
      errors: [...uniqueErrors(errors), disagreementMessage(field, 'repair', disagreement)],
      success: false,
    }
  }

  const repair = repairOutputs[0]
  if (repair === undefined) return { errors: uniqueErrors(errors), success: false }
  const verifiedRepair = resolveRepairAgainstContracts(contracts, repair, context)
  return verifiedRepair.success
    ? { errors: uniqueErrors(errors), repair: verifiedRepair.output, success: false }
    : {
        errors: uniqueErrors([...errors, ...verifiedRepair.errors]),
        success: false,
      }
}

export function analyzePicodashFieldConstraint(
  state: ValidationState,
  field: string,
  source: Extract<PicodashValidationSource, 'constraint' | 'default' | 'initial'> = 'constraint',
): PicodashConstraintAnalysis {
  const before: PicodashFieldOutput = Object.prototype.hasOwnProperty.call(state.values, field)
    ? { value: state.values[field]! }
    : { unset: true }
  if ('unset' in before) return { status: 'valid' }

  const resolution = resolvePicodashFieldValue(state, field, before.value, source)
  if (resolution.success) {
    return jsonValuesEqual(before, resolution.output)
      ? { status: 'valid' }
      : {
          repair: {
            after: resolution.output,
            before,
            errors: ['The current value must be normalized for the updated constraints.'],
            field,
          },
          status: 'repair',
        }
  }

  let repair = resolution.repair
  const defaultValue = state.fields[field]?.defaultValue
  if (repair === undefined && defaultValue !== undefined) {
    const defaultResolution = resolvePicodashFieldValue(state, field, defaultValue, 'default')
    if (defaultResolution.success) repair = defaultResolution.output
  }
  return repair === undefined
    ? { errors: resolution.errors, status: 'invalid' }
    : {
        repair: {
          after: repair,
          before,
          errors: resolution.errors,
          field,
        },
        status: 'repair',
      }
}

export function applyPicodashConstraintRepair(
  store: PicodashPanelStore,
  analysis: Extract<PicodashConstraintAnalysis, { status: 'repair' }>,
): PicodashWriteResult {
  const current = analyzePicodashFieldConstraint(store.getState(), analysis.repair.field)
  if (current.status === 'invalid') {
    return {
      errors: { [analysis.repair.field]: current.errors },
      success: false,
    }
  }
  if (
    current.status !== 'repair' ||
    !jsonValuesEqual(current.repair.before, analysis.repair.before) ||
    !jsonValuesEqual(current.repair.after, analysis.repair.after)
  ) {
    return {
      errors: {
        [analysis.repair.field]: [
          'Panel constraints or values changed while the repair was awaiting review.',
        ],
      },
      success: false,
    }
  }
  store
    .getState()
    .applyRegisteredFieldOutputs(
      { [analysis.repair.field]: current.repair.after },
      { preserveMeta: true },
    )
  return { success: true }
}

export function jsonValuesEqual(left: PicodashFieldOutput, right: PicodashFieldOutput) {
  if ('unset' in left || 'unset' in right) return 'unset' in left && 'unset' in right
  return deepJsonEqual(left.value, right.value)
}

export function jsonCompatibilityError(value: unknown, rootPath = '$'): string | undefined {
  const activeObjects = new WeakSet<object>()

  const visit = (candidate: unknown, path: string): string | undefined => {
    if (candidate === null || typeof candidate === 'string' || typeof candidate === 'boolean') {
      return undefined
    }
    if (typeof candidate === 'number') {
      return Number.isFinite(candidate) ? undefined : `Value at ${path} must be a finite number.`
    }
    if (typeof candidate !== 'object') return `Value at ${path} is not JSON-compatible.`
    const prototype = Object.getPrototypeOf(candidate)
    if (!Array.isArray(candidate) && prototype !== Object.prototype && prototype !== null) {
      return `Value at ${path} must be a plain object or array.`
    }
    if (activeObjects.has(candidate)) return `Value at ${path} contains a cycle.`

    activeObjects.add(candidate)
    let error: string | undefined
    if (Array.isArray(candidate)) {
      for (const [index, entry] of candidate.entries()) {
        error = visit(entry, `${path}[${index}]`)
        if (error !== undefined) break
      }
    } else {
      for (const [key, entry] of Object.entries(candidate)) {
        error = visit(entry, `${path}.${key}`)
        if (error !== undefined) break
      }
    }
    activeObjects.delete(candidate)
    return error
  }

  return visit(value, rootPath)
}

function contractsForField(
  items: Record<string, PicodashItemRegistration>,
  field: string,
): PicodashFieldContract[] {
  return Object.values(items)
    .filter(
      (item) => item.field === field && (item.parse !== undefined || item.validate !== undefined),
    )
    .map((item) => ({ parse: item.parse, validate: item.validate }))
}

function defaultConflictError(items: Record<string, PicodashItemRegistration>, field: string) {
  const defaults = Object.values(items)
    .filter((item) => item.field === field && item.defaultValue !== undefined)
    .map((item) => item.defaultValue!)
  const first = defaults[0]
  if (
    first === undefined ||
    defaults
      .slice(1)
      .every((defaultValue) => jsonValuesEqual({ value: first }, { value: defaultValue }))
  ) {
    return undefined
  }
  return `Field "${field}" has conflicting defaults across active items.`
}

function runContract(
  contract: PicodashFieldContract,
  input: unknown,
  context: PicodashValidationContext,
): ContractAttempt {
  let parsed: unknown
  try {
    parsed =
      contract.parse === undefined
        ? {
            output: { value: input as PicodashValue },
            success: true,
          }
        : contract.parse(input, context)
  } catch (error) {
    return { errors: [errorMessage(error, 'Parser failed.')] }
  }

  if (isPromiseLike(parsed)) return { errors: [unsupportedAsyncError] }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('success' in parsed) ||
    typeof parsed.success !== 'boolean'
  ) {
    return { errors: ['Parser returned an invalid result.'] }
  }
  const result = parsed as Record<string, unknown> & { success: boolean }
  if (!result.success) {
    if (!isStringArray(result.errors)) {
      return { errors: ['Parser returned an invalid result.'] }
    }
    if (result.repair !== undefined && !isPicodashFieldOutput(result.repair)) {
      return { errors: ['Parser returned an invalid result.'] }
    }
    return {
      errors: normalizedErrors(result.errors, 'Value could not be parsed.'),
      repair: result.repair,
    }
  }

  if (!isPicodashFieldOutput(result.output)) {
    return { errors: ['Parser returned an invalid result.'] }
  }
  const jsonError = outputJsonCompatibilityError(result.output)
  if (jsonError !== undefined) return { errors: [jsonError] }
  if ('unset' in result.output || contract.validate === undefined) {
    return { errors: [], output: result.output }
  }

  const validated = runValidator(contract.validate, result.output.value, context)
  return validated.success
    ? { errors: [], output: { value: validated.value } }
    : { errors: validated.errors }
}

function runValidator(
  validator: PicodashValidator,
  value: PicodashValue,
  context: PicodashValidationContext,
): { success: true; value: PicodashValue } | { errors: string[]; success: false } {
  try {
    if (typeof validator === 'function') {
      const result = validator(value, context)
      if (isPromiseLike(result)) return { errors: [unsupportedAsyncError], success: false }
      if (
        typeof result !== 'object' ||
        result === null ||
        !('success' in result) ||
        typeof result.success !== 'boolean'
      ) {
        return { errors: ['Validator returned an invalid result.'], success: false }
      }
      return result.success
        ? { success: true, value }
        : {
            errors: normalizedErrors(result.errors, 'Value is invalid.'),
            success: false,
          }
    }

    const standard = validator['~standard']
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
    if (result.issues !== undefined) {
      return {
        errors: result.issues.map(formatStandardSchemaIssue),
        success: false,
      }
    }
    const jsonError = jsonCompatibilityError(result.value)
    return jsonError === undefined
      ? { success: true, value: result.value as PicodashValue }
      : { errors: [jsonError], success: false }
  } catch (error) {
    return { errors: [errorMessage(error, 'Validator failed.')], success: false }
  }
}

function resolveRepairAgainstContracts(
  contracts: readonly PicodashFieldContract[],
  repair: PicodashFieldOutput,
  context: PicodashValidationContext,
): PicodashFieldResolution {
  if ('unset' in repair) return { output: repair, success: true }
  const attempts = contracts.map((contract) => runContract(contract, repair.value, context))
  const errors = attempts.flatMap((attempt) => attempt.errors)
  if (errors.length > 0) return { errors: uniqueErrors(errors), success: false }
  const outputs = attempts
    .map((attempt) => attempt.output)
    .filter((output): output is PicodashFieldOutput => output !== undefined)
  const disagreement = outputDisagreement(outputs)
  return disagreement === undefined
    ? { output: outputs[0] ?? repair, success: true }
    : { errors: [disagreementMessage(context.field, 'repair', disagreement)], success: false }
}

function outputDisagreement(outputs: readonly PicodashFieldOutput[]) {
  const first = outputs[0]
  if (first === undefined) return undefined
  return outputs.find((output) => !jsonValuesEqual(first, output))
}

function disagreementMessage(
  field: string,
  kind: 'canonical' | 'repair',
  output: PicodashFieldOutput,
) {
  return `Field "${field}" has conflicting ${kind} outputs (${formatOutput(output)}).`
}

function outputJsonCompatibilityError(output: PicodashFieldOutput) {
  return 'unset' in output ? undefined : jsonCompatibilityError(output.value)
}

function formatOutput(output: PicodashFieldOutput) {
  return 'unset' in output ? 'unset' : JSON.stringify(output.value)
}

function formatStandardSchemaIssue(issue: StandardSchemaV1.Issue) {
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
  return normalized.length > 0 ? [...normalized] : [fallback]
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

function isPicodashFieldOutput(value: unknown): value is PicodashFieldOutput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const hasValue = Object.prototype.hasOwnProperty.call(value, 'value')
  const hasUnset = Object.prototype.hasOwnProperty.call(value, 'unset')
  if (hasValue === hasUnset) return false
  return hasValue || (value as Record<string, unknown>).unset === true
}

function uniqueErrors(errors: readonly string[]) {
  return [...new Set(errors)]
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof value.then === 'function'
  )
}

function deepJsonEqual(left: PicodashValue, right: PicodashValue): boolean {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((entry, index) => deepJsonEqual(entry, right[index]!))
    )
  }
  if (
    typeof left === 'object' &&
    left !== null &&
    !Array.isArray(left) &&
    typeof right === 'object' &&
    right !== null &&
    !Array.isArray(right)
  ) {
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key) =>
          Object.prototype.hasOwnProperty.call(right, key) &&
          deepJsonEqual(left[key]!, right[key]!),
      )
    )
  }
  return false
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() !== '' ? error.message : fallback
}

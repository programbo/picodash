import type {
  PicodashField,
  PicodashItemBinding,
  PicodashItemBindingMode,
  PicodashItemRegistration,
  PicodashItemRegistrationError,
  PicodashRegisteredItem,
} from './types.js'
import { PICODASH_ERROR_CODES, createPicodashDiagnostic, type PicodashErrorCode } from './errors.js'
import {
  normalizePicodashPresentationContract,
  picodashPresentationAcceptsValue,
  picodashPresentationContractsCompatible,
  picodashPresentationContractsEqual,
  type PicodashPresentationFieldValues,
} from './presentation.js'

export const picodashRootItemId = 'root'

export function resolvePicodashItemRegistration<TValues extends object>(
  registration: PicodashItemRegistration<TValues>,
  ownsField: (field: unknown) => field is PicodashField<TValues, Extract<keyof TValues, string>>,
  registeredItems: Readonly<Record<string, PicodashRegisteredItem<TValues>>>,
  presentationContext?: {
    readonly fieldValues: (
      field: PicodashField<TValues, Extract<keyof TValues, string>>,
    ) => PicodashPresentationFieldValues
    readonly panelId: string
  },
):
  | { readonly item: PicodashRegisteredItem<TValues>; readonly success: true }
  | { readonly errors: readonly PicodashItemRegistrationError[]; readonly success: false } {
  const bindings = bindingEntries(registration)
  const errors: PicodashItemRegistrationError[] = []
  const seenFields = new Map<string, string>()
  const normalizedBindings: {
    alias: string
    binding: ReturnType<typeof normalizeBinding<TValues>>
  }[] = []

  for (const [alias, binding] of bindings) {
    const normalized = normalizeBinding(binding)
    if (!ownsField(normalized.field)) {
      const diagnostic = createRegistrationDiagnostic({
        alias,
        code: PICODASH_ERROR_CODES.INVALID_COMPOUND_MAP,
        correction: 'Use a field handle created by this Picodash Store.',
        expectedContract: 'Every item binding belongs to the Store registering the item.',
        itemId: registration.id,
        panelId: presentationContext?.panelId,
        summary: `Field binding "${alias}" belongs to a different Picodash Store.`,
      })
      errors.push({
        alias,
        code: 'foreign-field',
        diagnostic,
        itemId: registration.id,
        message: diagnostic.message,
      })
      continue
    }
    const presentation =
      normalized.presentation === undefined
        ? undefined
        : normalizePicodashPresentationContract(normalized.presentation)
    if (presentation === null) {
      const diagnostic = createRegistrationDiagnostic({
        alias,
        code: PICODASH_ERROR_CODES.INVALID_CONTRACT,
        component: presentationComponent(normalized.presentation),
        correction:
          'Use a JSON-only presentation contract with non-empty component/id values and a supported accepts descriptor.',
        expectedContract:
          'Presentation contracts contain only component, id, and a serializable accepts descriptor.',
        fieldKey: normalized.field.key,
        itemId: registration.id,
        panelId: presentationContext?.panelId,
        summary: 'The Dashlet presentation contract is malformed.',
      })
      errors.push({
        alias,
        code: 'invalid-presentation-contract',
        diagnostic,
        field: normalized.field.key,
        itemId: registration.id,
        message: diagnostic.message,
      })
      continue
    }
    normalizedBindings.push({
      alias,
      binding: { ...normalized, presentation: presentation ?? undefined },
    })

    const fieldKey = normalized.field.key
    const previousAlias = seenFields.get(fieldKey)
    if (previousAlias !== undefined) {
      const diagnostic = createRegistrationDiagnostic({
        alias,
        code: PICODASH_ERROR_CODES.DUPLICATE_BINDING,
        correction: `Remove alias "${alias}", or bind it to a different field.`,
        expectedContract: 'A compound item binds each field handle at most once.',
        fieldKey,
        itemId: registration.id,
        panelId: presentationContext?.panelId,
        summary: `Field "${fieldKey}" is already bound as "${previousAlias}" by this item.`,
      })
      errors.push({
        alias,
        code: 'duplicate-field-binding',
        diagnostic,
        field: fieldKey,
        itemId: registration.id,
        message: diagnostic.message,
      })
      continue
    }
    seenFields.set(fieldKey, alias)

    const conflictingItem = Object.values(registeredItems).find(
      (item) =>
        item.id !== registration.id &&
        item.bindings.some(
          (existing) => existing.field.key === fieldKey && existing.mode !== normalized.mode,
        ),
    )
    if (conflictingItem !== undefined) {
      const diagnostic = createRegistrationDiagnostic({
        alias,
        code: PICODASH_ERROR_CODES.CONFLICTING_BINDING,
        correction:
          'Use the same input/display mode for every Dashlet sharing this field, or bind a different field.',
        expectedContract: `Every mounted binding for field "${fieldKey}" uses one compatible mode.`,
        fieldKey,
        itemId: registration.id,
        panelId: presentationContext?.panelId,
        summary: `Field "${fieldKey}" has a conflicting mode on item "${conflictingItem.id}".`,
      })
      errors.push({
        alias,
        code: 'conflicting-field-mode',
        diagnostic,
        field: fieldKey,
        itemId: registration.id,
        message: diagnostic.message,
      })
    }

    if (presentation === undefined) continue

    if (presentationContext !== undefined) {
      const values = presentationContext.fieldValues(normalized.field)
      const rejectsDefault = !picodashPresentationAcceptsValue(
        presentation.accepts,
        values.defaultValue,
      )
      const rejectsCurrent =
        !values.hasCurrentValue &&
        !picodashPresentationAcceptsValue(presentation.accepts, undefined)
          ? true
          : values.hasCurrentValue &&
            !picodashPresentationAcceptsValue(presentation.accepts, values.currentValue)
      if (rejectsDefault || rejectsCurrent) {
        const diagnostic = createRegistrationDiagnostic({
          alias,
          code: PICODASH_ERROR_CODES.INCOMPATIBLE_FIELD_DASHLET,
          component: presentation.component,
          correction:
            'Bind a field whose durable default and current value match the Dashlet accepts descriptor, or choose a compatible Dashlet.',
          expectedContract: `Presentation "${presentation.id}" accepts ${describeValueContract(presentation.accepts)} values.`,
          fieldKey,
          itemId: registration.id,
          panelId: presentationContext.panelId,
          summary: `Field "${fieldKey}" is incompatible with component "${presentation.component}".`,
        })
        errors.push({
          alias,
          code: 'incompatible-field-presentation',
          diagnostic,
          field: fieldKey,
          itemId: registration.id,
          message: diagnostic.message,
        })
      }
    }

    for (const item of Object.values(registeredItems)) {
      if (item.id === registration.id) continue
      for (const existing of item.bindings) {
        if (existing.presentation === undefined) continue
        if (
          existing.presentation.id === presentation.id &&
          !picodashPresentationContractsEqual(existing.presentation, presentation)
        ) {
          const diagnostic = createRegistrationDiagnostic({
            alias,
            code: PICODASH_ERROR_CODES.CONFLICTING_BINDING,
            component: presentation.component,
            correction:
              'Use a new versioned constraint id, or make every use of this id describe the same component and accepted values.',
            expectedContract: `Presentation constraint id "${presentation.id}" has one stable definition.`,
            fieldKey,
            itemId: registration.id,
            panelId: presentationContext?.panelId,
            summary: `Presentation constraint "${presentation.id}" conflicts with item "${item.id}".`,
          })
          errors.push({
            alias,
            code: 'conflicting-presentation-contract',
            diagnostic,
            field: fieldKey,
            itemId: registration.id,
            message: diagnostic.message,
          })
        }
        if (
          existing.field.key === fieldKey &&
          !picodashPresentationContractsCompatible(existing.presentation, presentation)
        ) {
          const diagnostic = createRegistrationDiagnostic({
            alias,
            code: PICODASH_ERROR_CODES.INCOMPATIBLE_FIELD_DASHLET,
            component: presentation.component,
            correction:
              'Use compatible accepted-value descriptors for every Dashlet sharing this field, or bind a different field.',
            expectedContract: `Every presentation sharing field "${fieldKey}" accepts a compatible value domain.`,
            fieldKey,
            itemId: registration.id,
            panelId: presentationContext?.panelId,
            summary: `Presentation "${presentation.id}" conflicts with the contract mounted by item "${item.id}".`,
          })
          errors.push({
            alias,
            code: 'incompatible-field-presentation',
            diagnostic,
            field: fieldKey,
            itemId: registration.id,
            message: diagnostic.message,
          })
        }
      }
    }
  }

  if (errors.length > 0) return { errors, success: false }

  return {
    item: {
      bindings: normalizedBindings.map(({ alias, binding: normalized }) => {
        return {
          alias,
          field: normalized.field,
          mode: normalized.mode,
          presentation: normalized.presentation,
        }
      }),
      collapsible: registration.collapsible ?? false,
      defaultCollapsed: registration.defaultCollapsed ?? false,
      hidden: registration.hidden ?? false,
      id: registration.id,
      kind: registration.kind ?? 'item',
      label: registration.label,
      parentId: registration.parentId ?? picodashRootItemId,
      pin: registration.pin,
      reorderable: registration.reorderable ?? true,
    },
    success: true,
  }
}

export function registeredWritableFields<TValues extends object>(
  items: Readonly<Record<string, PicodashRegisteredItem<TValues>>>,
): readonly PicodashField<TValues, Extract<keyof TValues, string>>[] {
  const seen = new Set<string>()
  const fields: PicodashField<TValues, Extract<keyof TValues, string>>[] = []
  for (const item of Object.values(items)) {
    for (const binding of item.bindings) {
      if (binding.mode === 'display' || seen.has(binding.field.key)) continue
      seen.add(binding.field.key)
      fields.push(binding.field)
    }
  }
  return fields
}

export function picodashRegisteredItemsEqual<TValues extends object>(
  left: PicodashRegisteredItem<TValues>,
  right: PicodashRegisteredItem<TValues>,
): boolean {
  return (
    left.collapsible === right.collapsible &&
    left.defaultCollapsed === right.defaultCollapsed &&
    left.hidden === right.hidden &&
    left.id === right.id &&
    left.kind === right.kind &&
    left.label === right.label &&
    left.parentId === right.parentId &&
    left.pin === right.pin &&
    left.reorderable === right.reorderable &&
    left.bindings.length === right.bindings.length &&
    left.bindings.every((binding, index) => {
      const other = right.bindings[index]
      return (
        binding.alias === other?.alias &&
        binding.field === other.field &&
        binding.mode === other.mode &&
        ((binding.presentation === undefined && other.presentation === undefined) ||
          (binding.presentation !== undefined &&
            other.presentation !== undefined &&
            picodashPresentationContractsEqual(binding.presentation, other.presentation)))
      )
    })
  )
}

function bindingEntries<TValues extends object>(
  registration: PicodashItemRegistration<TValues>,
): readonly [string, PicodashItemBinding<TValues>][] {
  if (registration.field !== undefined) return [['value', registration.field]]
  return Object.entries(registration.fields ?? {}) as [string, PicodashItemBinding<TValues>][]
}

function normalizeBinding<TValues extends object>(
  binding: PicodashItemBinding<TValues>,
): {
  readonly field: PicodashField<TValues, Extract<keyof TValues, string>>
  readonly mode: PicodashItemBindingMode
  readonly presentation?: import('./types.js').PicodashPresentationContract
} {
  return 'field' in binding
    ? {
        field: binding.field,
        mode: binding.mode ?? 'input',
        presentation: binding.presentation as
          | import('./types.js').PicodashPresentationContract
          | undefined,
      }
    : { field: binding, mode: 'input' }
}

function createRegistrationDiagnostic(input: {
  alias: string
  code: PicodashErrorCode
  component?: string
  correction: string
  expectedContract: string
  fieldKey?: string
  itemId: string
  panelId?: string
  summary: string
}) {
  return createPicodashDiagnostic({
    code: input.code,
    correction: input.correction,
    expectedContract: input.expectedContract,
    identity: {
      bindingId: input.alias,
      component: input.component,
      fieldKey: input.fieldKey,
      itemId: input.itemId,
      panelId: input.panelId,
    },
    summary: input.summary,
  })
}

function describeValueContract(
  contract: import('./types.js').PicodashPresentationValueContract,
): string {
  if (contract.kind === 'string' && contract.values !== undefined) {
    return `string (${contract.values.join(', ')})`
  }
  if (contract.kind === 'tuple') return `tuple(length=${contract.length})`
  if (contract.kind === 'number' && contract.finite === true) return 'finite number'
  return contract.kind
}

function presentationComponent(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || !('component' in value)) return undefined
  return typeof value.component === 'string' ? value.component : undefined
}

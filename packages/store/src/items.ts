import type {
  PicodashField,
  PicodashItemBinding,
  PicodashItemBindingMode,
  PicodashItemRegistration,
  PicodashItemRegistrationError,
  PicodashRegisteredItem,
} from './types.js'

export const picodashRootItemId = 'root'

export function resolvePicodashItemRegistration<TValues extends object>(
  registration: PicodashItemRegistration<TValues>,
  ownsField: (field: unknown) => field is PicodashField<TValues, Extract<keyof TValues, string>>,
  registeredItems: Readonly<Record<string, PicodashRegisteredItem<TValues>>>,
):
  | { readonly item: PicodashRegisteredItem<TValues>; readonly success: true }
  | { readonly errors: readonly PicodashItemRegistrationError[]; readonly success: false } {
  const bindings = bindingEntries(registration)
  const errors: PicodashItemRegistrationError[] = []
  const seenFields = new Map<string, string>()

  for (const [alias, binding] of bindings) {
    const normalized = normalizeBinding(binding)
    if (!ownsField(normalized.field)) {
      errors.push({
        alias,
        code: 'foreign-field',
        itemId: registration.id,
        message: `Field binding "${alias}" does not belong to this Picodash Store.`,
      })
      continue
    }

    const fieldKey = normalized.field.key
    const previousAlias = seenFields.get(fieldKey)
    if (previousAlias !== undefined) {
      errors.push({
        alias,
        code: 'duplicate-field-binding',
        field: fieldKey,
        itemId: registration.id,
        message: `Field "${fieldKey}" is already bound as "${previousAlias}" by this item.`,
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
      errors.push({
        alias,
        code: 'conflicting-field-mode',
        field: fieldKey,
        itemId: registration.id,
        message: `Field "${fieldKey}" is already registered in a conflicting mode by item "${conflictingItem.id}".`,
      })
    }
  }

  if (errors.length > 0) return { errors, success: false }

  return {
    item: {
      bindings: bindings.map(([alias, binding]) => {
        const normalized = normalizeBinding(binding)
        return {
          alias,
          field: normalized.field,
          mode: normalized.mode,
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
        binding.mode === other.mode
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
} {
  return 'field' in binding
    ? { field: binding.field, mode: binding.mode }
    : { field: binding, mode: 'input' }
}

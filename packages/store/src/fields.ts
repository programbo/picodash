import type { PicodashFieldDefinitions, PicodashFields } from './types.js'

const owners = new WeakMap<object, object>()

export function createPicodashFields<TValues extends object>(
  definitions: PicodashFieldDefinitions<TValues>,
  owner: object,
): PicodashFields<TValues> {
  const fields = Object.fromEntries(
    Object.keys(definitions).map((key) => {
      const field = { key }
      owners.set(field, owner)

      return [key, Object.freeze(field)]
    }),
  )

  return Object.freeze(fields) as PicodashFields<TValues>
}

export function picodashOwnerOwnsField(owner: object, field: unknown): boolean {
  return typeof field === 'object' && field !== null && owners.get(field) === owner
}

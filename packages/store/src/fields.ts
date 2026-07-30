import type { PicodashFieldDefinitions, PicodashFields, PicodashStore } from './types.js'

export function createPicodashFields<TValues extends object>(
  definitions: PicodashFieldDefinitions<TValues>,
  store: PicodashStore<TValues>,
): PicodashFields<TValues> {
  const fields = Object.fromEntries(
    Object.keys(definitions).map((key) => {
      const field = Object.defineProperties(
        { key },
        {
          store: {
            configurable: false,
            enumerable: false,
            value: store,
            writable: false,
          },
        },
      )

      return [key, Object.freeze(field)]
    }),
  )

  return Object.freeze(fields) as PicodashFields<TValues>
}

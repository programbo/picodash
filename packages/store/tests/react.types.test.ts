import { expectTypeOf, test } from 'vite-plus/test'
import { createPicodashStore } from '../src/index.ts'
import { shallowEqual, usePicodashStoreSelector } from '../src/react.ts'
import type { RootSnapshot, ScopedSnapshot } from '../src/index.ts'

test('explicit selector preserves root/scoped snapshot and selection inference', () => {
  const root = createPicodashStore({
    valueOwner: 'store',
    fields: {
      count: { defaultValue: 0 },
      label: { defaultValue: 'initial' },
    },
  })
  const scoped = root.scope('settings')

  function assertSelectorTypes() {
    const rootSelection = usePicodashStoreSelector(root, (state) => {
      expectTypeOf(state).toEqualTypeOf<
        RootSnapshot<{ readonly count: number; readonly label: string }>
      >()
      return state.values.count
    })
    const scopedSelection = usePicodashStoreSelector(scoped, (state) => {
      expectTypeOf(state).toEqualTypeOf<
        ScopedSnapshot<{ readonly count: number; readonly label: string }>
      >()
      return state.values.label
    })
    expectTypeOf(rootSelection).toEqualTypeOf<number>()
    expectTypeOf(scopedSelection).toEqualTypeOf<string>()
    const equality: (
      left: { readonly count: number },
      right: { readonly count: number },
    ) => boolean = shallowEqual
    const objectSelection = usePicodashStoreSelector(
      root,
      (state) => ({ count: state.values.count }),
      equality,
    )
    expectTypeOf(objectSelection).toEqualTypeOf<{ count: number }>()
  }
  void assertSelectorTypes
})

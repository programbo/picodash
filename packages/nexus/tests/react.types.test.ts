import { expectTypeOf, test } from 'vite-plus/test'
import { createPicodashNexus } from '../src/index.ts'
import { shallowEqual, usePicodashNexusSelector } from '../src/react.ts'
import {
  usePicodashRootSelector,
  usePicodashRootNexus,
  usePicodashScope,
  usePicodashScopeSelector,
  usePicodashNexus,
} from '../src/react.ts'
import type { RootNexusSnapshot, ScopedNexusSnapshot } from '../src/index.ts'
import type {
  PicodashFieldDefinitions,
  PicodashJsonValue,
  RootNexus,
  ScopedNexus,
} from '../src/index.ts'

test('explicit selector preserves root/scoped snapshot and selection inference', () => {
  const root = createPicodashNexus({
    valueOwner: 'nexus',
    fields: {
      count: { defaultValue: 0 },
      label: { defaultValue: 'initial' },
    },
  })
  const scoped = root.scope('settings')

  function assertSelectorTypes() {
    const rootSelection = usePicodashNexusSelector(root, (state) => {
      expectTypeOf(state).toEqualTypeOf<
        RootNexusSnapshot<{ readonly count: number; readonly label: string }>
      >()
      return state.values.count
    })
    const scopedSelection = usePicodashNexusSelector(scoped, (state) => {
      expectTypeOf(state).toEqualTypeOf<
        ScopedNexusSnapshot<{ readonly count: number; readonly label: string }>
      >()
      return state.values.label
    })
    expectTypeOf(rootSelection).toEqualTypeOf<number>()
    expectTypeOf(scopedSelection).toEqualTypeOf<string>()
    const equality: (
      left: { readonly count: number },
      right: { readonly count: number },
    ) => boolean = shallowEqual
    const objectSelection = usePicodashNexusSelector(
      root,
      (state) => ({ count: state.values.count }),
      equality,
    )
    expectTypeOf(objectSelection).toEqualTypeOf<{ count: number }>()
  }
  void assertSelectorTypes
})

test('contextual hooks and selectors expose root/scoped Nexus contracts', () => {
  function assertContextualTypes() {
    const nearest = usePicodashNexus()
    const scoped = usePicodashNexus('settings')
    const root = usePicodashRootNexus()
    const scope = usePicodashScope()
    const rootSelection = usePicodashRootSelector((state) => state.values)
    const scopeSelection = usePicodashScopeSelector((state) => state.values)
    expectTypeOf(nearest).toMatchTypeOf<
      RootNexus<PicodashFieldDefinitions> | ScopedNexus<PicodashFieldDefinitions>
    >()
    expectTypeOf(scoped).toMatchTypeOf<ScopedNexus<PicodashFieldDefinitions>>()
    expectTypeOf(root).toMatchTypeOf<RootNexus<PicodashFieldDefinitions>>()
    expectTypeOf(scope).toMatchTypeOf<ScopedNexus<PicodashFieldDefinitions>>()
    expectTypeOf(rootSelection).toEqualTypeOf<Readonly<Record<string, PicodashJsonValue>>>()
    expectTypeOf(scopeSelection).toEqualTypeOf<Readonly<Record<string, PicodashJsonValue>>>()
  }
  void assertContextualTypes
})

import { describe, expectTypeOf, it } from 'vite-plus/test'
import type {
  AcquireBindingOptions,
  BindingHandle,
  EntityLease,
  EntityLeaseOptions,
  PicodashStoreEntityBoundaryProps,
  PicodashStoreProviderBoundaryProps,
  ProviderLease,
  RelationshipLease,
  InvalidBindingHandleReason,
  StoreBindingMode,
  StoreEntityKind,
} from '../src/integration.ts'
import {
  acquireBindingLease,
  acquireEntityLease,
  acquireProviderLease,
  acquireRelationshipLease,
} from '../src/integration.ts'
import {
  createPicodashStore,
  type DestroyRootOptions,
  type DestroyScopeOptions,
  type InvalidDestroyOptionsReason,
} from '../src/index.ts'

describe('Store integration types', () => {
  it('keeps the public lease surface opaque and role-specific', () => {
    expectTypeOf<StoreBindingMode>().toEqualTypeOf<'input' | 'display'>()
    expectTypeOf<InvalidBindingHandleReason>().toEqualTypeOf<
      'foreign-root' | 'released' | 'superseded' | 'wrong-kind'
    >()
    expectTypeOf<StoreEntityKind>().toEqualTypeOf<'dashPanel' | 'dashList'>()
    expectTypeOf<InvalidDestroyOptionsReason>().toEqualTypeOf<
      | 'not-object'
      | 'unknown-key'
      | 'accessor-property'
      | 'invalid-include-descendants'
      | 'invalid-discard-unpersisted'
    >()
    expectTypeOf<DestroyScopeOptions>().toEqualTypeOf<{ readonly includeDescendants?: boolean }>()
    expectTypeOf<DestroyRootOptions>().toEqualTypeOf<{ readonly discardUnpersisted: true }>()
    expectTypeOf<ProviderLease>().toHaveProperty('release').toBeFunction()
    expectTypeOf<EntityLease>().toHaveProperty('release').toBeFunction()
    expectTypeOf<RelationshipLease>().toHaveProperty('release').toBeFunction()
    expectTypeOf<BindingHandle<any, any>>().toHaveProperty('scopeId').toBeString()
    expectTypeOf<BindingHandle<any, any>>().toHaveProperty('itemId').toBeString()
    expectTypeOf<BindingHandle<any, any>>().toHaveProperty('alias').toBeString()
    expectTypeOf<BindingHandle<any, any>>().toHaveProperty('field')
    expectTypeOf<BindingHandle<any, any>>().toHaveProperty('mode').toEqualTypeOf<StoreBindingMode>()
    expectTypeOf<AcquireBindingOptions<any, any>>().toHaveProperty('itemId').toBeString()
    expectTypeOf<AcquireBindingOptions<any, any>>().toHaveProperty('field')
    expectTypeOf<AcquireBindingOptions<any, any>>()
      .toHaveProperty('mode')
      .toEqualTypeOf<StoreBindingMode>()
    expectTypeOf<EntityLeaseOptions>().toEqualTypeOf<
      | { readonly kind: 'dashPanel'; readonly host: ProviderLease | EntityLease }
      | { readonly kind: 'dashList'; readonly host?: ProviderLease | EntityLease }
    >()
  })

  it('infers matching root/scoped generic stores and has no root integration reexports', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: {
        value: { defaultValue: 1 },
        label: { defaultValue: 'one' },
      },
    })
    expectTypeOf(acquireProviderLease(store)).toEqualTypeOf<ProviderLease>()
    expectTypeOf(
      acquireEntityLease(store.scope('scope'), { kind: 'dashList' }),
    ).toEqualTypeOf<EntityLease>()
    const binding = acquireBindingLease(store.scope('scope'), {
      itemId: 'item',
      field: store.fields.value,
      mode: 'input',
    })
    expectTypeOf(binding).toMatchTypeOf<BindingHandle<any, 'value'>>()
    const valueBinding: BindingHandle<
      {
        readonly value: { readonly defaultValue: number }
        readonly label: { readonly defaultValue: string }
      },
      'value'
    > = binding
    void valueBinding
    expectTypeOf(binding.field.key).toEqualTypeOf<'value'>()
    expectTypeOf(binding.mode).toEqualTypeOf<'input' | 'display'>()
    binding.release()
    expectTypeOf(acquireRelationshipLease).parameters.toEqualTypeOf<[EntityLease, EntityLease]>()
    expectTypeOf(store).not.toHaveProperty('acquireProviderLease')
    const scoped = store.scope('scope')
    type RootDestroy = (scopeId: string, options?: DestroyScopeOptions) => unknown
    type ScopedDestroy = (options?: DestroyScopeOptions) => unknown
    expectTypeOf<typeof store.destroyScope>().toMatchTypeOf<RootDestroy>()
    expectTypeOf<typeof scoped.destroyScope>().toMatchTypeOf<ScopedDestroy>()
    expectTypeOf<typeof store.destroy>().toMatchTypeOf<(options?: DestroyRootOptions) => void>()
    const typeOnly = () => false
    if (typeOnly()) {
      // @ts-expect-error Provider leases require a root Store, not a scoped view.
      acquireProviderLease(store.scope('scope'))
      // @ts-expect-error Root destruction only accepts the literal true discard option.
      store.destroy({ discardUnpersisted: false })
      // @ts-expect-error Root destruction requires the discard option when an object is supplied.
      store.destroy({})
      // @ts-expect-error Root destruction options do not accept extra keys.
      store.destroy({ discardUnpersisted: true, extra: true })
      // @ts-expect-error Scoped Stores do not expose root destruction.
      scoped.destroy({ discardUnpersisted: true })
      // @ts-expect-error Entity leases require a scoped Store, not a root Store.
      acquireEntityLease(store, { kind: 'dashList' })
      // @ts-expect-error DashPanel leases require a host.
      acquireEntityLease(store.scope('scope'), { kind: 'dashPanel' })
      // @ts-expect-error Relationship leases accept EntityLease values only.
      acquireRelationshipLease({ release() {} } as ProviderLease, {} as EntityLease)
      // @ts-expect-error Caller-created release objects are not nominal leases.
      acquireRelationshipLease({ release() {} }, { release() {} })
      // @ts-expect-error Binding acquisition requires a scoped Store.
      acquireBindingLease(store, {
        itemId: 'item',
        field: store.fields.value,
        mode: 'input',
      })
      // @ts-expect-error Store bindings require an explicit mode.
      acquireBindingLease(scoped, { itemId: 'item', field: scoped.fields.value })
      // @ts-expect-error Binding fields are nominal root-owned handles.
      acquireBindingLease(scoped, { itemId: 'item', field: { key: 'value' }, mode: 'input' })
      // @ts-expect-error A label binding cannot be assigned to a value-keyed handle.
      const wrongKey: BindingHandle<
        {
          readonly value: { readonly defaultValue: number }
          readonly label: { readonly defaultValue: string }
        },
        'value'
      > = acquireBindingLease(scoped, {
        itemId: 'item',
        field: scoped.fields.label,
        mode: 'input',
      })
      void wrongKey
    }
  })

  it('types the React boundary props with root/scoped stores and exact kinds', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { value: { defaultValue: 1 } },
    })
    expectTypeOf<PicodashStoreProviderBoundaryProps>().toHaveProperty('children')
    expectTypeOf<PicodashStoreProviderBoundaryProps>().toHaveProperty('store')
    expectTypeOf<PicodashStoreEntityBoundaryProps>().toHaveProperty('children')
    expectTypeOf<PicodashStoreEntityBoundaryProps>().toHaveProperty('kind')
    const providerProps: PicodashStoreProviderBoundaryProps = {
      store,
      children: null,
    }
    const scoped = store.scope('scope')
    const entityProps: PicodashStoreEntityBoundaryProps = {
      store: scoped,
      kind: 'dashList',
      children: null,
    }
    const standaloneEntityProps: PicodashStoreEntityBoundaryProps = {
      store: scoped,
      kind: 'dashList',
      allowStandalone: true,
      children: null,
    }
    const explicitFalseEntityProps: PicodashStoreEntityBoundaryProps = {
      store: scoped,
      kind: 'dashList',
      allowStandalone: false,
      children: null,
    }
    expectTypeOf(providerProps.store).toBeObject()
    expectTypeOf(entityProps.store).toBeObject()
    const typeOnly = () => false
    if (typeOnly()) {
      const invalidProvider: PicodashStoreProviderBoundaryProps = {
        // @ts-expect-error Provider boundaries require a root Store.
        store: store.scope('scope'),
        children: null,
      }
      const invalidEntity: PicodashStoreEntityBoundaryProps = {
        // @ts-expect-error Entity boundaries require a scoped Store.
        store,
        kind: 'dashPanel',
        children: null,
      }
      // @ts-expect-error Standalone opt-in is only valid for DashList boundaries.
      const invalidPanelOptIn: PicodashStoreEntityBoundaryProps = {
        store: scoped,
        kind: 'dashPanel',
        allowStandalone: true,
        children: null,
      }
      const invalidRootStandalone: PicodashStoreEntityBoundaryProps = {
        // @ts-expect-error Entity boundaries require a scoped Store.
        store,
        kind: 'dashList',
        allowStandalone: true,
        children: null,
      }
      void invalidProvider
      void invalidEntity
      void invalidPanelOptIn
      void invalidRootStandalone
    }
    void standaloneEntityProps
    void explicitFalseEntityProps
  })
})

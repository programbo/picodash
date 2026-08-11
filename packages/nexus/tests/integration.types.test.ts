import { describe, expectTypeOf, it } from 'vite-plus/test'
import type {
  AcquireBindingOptions,
  BindingHandle,
  EntityLease,
  EntityLeaseOptions,
  PicodashNexusEntityBoundaryProps,
  PicodashNexusProviderBoundaryProps,
  ProviderLease,
  RelationshipLease,
  InvalidBindingHandleReason,
  NexusBindingMode,
  NexusEntityKind,
} from '../src/integration.ts'
import {
  acquireBindingLease,
  acquireEntityLease,
  acquireProviderLease,
  acquireRelationshipLease,
} from '../src/integration.ts'
import {
  createPicodashNexus,
  type DestroyRootOptions,
  type DestroyScopeOptions,
  type InvalidDestroyOptionsReason,
} from '../src/index.ts'

describe('Nexus integration types', () => {
  it('keeps the public lease surface opaque and role-specific', () => {
    expectTypeOf<NexusBindingMode>().toEqualTypeOf<'input' | 'display'>()
    expectTypeOf<InvalidBindingHandleReason>().toEqualTypeOf<
      'foreign-root' | 'released' | 'superseded' | 'wrong-kind'
    >()
    expectTypeOf<NexusEntityKind>().toEqualTypeOf<'dashPanel' | 'dashList'>()
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
    expectTypeOf<BindingHandle<any, any>>().toHaveProperty('mode').toEqualTypeOf<NexusBindingMode>()
    expectTypeOf<AcquireBindingOptions<any, any>>().toHaveProperty('itemId').toBeString()
    expectTypeOf<AcquireBindingOptions<any, any>>().toHaveProperty('field')
    expectTypeOf<AcquireBindingOptions<any, any>>()
      .toHaveProperty('mode')
      .toEqualTypeOf<NexusBindingMode>()
    expectTypeOf<EntityLeaseOptions>().toEqualTypeOf<
      | { readonly kind: 'dashPanel'; readonly host: ProviderLease | EntityLease }
      | { readonly kind: 'dashList'; readonly host?: ProviderLease | EntityLease }
    >()
  })

  it('infers matching root/scoped generic stores and has no root integration reexports', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: {
        value: { defaultValue: 1 },
        label: { defaultValue: 'one' },
      },
    })
    expectTypeOf(acquireProviderLease(nexus)).toEqualTypeOf<ProviderLease>()
    expectTypeOf(
      acquireEntityLease(nexus.scope('scope'), { kind: 'dashList' }),
    ).toEqualTypeOf<EntityLease>()
    const binding = acquireBindingLease(nexus.scope('scope'), {
      itemId: 'item',
      field: nexus.fields.value,
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
    expectTypeOf(nexus).not.toHaveProperty('acquireProviderLease')
    const scoped = nexus.scope('scope')
    type RootDestroy = (scopeId: string, options?: DestroyScopeOptions) => unknown
    type ScopedDestroy = (options?: DestroyScopeOptions) => unknown
    expectTypeOf<typeof nexus.destroyScope>().toMatchTypeOf<RootDestroy>()
    expectTypeOf<typeof scoped.destroyScope>().toMatchTypeOf<ScopedDestroy>()
    expectTypeOf<typeof nexus.destroy>().toMatchTypeOf<(options?: DestroyRootOptions) => void>()
    const typeOnly = () => false
    if (typeOnly()) {
      // @ts-expect-error Provider leases require a root Nexus, not a scoped view.
      acquireProviderLease(nexus.scope('scope'))
      // @ts-expect-error Root destruction only accepts the literal true discard option.
      nexus.destroy({ discardUnpersisted: false })
      // @ts-expect-error Root destruction requires the discard option when an object is supplied.
      nexus.destroy({})
      // @ts-expect-error Root destruction options do not accept extra keys.
      nexus.destroy({ discardUnpersisted: true, extra: true })
      // @ts-expect-error Scoped Nexuses do not expose root destruction.
      scoped.destroy({ discardUnpersisted: true })
      // @ts-expect-error Entity leases require a scoped Nexus, not a root Nexus.
      acquireEntityLease(nexus, { kind: 'dashList' })
      // @ts-expect-error DashPanel leases require a host.
      acquireEntityLease(nexus.scope('scope'), { kind: 'dashPanel' })
      // @ts-expect-error Relationship leases accept EntityLease values only.
      acquireRelationshipLease({ release() {} } as ProviderLease, {} as EntityLease)
      // @ts-expect-error Caller-created release objects are not nominal leases.
      acquireRelationshipLease({ release() {} }, { release() {} })
      // @ts-expect-error Binding acquisition requires a scoped Nexus.
      acquireBindingLease(nexus, {
        itemId: 'item',
        field: nexus.fields.value,
        mode: 'input',
      })
      // @ts-expect-error Nexus bindings require an explicit mode.
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
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { value: { defaultValue: 1 } },
    })
    expectTypeOf<PicodashNexusProviderBoundaryProps>().toHaveProperty('children')
    expectTypeOf<PicodashNexusProviderBoundaryProps>().toHaveProperty('nexus')
    expectTypeOf<PicodashNexusEntityBoundaryProps>().toHaveProperty('children')
    expectTypeOf<PicodashNexusEntityBoundaryProps>().toHaveProperty('kind')
    const providerProps: PicodashNexusProviderBoundaryProps = {
      nexus,
      children: null,
    }
    const scoped = nexus.scope('scope')
    const entityProps: PicodashNexusEntityBoundaryProps = {
      nexus: scoped,
      kind: 'dashList',
      children: null,
    }
    const standaloneEntityProps: PicodashNexusEntityBoundaryProps = {
      nexus: scoped,
      kind: 'dashList',
      allowStandalone: true,
      children: null,
    }
    const explicitFalseEntityProps: PicodashNexusEntityBoundaryProps = {
      nexus: scoped,
      kind: 'dashList',
      allowStandalone: false,
      children: null,
    }
    expectTypeOf(providerProps.nexus).toBeObject()
    expectTypeOf(entityProps.nexus).toBeObject()
    const typeOnly = () => false
    if (typeOnly()) {
      const invalidProvider: PicodashNexusProviderBoundaryProps = {
        // @ts-expect-error Provider boundaries require a root Nexus.
        nexus: nexus.scope('scope'),
        children: null,
      }
      const invalidEntity: PicodashNexusEntityBoundaryProps = {
        // @ts-expect-error Entity boundaries require a scoped Nexus.
        nexus,
        kind: 'dashPanel',
        children: null,
      }
      // @ts-expect-error Standalone opt-in is only valid for DashList boundaries.
      const invalidPanelOptIn: PicodashNexusEntityBoundaryProps = {
        nexus: scoped,
        kind: 'dashPanel',
        allowStandalone: true,
        children: null,
      }
      const invalidRootStandalone: PicodashNexusEntityBoundaryProps = {
        // @ts-expect-error Entity boundaries require a scoped Nexus.
        nexus,
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

import { describe, expect, it } from 'vite-plus/test'
import { acquireBindingLease } from '../src/integration.ts'
import { assertBindingHandle } from '../src/integration-leases.ts'
import { createPicodashNexus, PicodashContractError } from '../src/index.ts'

const makeNexus = () =>
  createPicodashNexus({
    valueOwner: 'nexus',
    fields: {
      value: { defaultValue: 1 },
      label: { defaultValue: 'one' },
    },
  })

const failure = (run: () => unknown) => {
  try {
    run()
    throw new Error('expected failure')
  } catch (error) {
    expect(error).toBeInstanceOf(PicodashContractError)
    return error as PicodashContractError
  }
}

describe('Nexus binding acquisition leases', () => {
  it('validates options in order without invoking accessors or leaking rejected data', () => {
    const nexus = makeNexus()
    const scoped = nexus.scope('validation')
    expect(failure(() => acquireBindingLease(scoped, null as never)).context).toEqual({
      reason: 'not-object',
    })
    expect(
      failure(() =>
        acquireBindingLease(scoped, {
          itemId: 'item',
          field: scoped.fields.value,
          mode: 'input',
          extra: true,
        } as never),
      ).context,
    ).toEqual({ reason: 'unknown-key' })
    let invoked = false
    const accessor = Object.defineProperty({}, 'itemId', {
      get() {
        invoked = true
        return 'item'
      },
    })
    expect(failure(() => acquireBindingLease(scoped, accessor as never)).context).toEqual({
      reason: 'accessor-property',
    })
    expect(invoked).toBe(false)
    const hostile = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('PRIVATE_SENTINEL')
        },
      },
    )
    const hostileError = failure(() => acquireBindingLease(scoped, hostile as never))
    expect(hostileError.context).toEqual({ reason: 'not-object' })
    expect(
      `${hostileError.message}${hostileError.stack}${JSON.stringify(hostileError)}`,
    ).not.toContain('PRIVATE_SENTINEL')
    for (const [options, reason] of [
      [{ itemId: '', field: scoped.fields.value, mode: 'input' }, 'invalid-item-id'],
      [{ itemId: 'item', alias: ' ', field: scoped.fields.value, mode: 'input' }, 'invalid-alias'],
      [{ itemId: 'item', field: scoped.fields.value, mode: 'other' }, 'invalid-mode'],
    ] as const)
      expect(failure(() => acquireBindingLease(scoped, options as never)).context).toEqual({
        reason,
      })
  })

  it('defaults aliases, enforces one active generation, and releases idempotently', () => {
    const nexus = makeNexus()
    const scoped = nexus.scope('scope')
    const first = acquireBindingLease(scoped, {
      itemId: 'item',
      field: scoped.fields.value,
      mode: 'input',
    })
    expect(first.scopeId).toBe('scope')
    expect(first.itemId).toBe('item')
    expect(first.alias).toBe('value')
    expect(first.field).toBe(scoped.fields.value)
    expect(first.mode).toBe('input')
    expect(Object.isFrozen(first)).toBe(true)
    expect(
      failure(() =>
        acquireBindingLease(scoped, {
          itemId: 'item',
          field: scoped.fields.label,
          alias: 'value',
          mode: 'display',
        }),
      ).context,
    ).toEqual({ scopeId: 'scope', itemId: 'item', alias: 'value' })
    first.release()
    first.release()
    const second = acquireBindingLease(scoped, {
      itemId: 'item',
      field: scoped.fields.label,
      alias: 'value',
      mode: 'display',
    })
    expect(second).not.toBe(first)
    first.release()
    expect(() => nexus.destroy()).toThrow(/root-has-active-leases/)
    second.release()
    nexus.destroy()
  })

  it('keeps scope identity and interaction snapshots independent on no-op cleanup', () => {
    const nexus = makeNexus()
    const firstScope = nexus.scope('first')
    const secondScope = nexus.scope('second')
    const firstSnapshot = firstScope.getState()
    const secondSnapshot = secondScope.getState()
    let firstNotifications = 0
    let secondNotifications = 0
    const unsubscribeFirst = firstScope.subscribe(() => {
      firstNotifications += 1
    })
    const unsubscribeSecond = secondScope.subscribe(() => {
      secondNotifications += 1
    })
    const first = acquireBindingLease(firstScope, {
      itemId: 'item',
      field: firstScope.fields.value,
      mode: 'display',
    })
    const second = acquireBindingLease(secondScope, {
      itemId: 'item',
      field: secondScope.fields.value,
      mode: 'display',
    })
    first.release()
    expect(firstScope.getState()).toBe(firstSnapshot)
    expect(secondScope.getState()).toBe(secondSnapshot)
    expect(firstNotifications).toBe(0)
    expect(secondNotifications).toBe(0)
    second.release()
    unsubscribeFirst()
    unsubscribeSecond()
    nexus.destroy()
  })

  it('rejects fields from another root through foreign-handle', () => {
    const first = makeNexus()
    const second = makeNexus()
    const error = failure(() =>
      acquireBindingLease(first.scope('scope'), {
        itemId: 'item',
        field: second.fields.value,
        mode: 'input',
      }),
    )
    expect(error.code).toBe('foreign-handle')
    expect(error.context).toEqual({})
    first.destroy()
    second.destroy()
  })

  it('classifies released and superseded handles for future commands', () => {
    const first = makeNexus()
    const second = makeNexus()
    const firstScope = first.scope('scope')
    const secondScope = second.scope('scope')
    const old = acquireBindingLease(firstScope, {
      itemId: 'item',
      field: firstScope.fields.value,
      mode: 'input',
    })
    expect(assertBindingHandle(firstScope, old)).toBe(old)
    old.release()
    expect(failure(() => assertBindingHandle(firstScope, old)).context).toEqual({
      reason: 'released',
    })
    const fresh = acquireBindingLease(firstScope, {
      itemId: 'item',
      field: firstScope.fields.value,
      mode: 'input',
    })
    expect(failure(() => assertBindingHandle(firstScope, old)).context).toEqual({
      reason: 'superseded',
    })
    expect(failure(() => assertBindingHandle(secondScope, fresh)).context).toEqual({
      reason: 'foreign-root',
    })
    expect(failure(() => assertBindingHandle(firstScope, {})).context).toEqual({
      reason: 'wrong-kind',
    })
    fresh.release()
    first.destroy()
    second.destroy()
  })
})

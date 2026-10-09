import { describe, expect, it, vi } from 'vite-plus/test'
import { createPicodashNexus } from '../src/index.js'
import { createMemoryPersistence } from './support/memory-persistence.js'
import { acquireBindingLease } from '../src/integration.js'

const create = () =>
  createPicodashNexus({
    valueOwner: 'nexus',
    fields: {
      value: {
        defaultValue: 10,
        validate: (value: number) => (value < 0 ? [{ message: 'Must be positive' }] : []),
      },
      other: { defaultValue: 0 },
    },
  })

describe('numeric gestures', () => {
  it('publishes live updates, ends once, and invokes end outside the write lock', async () => {
    const nexus = create()
    const onEnd = vi.fn(() => nexus.setValue(nexus.fields.other, 1))
    const gesture = nexus.createNumericGesture(nexus.fields.value, { onEnd })
    expect(gesture.begin()).toBe(true)
    expect(gesture.begin()).toBe(false)
    expect(gesture.update(20)).toMatchObject({ ok: true })
    expect(nexus.getState().values.value).toBe(20)
    expect(gesture.commit()).toMatchObject({
      outcome: 'committed',
      initialValue: 10,
      finalValue: 20,
      changed: true,
    })
    expect(gesture.commit()).toBeUndefined()
    await Promise.resolve()
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(nexus.getState().values.other).toBe(1)
    gesture.release()
    nexus.destroy()
  })
  it('cancels only owned writes and reports no-op gestures', () => {
    const nexus = create()
    const gesture = nexus.createNumericGesture(nexus.fields.value)
    gesture.begin()
    gesture.update(30)
    nexus.setValue(nexus.fields.other, 9)
    expect(gesture.cancel('escape')).toMatchObject({
      outcome: 'cancelled',
      rollback: 'applied',
      finalValue: 10,
      changed: false,
    })
    expect(nexus.getState().values).toEqual({ value: 10, other: 9 })
    gesture.begin()
    expect(gesture.commit()).toMatchObject({ changed: false, rollback: 'unnecessary' })
    gesture.release()
    nexus.destroy()
  })
  it('external A-B-A writes revoke ownership before returning to the same value', async () => {
    const nexus = create(),
      onEnd = vi.fn()
    const gesture = nexus.createNumericGesture(nexus.fields.value, { onEnd })
    gesture.begin()
    gesture.update(30)
    nexus.setValue(nexus.fields.value, 40)
    nexus.setValue(nexus.fields.value, 30)
    expect(gesture.active).toBe(false)
    expect(gesture.cancel('escape')).toBeUndefined()
    expect(nexus.getState().values.value).toBe(30)
    await Promise.resolve()
    expect(onEnd).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'external-write', finalValue: 40, rollback: 'superseded' }),
    )
    gesture.release()
    nexus.destroy()
  })
  it('preserves the reentrant-write guard during subscriber callbacks', () => {
    const nexus = create()
    const gesture = nexus.createNumericGesture(nexus.fields.value)
    const off = nexus.subscribe(() => {
      expect(() => nexus.setValue(nexus.fields.value, 90)).toThrowError(
        expect.objectContaining({ code: 'reentrant-write' }),
      )
      expect(() => gesture.commit()).toThrowError(
        expect.objectContaining({ code: 'reentrant-write' }),
      )
    })
    gesture.begin()
    gesture.update(30)
    off()
    expect(gesture.cancel()).toMatchObject({ rollback: 'applied' })
    gesture.release()
    nexus.destroy()
  })
  it('release and successful destruction cancel while rejected destruction does not', () => {
    const nexus = create(),
      scope = nexus.scope('controls')
    const binding = acquireBindingLease(scope, {
      itemId: 'value',
      field: nexus.fields.value,
      mode: 'input',
    })
    const gesture = nexus.createNumericGesture(nexus.fields.value)
    gesture.begin()
    gesture.update(30)
    expect(() => nexus.destroy()).toThrowError(
      expect.objectContaining({ code: 'root-has-active-leases' }),
    )
    expect(gesture.active).toBe(true)
    gesture.release()
    gesture.release()
    expect(nexus.getState().values.value).toBe(10)
    binding.release()
    const next = nexus.createNumericGesture(nexus.fields.value)
    next.begin()
    next.update(40)
    nexus.destroy()
    expect(next.active).toBe(false)
    next.release()
  })
  it('keeps input validation and clears its own invalid draft on cancellation', () => {
    const nexus = create(),
      scope = nexus.scope('controls')
    const binding = acquireBindingLease(scope, {
      itemId: 'value',
      field: nexus.fields.value,
      mode: 'input',
    })
    const gesture = scope.createNumericInputGesture(binding)
    gesture.begin()
    gesture.update(30)
    expect(gesture.update(-1)).toMatchObject({ ok: false })
    expect(scope.getState().interaction.bindings.get('value')?.get('value')?.draft).toBe(-1)
    expect(gesture.cancel()).toMatchObject({ rollback: 'applied', finalValue: 10 })
    expect(scope.getState().interaction.bindings.size).toBe(0)
    gesture.begin()
    gesture.update(50)
    binding.release()
    expect(gesture.active).toBe(false)
    expect(nexus.getState().values.value).toBe(10)
    gesture.release()
    nexus.destroy()
  })
  it('rejects unavailable rollback honestly', () => {
    let floor = 0
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: {
        value: {
          defaultValue: 10,
          validate: (value: number) => (value < floor ? [{ message: 'Below floor' }] : []),
        },
      },
    })
    const gesture = nexus.createNumericGesture(nexus.fields.value)
    gesture.begin()
    gesture.update(30)
    floor = 20
    expect(gesture.cancel()).toMatchObject({ rollback: 'rejected', finalValue: 30, changed: true })
    gesture.release()
    nexus.destroy()
  })
  it('scope destruction cancels only its controllers even without metadata', () => {
    const nexus = create(),
      scope = nexus.scope('controls')
    const gesture = scope.createNumericGesture(scope.fields.value)
    gesture.begin()
    gesture.update(30)
    scope.destroyScope()
    expect(gesture.active).toBe(false)
    expect(nexus.getState().values.value).toBe(10)
    gesture.release()
    nexus.destroy()
  })
  it('revokes ownership for an external invalid draft without erasing it', async () => {
    const nexus = create(),
      scope = nexus.scope('controls'),
      onEnd = vi.fn()
    const binding = acquireBindingLease(scope, {
      itemId: 'value',
      field: nexus.fields.value,
      mode: 'input',
    })
    const gesture = scope.createNumericInputGesture(binding, { onEnd })
    gesture.begin()
    gesture.update(30)
    scope.setInput(binding, -2)
    expect(gesture.active).toBe(false)
    expect(gesture.cancel('escape')).toBeUndefined()
    expect(scope.getState().interaction.bindings.get('value')?.get('value')?.draft).toBe(-2)
    expect(nexus.getState().values.value).toBe(30)
    await Promise.resolve()
    expect(onEnd).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'external-write', rollback: 'superseded' }),
    )
    gesture.release()
    binding.release()
    nexus.destroy()
  })
  it('preserves a permitted nonnumeric external write and reports numeric unavailability', async () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { value: { defaultValue: 1 } },
    })
    const onEnd = vi.fn()
    const gesture = nexus.createNumericGesture(nexus.fields.value, { onEnd })
    gesture.begin()
    gesture.update(2)
    // JSON default types do not imply runtime domain validation.
    expect(nexus.setValues({ value: null } as never).ok).toBe(true)
    expect(gesture.active).toBe(false)
    await Promise.resolve()
    expect(onEnd).toHaveBeenCalledWith(
      expect.objectContaining({ finalValue: null, reason: 'external-write' }),
    )
    expect(() => gesture.begin()).toThrow()
    gesture.release()
    nexus.destroy()
  })
  it('keeps rollback persistence failures recoverable during root destruction', () => {
    const driver = createMemoryPersistence()
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      nexusId: 'gestures',
      schemaVersion: 1,
      fields: { value: { defaultValue: 1 } },
      persistence: { driver, storageKey: 'gesture', values: { defaultFieldPolicy: 'include' } },
    })
    const gesture = nexus.createNumericGesture(nexus.fields.value)
    gesture.begin()
    gesture.update(2)
    driver.failNext('write')
    expect(() => nexus.destroy()).toThrowError(
      expect.objectContaining({ code: 'root-has-unpersisted-state' }),
    )
    expect(nexus.getState().values.value).toBe(1)
    expect(gesture.active).toBe(false)
    nexus.destroy({ discardUnpersisted: true })
  })
})

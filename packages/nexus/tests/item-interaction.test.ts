import { describe, it, expect } from 'vite-plus/test'
import { createPicodashNexus } from '../src/index.js'
import { acquireBindingLease } from '../src/integration.js'

describe('source-owned item interaction', () => {
  it('combines independent sources and preserves separately named profile intent', () => {
    const root = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { value: { defaultValue: 1 } },
    })
    const scope = root.scope('controls'),
      left = scope.createItemInteractionSource('value'),
      right = scope.createItemInteractionSource('value'),
      profile = scope.createItemInteractionSource('main:value')
    left.set({ hovered: true })
    right.set({ focused: true })
    profile.set({ active: true })
    left.set({ hovered: false })
    expect(scope.getState().interaction.items.get('value')).toEqual({
      hovered: false,
      focused: true,
      active: false,
    })
    expect(scope.getState().interaction.items.get('main:value')?.active).toBe(true)
    const binding = acquireBindingLease(scope, {
      itemId: 'value',
      field: root.fields.value,
      mode: 'input',
    })
    scope.setInput(binding, null)
    binding.release()
    expect(scope.getState().interaction.items.get('value')?.focused).toBe(true)
    right.release()
    right.release()
    left.release()
    profile.release()
    expect(scope.getState().interaction.items.size).toBe(0)
    expect(root.getState().scopes.size).toBe(0)
    root.destroy()
  })
  it('rejects malformed flags without invoking accessors and cleans scope destruction', () => {
    const root = createPicodashNexus({
        valueOwner: 'nexus',
        fields: { value: { defaultValue: 1 } },
      }),
      scope = root.scope('controls')
    const source = scope.createItemInteractionSource('external-profile')
    const patch = Object.defineProperty({}, 'hovered', {
      get() {
        throw new Error('must not invoke')
      },
    })
    expect(() => source.set(patch)).toThrowError(
      expect.objectContaining({ code: 'invalid-configuration' }),
    )
    source.set({ hovered: true })
    scope.destroyScope()
    expect(scope.getState().interaction.items.size).toBe(0)
    expect(() => source.set({ active: true })).toThrowError(
      expect.objectContaining({ code: 'invalid-configuration' }),
    )
    source.release()
    root.destroy()
  })
})

import { describe, expect, it, vi } from 'vite-plus/test'
import { createPanelRuntime, type PanelRuntimeConfig } from './panel-runtime.ts'

const config = (scopeId: string, overrides: Omit<PanelRuntimeConfig, 'scopeId'> = {}) => ({
  scopeId,
  ...overrides,
})

describe('private DashPanel runtime model', () => {
  it('applies defaults and preserves frozen snapshot identities for no-ops', () => {
    const runtime = createPanelRuntime()
    runtime.acquire(config('first'))
    const first = runtime.getSnapshot()
    expect(first.panels.first).toEqual({
      scopeId: 'first',
      visible: true,
      collapsed: false,
      collapsible: true,
    })
    expect(first.activationOrder).toEqual(['first'])
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.panels)).toBe(true)
    expect(Object.isFrozen(first.panels.first)).toBe(true)
    expect(Object.isFrozen(first.activationOrder)).toBe(true)

    expect(runtime.show('first')).toEqual({ status: 'executed' })
    const second = runtime.getSnapshot()
    expect(second).toBe(first)
    expect(second.panels).toBe(first.panels)
    expect(second.panels.first).toBe(first.panels.first)
    expect(second.activationOrder).toBe(first.activationOrder)
  })

  it('rejects an invalid initial policy before registration or notification', () => {
    const runtime = createPanelRuntime()
    const listener = vi.fn()
    runtime.subscribe(listener)
    expect(() =>
      runtime.acquire(config('invalid', { defaultCollapsed: true, collapsible: false })),
    ).toThrow('non-collapsible Panel cannot start collapsed')
    expect(runtime.getSnapshot().activationOrder).toEqual([])
    expect(listener).not.toHaveBeenCalled()
  })

  it('commits visibility transitions, activation order, and latest callbacks', () => {
    const runtime = createPanelRuntime()
    const events: string[] = []
    const firstVisibility = vi.fn((visible: boolean) => events.push(`first:${visible}`))
    const secondVisibility = vi.fn((visible: boolean) => events.push(`second:${visible}`))
    runtime.acquire(config('first', { defaultVisible: false, onVisibilityChange: firstVisibility }))
    runtime.acquire(config('second', { onVisibilityChange: secondVisibility }))
    const notified: string[] = []
    runtime.subscribe(() => {
      const snapshot = runtime.getSnapshot()
      notified.push(`${snapshot.panels.first?.visible}/${snapshot.activationOrder.join(',')}`)
    })

    expect(runtime.show('first')).toEqual({ status: 'executed' })
    expect(runtime.getSnapshot().panels.first?.visible).toBe(true)
    expect(runtime.getSnapshot().activationOrder).toEqual(['second', 'first'])
    expect(firstVisibility).toHaveBeenCalledWith(true)
    expect(notified).toEqual(['true/second,first'])
    expect(events).toEqual(['first:true'])

    runtime.hide('first')
    expect(runtime.getSnapshot().activationOrder).toEqual(['second', 'first'])
    expect(firstVisibility).toHaveBeenLastCalledWith(false)
    expect(runtime.show('first')).toEqual({ status: 'executed' })
    expect(firstVisibility).toHaveBeenCalledTimes(3)
    expect(secondVisibility).not.toHaveBeenCalled()
  })

  it('keeps activation order through hide and toggles only when becoming visible', () => {
    const runtime = createPanelRuntime()
    runtime.acquire(config('a'))
    runtime.acquire(config('b'))
    const before = runtime.getSnapshot()
    runtime.hide('a')
    expect(runtime.getSnapshot().activationOrder).toEqual(['a', 'b'])
    runtime.toggleVisibility('a')
    expect(runtime.getSnapshot().activationOrder).toEqual(['b', 'a'])
    runtime.toggleVisibility('a')
    expect(runtime.getSnapshot().activationOrder).toEqual(['b', 'a'])
    expect(runtime.getSnapshot()).not.toBe(before)
  })

  it('returns unavailable for released or unknown scopes and release is idempotent', () => {
    const runtime = createPanelRuntime()
    const visibility = vi.fn()
    const registration = runtime.acquire(config('panel', { onVisibilityChange: visibility }))
    registration.release()
    registration.release()
    expect(runtime.show('panel')).toEqual({ status: 'not_executed', reason: 'unavailable' })
    expect(runtime.hide('missing')).toEqual({ status: 'not_executed', reason: 'unavailable' })
    expect(visibility).not.toHaveBeenCalled()
  })

  it('supports collapse policy, no-op commands, and deterministic not-collapsible results', () => {
    const runtime = createPanelRuntime()
    const collapsed = vi.fn()
    runtime.acquire(config('panel', { onCollapsedChange: collapsed }))
    const notifications = vi.fn()
    runtime.subscribe(notifications)
    expect(runtime.expand('panel')).toEqual({ status: 'executed' })
    expect(notifications).not.toHaveBeenCalled()
    expect(runtime.collapse('panel')).toEqual({ status: 'executed' })
    expect(runtime.getSnapshot().panels.panel?.collapsed).toBe(true)
    expect(collapsed).toHaveBeenCalledWith(true)
    expect(runtime.collapse('panel')).toEqual({ status: 'executed' })
    expect(notifications).toHaveBeenCalledTimes(1)
    expect(runtime.toggleCollapsed('panel')).toEqual({ status: 'executed' })
    expect(runtime.getSnapshot().panels.panel?.collapsed).toBe(false)

    const latest = vi.fn()
    const registration = runtime.acquire(config('other', { collapsible: false }))
    expect(runtime.collapse('other')).toEqual({ status: 'not_executed', reason: 'not_collapsible' })
    const policyBefore = runtime.getSnapshot()
    registration.update({ collapsible: true, onCollapsedChange: latest })
    expect(runtime.getSnapshot()).not.toBe(policyBefore)
    expect(runtime.collapse('other')).toEqual({ status: 'executed' })
    expect(latest).toHaveBeenCalledWith(true)

    const expanded = runtime.acquire(config('expanded'))
    const expandedBefore = runtime.getSnapshot()
    const expandedNotifications = vi.fn()
    runtime.subscribe(expandedNotifications)
    expanded.update({ collapsible: false })
    expect(runtime.getSnapshot()).not.toBe(expandedBefore)
    expect(runtime.getSnapshot().panels.expanded?.collapsible).toBe(false)
    expect(expandedNotifications).toHaveBeenCalledTimes(1)
  })

  it('expands a collapsed panel when disabling collapse and calls the latest callback once', () => {
    const runtime = createPanelRuntime()
    const oldCallback = vi.fn()
    const latestCallback = vi.fn()
    const registration = runtime.acquire(config('panel', { onCollapsedChange: oldCallback }))
    runtime.collapse('panel')
    const before = runtime.getSnapshot()
    const notifications = vi.fn()
    runtime.subscribe(notifications)
    registration.update({ onCollapsedChange: latestCallback, collapsible: false })
    const after = runtime.getSnapshot()
    expect(after.panels.panel?.collapsed).toBe(false)
    expect(after.panels.panel?.collapsible).toBe(false)
    expect(after).not.toBe(before)
    expect(notifications).toHaveBeenCalledTimes(1)
    expect(oldCallback).toHaveBeenCalledTimes(1)
    expect(latestCallback).toHaveBeenCalledWith(false)
    registration.update({ collapsible: true })
    expect(runtime.getSnapshot().panels.panel?.collapsed).toBe(false)
  })

  it('updates callback references without publishing and uses the latest callback', () => {
    const runtime = createPanelRuntime()
    const first = vi.fn()
    const second = vi.fn()
    const registration = runtime.acquire(config('panel', { onVisibilityChange: first }))
    const snapshot = runtime.getSnapshot()
    const notifications = vi.fn()
    runtime.subscribe(notifications)
    registration.update({ onVisibilityChange: second })
    expect(runtime.getSnapshot()).toBe(snapshot)
    expect(notifications).not.toHaveBeenCalled()
    runtime.hide('panel')
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith(false)
  })

  it('publishes before callback exceptions and does not roll back state', () => {
    const runtime = createPanelRuntime()
    const callback = vi.fn(() => {
      expect(runtime.getSnapshot().panels.panel?.visible).toBe(false)
      throw new Error('callback failed')
    })
    runtime.acquire(config('panel', { onVisibilityChange: callback }))
    const notifications = vi.fn()
    runtime.subscribe(notifications)
    expect(() => runtime.hide('panel')).toThrow('callback failed')
    expect(notifications).toHaveBeenCalledTimes(1)
    expect(runtime.getSnapshot().panels.panel?.visible).toBe(false)
  })

  it('rejects duplicate active scopes without mutation and protects reused generations', () => {
    const runtime = createPanelRuntime()
    const first = runtime.acquire(config('panel'))
    const before = runtime.getSnapshot()
    expect(() => runtime.acquire(config('panel'))).toThrow('already active')
    expect(runtime.getSnapshot()).toBe(before)
    first.release()
    const second = runtime.acquire(config('panel', { defaultVisible: false }))
    const reused = runtime.getSnapshot()
    first.update({ collapsible: false })
    first.release()
    expect(runtime.getSnapshot()).toBe(reused)
    expect(runtime.getSnapshot().panels.panel?.visible).toBe(false)
    second.release()
  })

  it('notifies subscribers only for commits and supports unsubscribe', () => {
    const runtime = createPanelRuntime()
    const listener = vi.fn()
    const unsubscribe = runtime.subscribe(listener)
    const registration = runtime.acquire(config('panel'))
    expect(listener).toHaveBeenCalledTimes(1)
    runtime.activate('panel')
    expect(listener).toHaveBeenCalledTimes(1)
    registration.release()
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
    runtime.acquire(config('again'))
    expect(listener).toHaveBeenCalledTimes(2)
  })
})

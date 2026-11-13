import { describe, expect, it, vi } from 'vite-plus/test'
import { createPicodashNexus, type DashPanelLayoutRecord } from '@picodash/nexus'
import { createPanelRuntime } from './panel-runtime.ts'

const initial: DashPanelLayoutRecord = {
  version: 2,
  manualSize: { width: 100, height: 200 },
  preferredPosition: { x: 10, y: 20 },
}
const external: DashPanelLayoutRecord = {
  version: 2,
  manualSize: { width: 100, height: 300 },
  preferredPosition: { x: 40, y: 50 },
}

function setup() {
  const nexus = createPicodashNexus({ valueOwner: 'nexus', fields: {} })
  const scoped = nexus.scope('panel')
  scoped.setDashPanelLayout(initial)
  const runtime = createPanelRuntime()
  const registration = runtime.acquire({
    scopeId: 'panel',
    nexus: scoped,
    layout: scoped.getState().scope?.dashPanel,
    preferredPosition: initial.preferredPosition,
    defaultLayout: {
      placement: { mode: 'floating', disposition: { kind: 'free' } },
      preferredPosition: { x: 1, y: 2 },
    },
    currentPosition: () => ({ x: 10, y: 20 }),
  })
  return {
    nexus,
    scoped,
    runtime,
    registration,
    release: () => {
      registration.release()
      nexus.destroy()
    },
  }
}

describe('Panel commands read current public Nexus metadata', () => {
  it('merges a size write with external axes and position before any registration effect', () => {
    const { scoped, runtime, release } = setup()
    scoped.setDashPanelLayout(external)
    const snapshots: (DashPanelLayoutRecord | undefined)[] = []
    scoped.subscribe(() => snapshots.push(scoped.getState().scope?.dashPanel))

    expect(runtime.setSize('panel', { width: 150 })).toMatchObject({
      status: 'executed',
      transaction: { ok: true, changedScopeIds: ['panel'] },
    })
    expect(scoped.getState().scope?.dashPanel).toEqual({
      ...external,
      manualSize: { width: 150, height: 300 },
    })
    expect(snapshots).toEqual([{ ...external, manualSize: { width: 150, height: 300 } }])
    release()
  })

  it('restores one axis without deleting externally changed size or position', () => {
    const { scoped, runtime, release } = setup()
    scoped.setDashPanelLayout(external)
    const subscriber = vi.fn()
    scoped.subscribe(subscriber)

    expect(runtime.restorePreferredSize('panel', { axes: 'width' })).toMatchObject({
      status: 'executed',
      transaction: { ok: true },
    })
    expect(scoped.getState().scope?.dashPanel).toEqual({ ...external, manualSize: { height: 300 } })
    expect(subscriber).toHaveBeenCalledTimes(1)
    release()
  })

  it.each([
    { mode: 'floating', disposition: { kind: 'free' } },
    { mode: 'floating', disposition: { kind: 'snapped', position: 'top' } },
  ] as const)(
    'placement selection retains fresh manual size and free-position preference',
    (placement) => {
      const { scoped, runtime, release } = setup()
      scoped.setDashPanelLayout(external)

      expect(runtime.setPlacement('panel', placement)).toMatchObject({
        status: 'executed',
        transaction: { ok: true },
      })
      expect(scoped.getState().scope?.dashPanel).toEqual({ ...external, placement })
      release()
    },
  )

  it('treats an externally removed record as authoritative rather than resurrecting cached overrides', () => {
    const { scoped, runtime, release } = setup()
    scoped.resetDashPanelLayout()

    expect(runtime.setSize('panel', { width: 150 })).toMatchObject({
      status: 'executed',
      transaction: { ok: true },
    })
    expect(scoped.getState().scope?.dashPanel).toEqual({ version: 2, manualSize: { width: 150 } })
    scoped.resetDashPanelLayout()
    const placement = {
      mode: 'floating',
      disposition: { kind: 'snapped', position: 'top' },
    } as const
    expect(runtime.setPlacement('panel', placement)).toMatchObject({
      status: 'executed',
      transaction: { ok: true },
    })
    expect(scoped.getState().scope?.dashPanel).toEqual({
      version: 2,
      placement,
      preferredPosition: { x: 1, y: 2 },
    })
    release()
  })

  it('preserves external state when a complete resize candidate is rejected or commands become unavailable', () => {
    const { scoped, runtime, registration, release } = setup()
    scoped.setDashPanelLayout(external)
    const before = scoped.getState()
    const subscriber = vi.fn()
    scoped.subscribe(subscriber)

    expect(runtime.commitResize('panel', { width: 150 }, { x: NaN, y: 0 })).toMatchObject({
      status: 'executed',
      transaction: { ok: false },
    })
    expect(scoped.getState()).toBe(before)
    registration.update({ presentation: { kind: 'drawer', edge: 'left' } })
    expect(runtime.setSize('panel', { width: 150 })).toEqual({
      status: 'not_executed',
      reason: 'modal_presentation',
    })
    expect(runtime.restorePreferredSize('panel')).toEqual({
      status: 'not_executed',
      reason: 'modal_presentation',
    })
    expect(scoped.getState()).toBe(before)
    expect(subscriber).not.toHaveBeenCalled()
    release()
  })
})

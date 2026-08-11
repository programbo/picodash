import { describe, expect, it } from 'vite-plus/test'
import {
  claimDashPanelDock,
  isDashPanelDockOccupied,
  resolveDashPanelDockOccupancy,
  resolveDashPanelDockSideAllocation,
  resolveDashPanelDockSlot,
} from './dock-arena.ts'

const occupant = (id: string, position: string) => ({ id, position })

describe('DashPanel dock arena occupancy', () => {
  it('maps full and center positions to one exact main slot', () => {
    expect(resolveDashPanelDockSlot('full-left')).toBe('main-left')
    expect(resolveDashPanelDockSlot('center-left')).toBe('main-left')
    expect(resolveDashPanelDockSlot('full-top')).toBe('main-top')
    expect(resolveDashPanelDockSlot('center-top')).toBe('main-top')
  })

  it('keeps the first committed lease and reports every exact-slot conflict', () => {
    const snapshot = resolveDashPanelDockOccupancy([
      occupant('center', 'center-left'),
      occupant('full', 'full-left'),
      occupant('top', 'top-left'),
      occupant('bottom', 'bottom-left'),
      occupant('orthogonal', 'full-top'),
    ] as never)
    expect(snapshot.occupants.map((value) => value.id)).toEqual([
      'top',
      'bottom',
      'center',
      'orthogonal',
    ])
    expect(snapshot.conflicts).toEqual([
      expect.objectContaining({
        reason: 'dock_occupied',
        occupant: { id: 'full', position: 'full-left' },
        slot: 'main-left',
      }),
    ])
    expect(isDashPanelDockOccupied(snapshot.occupants, 'full-left')).toBe(true)
    expect(isDashPanelDockOccupied(snapshot.occupants, 'full-left', 'center')).toBe(false)
  })

  it('claims atomically and allows orthogonal slots to coexist', () => {
    const initial = [{ id: 'left', position: 'full-left' }] as never
    const rejected = claimDashPanelDock(initial, occupant('center', 'center-left') as never)
    expect(rejected.status).toBe('rejected')
    expect(rejected.conflict?.reason).toBe('dock_occupied')
    expect(rejected.occupancy.occupants).toEqual([{ id: 'left', position: 'full-left' }])
    const accepted = claimDashPanelDock(initial, occupant('top', 'full-top') as never)
    expect(accepted.status).toBe('accepted')
    expect(accepted.occupancy.occupants).toHaveLength(2)
  })

  it('rejects malformed and duplicate occupants without mutating input', () => {
    const values = [occupant('one', 'top-left')]
    expect(() =>
      resolveDashPanelDockOccupancy([
        occupant('one', 'bottom-left'),
        occupant('one', 'top-right'),
      ] as never),
    ).toThrow(TypeError)
    expect(() => resolveDashPanelDockOccupancy([occupant('one', 'middle-left')] as never)).toThrow(
      TypeError,
    )
    const result = resolveDashPanelDockOccupancy(values as never)
    expect(values).toEqual([occupant('one', 'top-left')])
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.occupants)).toBe(true)
  })
})

describe('DashPanel side allocation caps', () => {
  const allocation = (positions: string[]) =>
    resolveDashPanelDockSideAllocation(
      'left',
      positions.map((position, index) => occupant(String(index), position)) as never,
      300,
    )

  it.each([
    [['full-left'], { 'full-left': 1 }],
    [['center-left'], { 'center-left': 1 }],
    [['top-left'], { 'top-left': 2 / 3 }],
    [['top-left', 'bottom-left'], { 'top-left': 1 / 2, 'bottom-left': 1 / 2 }],
    [['top-left', 'full-left'], { 'top-left': 1 / 3, 'full-left': 2 / 3 }],
    [['top-left', 'center-left'], { 'top-left': 1 / 3, 'center-left': 1 / 3 }],
    [
      ['top-left', 'bottom-left', 'center-left'],
      { 'top-left': 1 / 3, 'bottom-left': 1 / 3, 'center-left': 1 / 3 },
    ],
  ])('allocates %j according to the accepted cap table', (positions, expected) => {
    const result = allocation(positions)
    expect(
      Object.fromEntries(result.allocations.map((value) => [value.position, value.ratio])),
    ).toEqual(expected)
    expect(result.allocations.every((value) => value.max === 300 * value.ratio)).toBe(true)
  })

  it('computes left and right independently and leaves the documented empty remainder', () => {
    const result = resolveDashPanelDockSideAllocation(
      'right',
      [occupant('corner', 'top-right'), occupant('center', 'center-right')] as never,
      120,
    )
    expect(result.unused).toBe(40)
    expect(result.allocations.map((value) => value.max)).toEqual([40, 40])
    expect(result.allocations.map((value) => value.offset)).toEqual([0, 40])
  })
})

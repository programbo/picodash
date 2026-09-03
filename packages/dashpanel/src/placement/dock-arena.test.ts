import { describe, expect, it } from 'vite-plus/test'
import {
  claimDashPanelDock,
  isDashPanelDockOccupied,
  resolveDashPanelDockOccupancy,
  resolveDashPanelDockSideAllocation,
  resolveDashPanelDockSlot,
  type DashPanelDockOccupant,
} from './dock-arena.ts'
import type { DashPanelDockPosition } from './placement.ts'

const occupant = (id: string, position: DashPanelDockPosition): DashPanelDockOccupant => ({
  id,
  position,
})

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
    ])
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
    const initial = [occupant('left', 'full-left')]
    const rejected = claimDashPanelDock(initial, occupant('center', 'center-left'))
    expect(rejected.status).toBe('rejected')
    expect(rejected.conflict?.reason).toBe('dock_occupied')
    expect(rejected.occupancy.occupants).toEqual([{ id: 'left', position: 'full-left' }])
    const accepted = claimDashPanelDock(initial, occupant('top', 'full-top'))
    expect(accepted.status).toBe('accepted')
    expect(accepted.occupancy.occupants).toHaveLength(2)
  })

  it('rejects malformed and duplicate occupants without mutating input', () => {
    const values = [occupant('one', 'top-left')]
    expect(() =>
      resolveDashPanelDockOccupancy([occupant('one', 'bottom-left'), occupant('one', 'top-right')]),
    ).toThrow(TypeError)
    expect(() =>
      resolveDashPanelDockOccupancy([{ id: 'one', position: 'middle-left' }] as never),
    ).toThrow(TypeError)
    const result = resolveDashPanelDockOccupancy(values as never)
    expect(values).toEqual([occupant('one', 'top-left')])
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.occupants)).toBe(true)
  })
})

describe('DashPanel side allocation caps', () => {
  const allocation = (side: 'left' | 'right', positions: readonly DashPanelDockPosition[]) =>
    resolveDashPanelDockSideAllocation(
      side,
      positions.map((position, index) => occupant(String(index), position)),
      300,
    )

  for (const side of ['left', 'right'] as const) {
    const top = `top-${side}` satisfies DashPanelDockPosition
    const bottom = `bottom-${side}` satisfies DashPanelDockPosition
    const full = `full-${side}` satisfies DashPanelDockPosition
    const center = `center-${side}` satisfies DashPanelDockPosition

    it.each([
      [[full], { [full]: { ratio: 1, offset: 0 } }, 0],
      [[center], { [center]: { ratio: 1, offset: 0 } }, 0],
      [[top], { [top]: { ratio: 2 / 3, offset: 0 } }, 100],
      [[bottom], { [bottom]: { ratio: 2 / 3, offset: 100 } }, 100],
      [
        [top, bottom],
        {
          [top]: { ratio: 1 / 2, offset: 0 },
          [bottom]: { ratio: 1 / 2, offset: 150 },
        },
        0,
      ],
      [
        [top, full],
        { [top]: { ratio: 1 / 3, offset: 0 }, [full]: { ratio: 2 / 3, offset: 100 } },
        0,
      ],
      [
        [bottom, full],
        {
          [bottom]: { ratio: 1 / 3, offset: 200 },
          [full]: { ratio: 2 / 3, offset: 0 },
        },
        0,
      ],
      [
        [top, center],
        { [top]: { ratio: 1 / 3, offset: 0 }, [center]: { ratio: 1 / 3, offset: 100 } },
        100,
      ],
      [
        [bottom, center],
        {
          [bottom]: { ratio: 1 / 3, offset: 200 },
          [center]: { ratio: 1 / 3, offset: 100 },
        },
        100,
      ],
      [
        [top, bottom, center],
        {
          [top]: { ratio: 1 / 3, offset: 0 },
          [bottom]: { ratio: 1 / 3, offset: 200 },
          [center]: { ratio: 1 / 3, offset: 100 },
        },
        0,
      ],
    ])(
      `allocates %j on the ${side} according to the accepted cap table`,
      (positions, expected, unused) => {
        const result = allocation(side, positions)
        expect(
          Object.fromEntries(
            result.allocations.map((value) => [
              value.position,
              { ratio: value.ratio, offset: value.offset },
            ]),
          ),
        ).toEqual(expected)
        expect(result.allocations.every((value) => value.max === 300 * value.ratio)).toBe(true)
        expect(result.unused).toBe(unused)
      },
    )
  }

  it('computes left and right independently and leaves the documented empty remainder', () => {
    const result = resolveDashPanelDockSideAllocation(
      'right',
      [occupant('corner', 'top-right'), occupant('center', 'center-right')],
      120,
    )
    expect(result.unused).toBe(40)
    expect(result.allocations.map((value) => value.max)).toEqual([40, 40])
    expect(result.allocations.map((value) => value.offset)).toEqual([0, 40])
  })
})

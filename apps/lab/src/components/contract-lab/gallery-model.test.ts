import { describe, expect, it } from 'vite-plus/test'
import {
  changeDate,
  changeDateRange,
  changeNumericRange,
  changeNumericSlider,
  numericPriority,
  changeTime,
  createGalleryNexus,
  dateTimeBounds,
  numericReadouts,
  temporalParts,
} from './gallery-model'

describe('linked gallery values', () => {
  it('stores shared choices and source values without mirrored or computed fields', () => {
    const nexus = createGalleryNexus()
    expect(nexus.getState().values.bipolar).toBe(0)
    expect(nexus.setValues({ choice: 'Option C', selections: ['Option C'] }).ok).toBe(true)
    expect(nexus.getState().values.choice).toBe('Option C')
    expect(nexus.getState().values.selections).toEqual(['Option C'])
    for (const key of [
      'radioGroup',
      'combobox',
      'select',
      'segmented',
      'checkboxGroup',
      'multiSelect',
      'meter',
      'progress',
      'date',
      'time',
    ]) {
      expect(Object.hasOwn(nexus.fields, key)).toBe(false)
    }
  })

  it('lets the higher control govern both edits without duplicating priority state', () => {
    const initial = { slider: 48, range: { start: 24, end: 76 } }
    const sliderFirst = numericPriority(['SliderDashlet', 'RangeDashlet'])
    const rangeFirst = numericPriority(['RangeDashlet', 'SliderDashlet'])
    expect(sliderFirst).toBe('slider')
    expect(rangeFirst).toBe('range')
    for (const slider of [0, 100]) {
      const next = changeNumericSlider(initial, slider, sliderFirst)
      expect(next.slider).toBe(slider)
      expect(next.range).toEqual({ start: Math.min(24, slider), end: Math.max(76, slider) })
      expect(changeNumericSlider(initial, slider, rangeFirst).slider).toBe(slider === 0 ? 24 : 76)
    }
    expect(changeNumericRange(initial, { start: 60, end: 80 }, sliderFirst)).toEqual({
      slider: 48,
      range: { start: 48, end: 80 },
    })
    expect(changeNumericRange(initial, { start: 0, end: 20 }, sliderFirst)).toEqual({
      slider: 48,
      range: { start: 0, end: 48 },
    })
    const nexus = createGalleryNexus()
    const observed: unknown[] = []
    const unsubscribe = nexus.subscribe(() => observed.push(nexus.getState().values.numeric))
    const expanded = changeNumericSlider(initial, 90, sliderFirst)
    expect(nexus.setValues({ numeric: expanded }).ok).toBe(true)
    const clamped = changeNumericRange(expanded, { start: 20, end: 60 }, rangeFirst)
    expect(nexus.setValues({ numeric: clamped }).ok).toBe(true)
    expect(observed).toEqual([expanded, { slider: 60, range: { start: 20, end: 60 } }])
    unsubscribe()
  })

  it('clamps a shrinking range and its slider in one observable transaction', () => {
    const nexus = createGalleryNexus()
    const observed: unknown[] = []
    const unsubscribe = nexus.subscribe(() => observed.push(nexus.getState().values.numeric))
    const next = changeNumericRange(nexus.getState().values.numeric, { start: 60, end: 80 })
    expect(nexus.setValues({ numeric: next }).ok).toBe(true)
    expect(observed).toEqual([{ range: { start: 60, end: 80 }, slider: 60 }])
    unsubscribe()
    expect(numericReadouts(next)).toEqual({ span: 20, progress: 0 })
    expect(numericReadouts({ ...next, slider: 70 }).progress).toBe(50)
    expect(numericReadouts({ ...next, slider: 80 }).progress).toBe(100)
  })

  it.each([0, 50, 100])(
    'keeps a collapsed range at %i finite and permits reopening it',
    (point) => {
      const initial = { slider: 48, range: { start: 24, end: 76 } }
      const fixed = changeNumericRange(initial, { start: point, end: point })
      expect(fixed.slider).toBe(point)
      expect(numericReadouts(fixed)).toEqual({ span: 0, progress: 0 })
      expect(changeNumericRange(fixed, { start: 0, end: 100 }).slider).toBe(point)
    },
  )

  it('rejects programmatic attempts to violate the numeric invariant without mutation', () => {
    const nexus = createGalleryNexus()
    const before = nexus.getState()
    for (const value of [
      { slider: 90, range: { start: 20, end: 80 } },
      { slider: 50, range: { start: 80, end: 20 } },
      { slider: 50, range: { start: -1, end: 80 } },
    ])
      expect(nexus.setValues({ numeric: value }).ok).toBe(false)
    expect(nexus.getState()).toBe(before)
  })

  it('projects date and time from one zoned instant and preserves the other portion on edit', () => {
    const initial = createGalleryNexus().getState().values.temporal
    const dateEdited = changeDate(initial, '2026-08-22')
    expect(temporalParts(dateEdited)).toEqual({ date: '2026-08-22', time: '09:30:00' })
    const timeEdited = changeTime(dateEdited, '23:45:12')
    expect(temporalParts(timeEdited)).toEqual({ date: '2026-08-22', time: '23:45:12' })
    expect(timeEdited.dateTime).toBe('2026-08-22T15:45:12.000Z')
  })

  it('clamps either date endpoint atomically while preserving the local time', () => {
    const nexus = createGalleryNexus()
    const before = nexus.getState().values.temporal
    const observed: unknown[] = []
    nexus.subscribe(() => observed.push(nexus.getState().values.temporal))
    const next = changeDateRange(before, { start: '2026-08-21', end: '2026-08-21' })
    expect(nexus.setValues({ temporal: next }).ok).toBe(true)
    expect(observed).toEqual([next])
    expect(temporalParts(next)).toEqual({ date: '2026-08-21', time: '09:30:00' })
    const earlier = changeDateRange(next, { start: '2026-08-18', end: '2026-08-19' })
    expect(temporalParts(earlier)).toEqual({ date: '2026-08-19', time: '09:30:00' })
    const bounds = dateTimeBounds(next.range)
    expect(bounds).toEqual({ min: '2026-08-20T16:00:00.000Z', max: '2026-08-21T15:59:59.999Z' })
    expect(nexus.setValues({ temporal: { ...next, dateTime: bounds.max! } }).ok).toBe(true)
    const accepted = nexus.getState()
    expect(nexus.setValues({ temporal: { ...next, dateTime: '2026-08-21T16:00:00Z' } }).ok).toBe(
      false,
    )
    expect(nexus.getState()).toBe(accepted)
  })

  it('supports clearing shared dates or the window without inventing extra source fields', () => {
    const initial = createGalleryNexus().getState().values.temporal
    const empty = changeDate(initial, null)
    expect(temporalParts(empty)).toEqual({ date: null, time: null })
    expect(temporalParts(changeTime(empty, '12:00'))).toEqual({
      date: '2026-08-18',
      time: '12:00:00',
    })
    const unbounded = changeDateRange(initial, null)
    expect(dateTimeBounds(unbounded.range)).toEqual({})
    expect(temporalParts(unbounded)).toEqual(temporalParts(initial))
    expect(createGalleryNexus().setValues({ temporal: unbounded }).ok).toBe(true)
  })
})

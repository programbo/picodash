import { describe, expect, it } from 'vite-plus/test'
import * as dashlist from '@picodash/dashlist'
import * as facade from '../src/index.ts'

describe('@picodash/picodash ready-made exports', () => {
  it('reexports every stable Dashlet without wrapping it', () => {
    const names = [
      'TextDashlet',
      'NumberDashlet',
      'SliderDashlet',
      'SwitchDashlet',
      'SelectDashlet',
      'SegmentedDashlet',
      'DisplayDashlet',
      'CheckboxDashlet',
      'RadioGroupDashlet',
      'ComboboxDashlet',
      'CheckboxGroupDashlet',
      'MultiSelectDashlet',
      'SearchDashlet',
      'RangeDashlet',
      'MeterDashlet',
      'ProgressDashlet',
      'StatusDashlet',
      'DateDashlet',
      'TimeDashlet',
      'DateTimeDashlet',
      'DateRangeDashlet',
      'ColorDashlet',
    ] as const
    for (const name of names) expect(facade[name]).toBe(dashlist[name])
  })
})

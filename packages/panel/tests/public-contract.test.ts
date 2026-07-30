import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vite-plus/test'
import * as dashlet from '../src/dashlet.ts'
import * as ui from '../src/ui.ts'
import type { DataListProps, MetricProps, StatusProps, SurfaceProps } from '../src/dashlet.ts'
import type {
  ButtonProps,
  CardProps,
  MeterProps,
  ProgressBarProps,
  SelectProps,
  SliderProps,
  ToggleProps,
  ToolbarProps,
} from '../src/ui.ts'

test('exports the composable UI toolkit without implementation variant helpers', () => {
  expect(ui.Button).toBeTypeOf('function')
  expect(ui.Card).toBeTypeOf('function')
  expect(ui.Select).toBeTypeOf('function')
  expect(ui.Slider).toBeTypeOf('function')
  expect(ui.Toggle).toBeTypeOf('function')
  expect(ui.Meter).toBeTypeOf('function')
  expect(ui.MeterTrack).toBeTypeOf('function')
  expect(ui.MeterFill).toBeTypeOf('function')
  expect(ui.ProgressBar).toBeTypeOf('function')
  expect(ui.ProgressTrack).toBeTypeOf('function')
  expect(ui.ProgressFill).toBeTypeOf('function')
  expect(ui.Toolbar).toBeTypeOf('function')

  expect('ItemSurface' in ui).toBe(false)
  expect('ItemCaption' in ui).toBe(false)
  expect('ItemLegend' in ui).toBe(false)
  expect('ItemLegendItem' in ui).toBe(false)
  expect('ItemLegendSwatch' in ui).toBe(false)
  expect('ItemEmptyState' in ui).toBe(false)
  expect('buttonVariants' in ui).toBe(false)
  expect('badgeVariants' in ui).toBe(false)
  expect('tabsListVariants' in ui).toBe(false)
  expect('toggleVariants' in ui).toBe(false)
})

test('publishes named prop contracts for composition and React Aria interaction', () => {
  const button: Pick<ButtonProps, 'variant' | 'size'> = {
    size: 'sm',
    variant: 'secondary',
  }
  const card: Pick<CardProps, 'size'> = { size: 'sm' }
  const select: Pick<SelectProps, 'selectedKey' | 'onSelectionChange'> = {
    onSelectionChange: () => undefined,
    selectedKey: 'first',
  }
  const slider: Pick<SliderProps, 'minValue' | 'maxValue'> = {
    maxValue: 1,
    minValue: 0,
  }
  const meter: Pick<MeterProps, 'value' | 'aria-label'> = {
    'aria-label': 'Storage used',
    value: 50,
  }
  const progress: Pick<ProgressBarProps, 'isIndeterminate' | 'aria-label'> = {
    'aria-label': 'Uploading',
    isIndeterminate: true,
  }
  const toolbar: Pick<ToolbarProps, 'orientation' | 'aria-label'> = {
    'aria-label': 'Formatting',
    orientation: 'horizontal',
  }
  const toggle: Pick<ToggleProps, 'isSelected' | 'onChange'> = {
    isSelected: true,
    onChange: () => undefined,
  }
  const surface: Pick<SurfaceProps, 'variant' | 'size'> = {
    size: 'field',
    variant: 'dashed',
  }

  expect(button).toEqual({ size: 'sm', variant: 'secondary' })
  expect(card).toEqual({ size: 'sm' })
  expect(select.selectedKey).toBe('first')
  expect(slider).toEqual({ maxValue: 1, minValue: 0 })
  expect(meter.value).toBe(50)
  expect(progress.isIndeterminate).toBe(true)
  expect(toolbar.orientation).toBe('horizontal')
  expect(toggle.isSelected).toBe(true)
  expect(surface).toEqual({ size: 'field', variant: 'dashed' })
})

test('supports the canonical dashlet namespace with no implementation helpers or Item aliases', () => {
  expect(dashlet.Frame).toBeTypeOf('function')
  expect(dashlet.Metric).toBeTypeOf('function')
  expect(dashlet.Status).toBeTypeOf('function')
  expect(dashlet.DataList).toBeTypeOf('function')
  expect(dashlet.Surface).toBeTypeOf('function')
  expect(dashlet.Legend).toBeTypeOf('function')
  expect(dashlet.EmptyState).toBeTypeOf('function')

  expect('ItemSurface' in dashlet).toBe(false)
  expect('ItemEmptyState' in dashlet).toBe(false)
  expect('surfaceVariants' in dashlet).toBe(false)

  const metric: Pick<MetricProps, 'align'> = { align: 'end' }
  const status: Pick<StatusProps, 'tone'> = { tone: 'success' }
  const list: Pick<DataListProps, 'density'> = { density: 'compact' }

  expect(metric.align).toBe('end')
  expect(status.tone).toBe('success')
  expect(list.density).toBe('compact')
})

test('marks published component entries as client boundaries at their source entries', () => {
  const entryPaths = [
    fileURLToPath(new URL('../src/dashlet.ts', import.meta.url)),
    fileURLToPath(new URL('../src/ui.ts', import.meta.url)),
  ]

  for (const entryPath of entryPaths) {
    expect(readFileSync(entryPath, 'utf8')).toMatch(/^['"]use client['"]\s*$/m)
  }
})

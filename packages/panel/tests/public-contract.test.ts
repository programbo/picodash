import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vite-plus/test'
import * as ui from '../src/ui.ts'
import type {
  ButtonProps,
  CardProps,
  ItemSurfaceProps,
  SelectProps,
  SliderProps,
  ToggleProps,
} from '../src/ui.ts'

test('exports the composable UI toolkit without implementation variant helpers', () => {
  expect(ui.Button).toBeTypeOf('function')
  expect(ui.Card).toBeTypeOf('function')
  expect(ui.Select).toBeTypeOf('function')
  expect(ui.Slider).toBeTypeOf('function')
  expect(ui.Toggle).toBeTypeOf('function')
  expect(ui.ItemSurface).toBeTypeOf('function')
  expect(ui.ItemLegend).toBeTypeOf('function')
  expect(ui.ItemEmptyState).toBeTypeOf('function')

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
  const toggle: Pick<ToggleProps, 'isSelected' | 'onChange'> = {
    isSelected: true,
    onChange: () => undefined,
  }
  const surface: Pick<ItemSurfaceProps, 'variant' | 'size'> = {
    size: 'field',
    variant: 'dashed',
  }

  expect(button).toEqual({ size: 'sm', variant: 'secondary' })
  expect(card).toEqual({ size: 'sm' })
  expect(select.selectedKey).toBe('first')
  expect(slider).toEqual({ maxValue: 1, minValue: 0 })
  expect(toggle.isSelected).toBe(true)
  expect(surface).toEqual({ size: 'field', variant: 'dashed' })
})

test('marks the published UI entry as a client boundary at the source entry', () => {
  const entryPath = fileURLToPath(new URL('../src/ui.ts', import.meta.url))
  expect(readFileSync(entryPath, 'utf8')).toMatch(/^['"]use client['"]\s*$/m)
})

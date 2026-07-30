import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vite-plus/test'

import {
  ItemCaption,
  ItemEmptyState,
  ItemLegend,
  ItemLegendItem,
  ItemLegendSwatch,
  ItemSurface,
} from '../src/components/ui/item-primitives.tsx'

test('renders a theme-aware item surface with composable variants', () => {
  const markup = renderToStaticMarkup(
    <ItemSurface size="field" variant="dashed" aria-label="Chart surface">
      Chart
    </ItemSurface>,
  )

  expect(markup).toContain('data-slot="item-surface"')
  expect(markup).toContain('data-variant="dashed"')
  expect(markup).toContain('data-size="field"')
  expect(markup).toContain('bg-(--picodash-color-well)')
  expect(markup).toContain('min-h-(--picodash-field-surface-min-height)')
  expect(markup).toContain('aria-label="Chart surface"')
  expect(markup).not.toContain('--_picodash-')
})

test('composes captions, legends, and palette-aware legend markers', () => {
  const markup = renderToStaticMarkup(
    <>
      <ItemCaption tone="strong">Current value</ItemCaption>
      <ItemLegend orientation="vertical" aria-label="Series">
        <ItemLegendItem color="var(--picodash-color-data-3)">Temperature</ItemLegendItem>
        <ItemLegendItem marker="line" color="var(--picodash-color-data-4)">
          Forecast
        </ItemLegendItem>
        <ItemLegendItem marker={false}>No marker</ItemLegendItem>
      </ItemLegend>
      <ItemLegendSwatch variant="line" color="var(--picodash-color-data-5)" />
    </>,
  )

  expect(markup).toContain('data-slot="item-caption"')
  expect(markup).toContain('data-tone="strong"')
  expect(markup).toContain('data-slot="item-legend"')
  expect(markup).toContain('data-orientation="vertical"')
  expect(markup).toContain('role="list"')
  expect(markup).toContain('role="listitem"')
  expect(markup).toContain('background-color:var(--picodash-color-data-3)')
  expect(markup).toContain('background-color:var(--picodash-color-data-4)')
  expect(markup).toContain('background-color:var(--picodash-color-data-5)')
  expect(markup.match(/data-slot="item-legend-swatch"/g)).toHaveLength(3) // marker=false omits its marker
})

test('renders an accessible composition point for empty custom dashlets', () => {
  const markup = renderToStaticMarkup(
    <ItemEmptyState
      data-state="empty"
      title="No samples"
      description="Start recording to see data here."
    />,
  )

  expect(markup).toContain('data-slot="item-empty-state"')
  expect(markup).toContain('data-state="empty"')
  expect(markup).toContain('data-slot="item-empty-state-title"')
  expect(markup).toContain('No samples')
  expect(markup).toContain('data-slot="item-caption"')
  expect(markup).toContain('Start recording to see data here.')
  expect(markup).toContain('border-dashed')
  expect(markup).toContain('bg-(--picodash-color-well)')
})

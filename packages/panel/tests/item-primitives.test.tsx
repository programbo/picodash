import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vite-plus/test'

import {
  Caption,
  DataLabel,
  DataList,
  DataRow,
  DataValue,
  EmptyState,
  Legend,
  LegendItem,
  LegendSwatch,
  Metric,
  MetricLabel,
  MetricTrend,
  MetricValue,
  Status,
  StatusIndicator,
  Surface,
  type CaptionProps,
  type DataLabelProps,
  type DataListProps,
  type DataRowProps,
  type DataValueProps,
  type EmptyStateProps,
  type LegendItemProps,
  type LegendProps,
  type LegendSwatchProps,
  type MetricLabelProps,
  type MetricProps,
  type MetricTrendProps,
  type MetricValueProps,
  type StatusIndicatorProps,
  type StatusProps,
  type SurfaceProps,
} from '../src/dashlet.ts'

test('renders semantic metric and status readouts', () => {
  const markup = renderToStaticMarkup(
    <>
      <Metric align="end" aria-label="Request latency">
        <MetricLabel>Latency</MetricLabel>
        <MetricValue>42 ms</MetricValue>
        <MetricTrend tone="positive">Down 8%</MetricTrend>
      </Metric>
      <Status tone="success">
        <StatusIndicator tone="success" />
        Connected
      </Status>
    </>,
  )

  expect(markup).toContain('data-slot="dashlet-metric"')
  expect(markup).toContain('aria-label="Request latency"')
  expect(markup).toContain('data-slot="dashlet-metric-label"')
  expect(markup).toContain('<output')
  expect(markup).toContain('data-slot="dashlet-metric-value"')
  expect(markup).toContain('data-slot="dashlet-metric-trend"')
  expect(markup).toContain('data-tone="positive"')
  expect(markup).toContain('data-slot="dashlet-status"')
  expect(markup).toContain('role="status"')
  expect(markup).toContain('aria-live="polite"')
  expect(markup).toContain('data-slot="dashlet-status-indicator"')
  expect(markup).toContain('aria-hidden="true"')
})

test('renders structured data with native description-list semantics', () => {
  const markup = renderToStaticMarkup(
    <DataList density="compact" aria-label="Runtime">
      <DataRow>
        <DataLabel>Memory</DataLabel>
        <DataValue>128 MB</DataValue>
      </DataRow>
      <DataRow orientation="vertical">
        <DataLabel>Region</DataLabel>
        <DataValue align="start">Perth</DataValue>
      </DataRow>
    </DataList>,
  )

  expect(markup).toContain('<dl')
  expect(markup).toContain('data-slot="dashlet-data-list"')
  expect(markup).toContain('data-density="compact"')
  expect(markup).toContain('<dt')
  expect(markup).toContain('data-slot="dashlet-data-label"')
  expect(markup).toContain('<dd')
  expect(markup).toContain('data-slot="dashlet-data-value"')
  expect(markup).toContain('data-orientation="vertical"')
  expect(markup).toContain('data-align="start"')
})

test('renders theme-aware visualization composition with finite variants', () => {
  const markup = renderToStaticMarkup(
    <Surface size="field" variant="dashed" aria-label="Chart surface">
      <Caption tone="strong">Current value</Caption>
      <Legend orientation="vertical" aria-label="Series">
        <LegendItem color="var(--picodash-color-data-3)">Temperature</LegendItem>
        <LegendItem marker="line" color="var(--picodash-color-data-4)">
          Forecast
        </LegendItem>
        <LegendItem marker={false}>No marker</LegendItem>
      </Legend>
      <LegendSwatch variant="line" color="var(--picodash-color-data-5)" />
    </Surface>,
  )

  expect(markup).toContain('data-slot="dashlet-surface"')
  expect(markup).toContain('data-variant="dashed"')
  expect(markup).toContain('data-size="field"')
  expect(markup).toContain('bg-(--picodash-color-well)')
  expect(markup).toContain('min-h-(--picodash-field-surface-min-height)')
  expect(markup).toContain('data-slot="dashlet-caption"')
  expect(markup).toContain('data-slot="dashlet-legend"')
  expect(markup).toContain('role="list"')
  expect(markup).toContain('role="listitem"')
  expect(markup).toContain('background-color:var(--picodash-color-data-3)')
  expect(markup).toContain('background-color:var(--picodash-color-data-4)')
  expect(markup).toContain('background-color:var(--picodash-color-data-5)')
  expect(markup.match(/data-slot="dashlet-legend-swatch"/g)).toHaveLength(3)
  expect(markup).not.toContain('--_picodash-')
})

test('merges the rich empty-state contract into the canonical state component', () => {
  const markup = renderToStaticMarkup(
    <EmptyState
      data-state="empty"
      icon={<svg aria-label="Empty chart" />}
      title="No samples"
      description="Start recording to see data here."
    >
      <button type="button">Start</button>
    </EmptyState>,
  )

  expect(markup).toContain('data-slot="dashlet-empty-state"')
  expect(markup).toContain('role="status"')
  expect(markup).toContain('aria-live="polite"')
  expect(markup).toContain('data-slot="dashlet-empty-state-icon"')
  expect(markup).toContain('data-slot="dashlet-empty-state-title"')
  expect(markup).toContain('data-slot="dashlet-empty-state-description"')
  expect(markup).toContain('No samples')
  expect(markup).toContain('Start recording to see data here.')
  expect(markup).toContain('<button')
})

test('publishes named prop contracts for every dashlet element', () => {
  const props = [
    { align: 'center' } satisfies MetricProps,
    { children: 'Label' } satisfies MetricLabelProps,
    { emphasis: 'strong' } satisfies MetricValueProps,
    { tone: 'negative' } satisfies MetricTrendProps,
    { tone: 'warning' } satisfies StatusProps,
    { tone: 'danger' } satisfies StatusIndicatorProps,
    { density: 'compact' } satisfies DataListProps,
    { orientation: 'vertical' } satisfies DataRowProps,
    { children: 'Label' } satisfies DataLabelProps,
    { align: 'start' } satisfies DataValueProps,
    { size: 'field', variant: 'raised' } satisfies SurfaceProps,
    { tone: 'strong' } satisfies CaptionProps,
    { orientation: 'vertical' } satisfies LegendProps,
    { marker: false } satisfies LegendItemProps,
    { variant: 'line' } satisfies LegendSwatchProps,
    { title: 'Nothing here' } satisfies EmptyStateProps,
  ]

  expect(props).toHaveLength(16)
})

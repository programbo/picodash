import { renderToStaticMarkup } from 'react-dom/server'
import {
  Separator as SeparatorPrimitive,
  ToggleButton as ToggleButtonPrimitive,
  ToggleButtonGroup as ToggleButtonGroupPrimitive,
} from 'react-aria-components'
import { expect, test } from 'vite-plus/test'

import {
  Meter,
  MeterFill,
  type MeterFillProps,
  type MeterProps,
  MeterTrack,
  type MeterTrackProps,
} from '../src/components/ui/meter.tsx'
import {
  ProgressBar,
  ProgressFill,
  type ProgressBarProps,
  type ProgressFillProps,
  ProgressTrack,
  type ProgressTrackProps,
} from '../src/components/ui/progress-bar.tsx'
import { Toolbar, type ToolbarProps } from '../src/components/ui/toolbar.tsx'

test('meter preserves value semantics and composes percentage into its slots', () => {
  const markup = renderToStaticMarkup(
    <Meter aria-label="Storage used" minValue={20} maxValue={60} value={30}>
      {({ valueText }) => (
        <>
          <span>{valueText}</span>
          <MeterTrack data-detail="track">
            <MeterFill className="custom-fill">fill</MeterFill>
          </MeterTrack>
        </>
      )}
    </Meter>,
  )

  expect(markup).toContain('role="meter progressbar"')
  expect(markup).toContain('aria-label="Storage used"')
  expect(markup).toContain('aria-valuemin="20"')
  expect(markup).toContain('aria-valuemax="60"')
  expect(markup).toContain('aria-valuenow="30"')
  expect(markup).toContain('data-slot="meter"')
  expect(markup).toContain('data-slot="meter-track"')
  expect(markup).toContain('data-slot="meter-fill"')
  expect(markup).toContain('data-percentage="25"')
  expect(markup).toContain('width:25%')
  expect(markup).toContain('custom-fill')
  expect(markup).toContain('>fill</div>')
})

test('progress composes determinate and indeterminate state without caller math', () => {
  const determinate = renderToStaticMarkup(
    <ProgressBar aria-label="Upload" value={2} minValue={1} maxValue={5}>
      <ProgressTrack>
        <ProgressFill />
      </ProgressTrack>
    </ProgressBar>,
  )
  const indeterminate = renderToStaticMarkup(
    <ProgressBar aria-label="Connecting" isIndeterminate>
      <ProgressTrack>
        <ProgressFill />
      </ProgressTrack>
    </ProgressBar>,
  )

  expect(determinate).toContain('role="progressbar"')
  expect(determinate).toContain('aria-valuenow="2"')
  expect(determinate).toContain('data-slot="progress-bar"')
  expect(determinate).toContain('data-slot="progress-track"')
  expect(determinate).toContain('data-slot="progress-fill"')
  expect(determinate).toContain('data-percentage="25"')
  expect(determinate).toContain('width:25%')

  expect(indeterminate).toContain('role="progressbar"')
  expect(indeterminate).not.toContain('aria-valuenow')
  expect(indeterminate).toContain('data-indeterminate="true"')
  expect(indeterminate).toContain('width:40%')
  expect(indeterminate).toContain('motion-reduce:data-indeterminate:animate-none')
  expect(indeterminate).toContain('forced-colors:bg-[Highlight]')
})

test('toolbar propagates orientation to toggle groups and separators', () => {
  const horizontal = renderToStaticMarkup(
    <Toolbar aria-label="Formatting">
      <ToggleButtonGroupPrimitive aria-label="Style">
        <ToggleButtonPrimitive id="bold">Bold</ToggleButtonPrimitive>
      </ToggleButtonGroupPrimitive>
      <SeparatorPrimitive />
    </Toolbar>,
  )
  const vertical = renderToStaticMarkup(
    <Toolbar aria-label="Tools" orientation="vertical">
      <ToggleButtonGroupPrimitive aria-label="Mode">
        <ToggleButtonPrimitive id="select">Select</ToggleButtonPrimitive>
      </ToggleButtonGroupPrimitive>
      <SeparatorPrimitive />
    </Toolbar>,
  )

  expect(horizontal).toContain('role="toolbar"')
  expect(horizontal).toContain('aria-label="Formatting"')
  expect(horizontal).toContain('data-slot="toolbar"')
  expect(horizontal).toContain('data-orientation="horizontal"')
  expect(horizontal).toContain('aria-orientation="vertical"')

  expect(vertical).toContain('role="toolbar"')
  expect(vertical).toContain('aria-orientation="vertical"')
  expect(vertical).toContain('data-orientation="vertical"')
  expect(vertical).toContain('role="separator"')
  expect(vertical).not.toContain('aria-orientation="horizontal"')
})

test('exports named prop types for every UI foundation component', () => {
  const meter = { 'aria-label': 'Meter', value: 50 } satisfies MeterProps
  const meterTrack = { className: 'track' } satisfies MeterTrackProps
  const meterFill = { style: { opacity: 0.5 } } satisfies MeterFillProps
  const progress = { 'aria-label': 'Progress', isIndeterminate: true } satisfies ProgressBarProps
  const progressTrack = { className: 'track' } satisfies ProgressTrackProps
  const progressFill = { style: { opacity: 0.5 } } satisfies ProgressFillProps
  const toolbar = { 'aria-label': 'Tools', orientation: 'vertical' } satisfies ToolbarProps

  expect([
    meter,
    meterTrack,
    meterFill,
    progress,
    progressTrack,
    progressFill,
    toolbar,
  ]).toHaveLength(7)
})

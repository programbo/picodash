import { isValidElement } from 'react'
import { expect, test } from 'vite-plus/test'
import { picodashAlignmentValues } from '../src/inputs/alignment.tsx'
import { restoreDropzoneViewerFocus } from '../src/inputs/dropzone.tsx'
import { projectPicodashRangeFill } from '../src/inputs/range.tsx'
import { gradientRotationRegistrationId } from '../src/inputs/gradient.tsx'
import { normalizeSelectValue } from '../src/inputs/select.tsx'
import {
  resolvePicodashSparklineProjectionBounds,
  settlePicodashSparklineSource,
  settlePicodashSparklineSourceConsumption,
  shouldJumpPicodashSparklineRange,
  shouldUpdatePicodashSparklineRange,
} from '../src/inputs/sparkline.tsx'
import {
  appendPicodashSparklineSamples,
  gradientCssValue,
  isPicodashAlignmentValue,
  normalizeAlignmentValue,
  normalizeRangeBounds,
  normalizeRangeValue,
  normalizeSegmentedValue,
  normalizePicodashDropzoneValue,
  normalizePicodashGradient,
  normalizePicodashHexColor,
  normalizePicodashMediaUrl,
  normalizePicodashXYBounds,
  normalizePicodashXYValue,
  normalizeVector3Value,
  normalizeVectorBounds,
  normalizeVectorStep,
  objectFitClassName,
  partitionPicodashFilesByCapacity,
  projectPicodashFileMetadata,
  projectPicodashGradientPosition,
  projectPicodashSparklineBaseline,
  projectPicodashSparklinePath,
  resolvePicodashSparklineBounds,
  projectPicodashXYLabelPosition,
  projectPicodashXYPointer,
  projectPicodashXYValue,
  segmentedOptionDisabled,
  segmentedOptionIcon,
  segmentedOptionLabel,
  segmentedOptionValue,
  picodashAlignmentOptions,
} from '../src/advanced.ts'
import {
  PicodashAlignment,
  PicodashChart,
  PicodashDropzone,
  PicodashGradient,
  PicodashMediaPreview,
  PicodashMatrix2D,
  PicodashRange,
  PicodashSegmented,
  PicodashSparkline,
  PicodashText,
  PicodashVector3,
  PicodashXYPad,
  type PicodashItemContentLayout,
} from '../src/index.ts'

test('exports valid elements for every custom input', () => {
  const layout: PicodashItemContentLayout = 'block'
  const elements = [
    <PicodashSegmented key="segmented" field="segmented" options={['one', 'two']} />,
    <PicodashAlignment key="alignment" field="alignment" />,
    <PicodashMatrix2D
      key="matrix"
      field="matrix"
      options={[[{ children: 'One', value: 'one' }]]}
    />,
    <PicodashVector3 key="vector" field="vector" />,
    <PicodashRange key="range" field="range" />,
    <PicodashText key="text" field="text" />,
    <PicodashXYPad key="xy" contentLayout={layout} field="xy" />,
    <PicodashGradient key="gradient" field="gradient" />,
    <PicodashMediaPreview key="media" alt="Preview" field="media" />,
    <PicodashDropzone key="dropzone" field="dropzone" />,
    <PicodashSparkline key="sparkline" id="sparkline" data={[1, 3, 2]} />,
    <PicodashSparkline
      key="autoscale-sparkline"
      id="autoscale-sparkline"
      autoscale
      data={[1, 3, 2]}
    />,
    <PicodashSparkline
      key="multi-sparkline"
      id="multi-sparkline"
      data={[
        { x: 1, y: -1 },
        { x: 2, y: -2 },
      ]}
      series={[{ dataKey: 'x' }, { dataKey: 'y' }]}
    />,
    <PicodashChart
      key="chart"
      id="chart"
      data={[{ frame: '01', value: 12 }]}
      series={[{ dataKey: 'value' }]}
      type="line"
      xAxisProps={{ dataKey: 'frame' }}
    />,
  ]

  expect(elements.every(isValidElement)).toBe(true)
})

test('bounds appended sparkline samples and projects finite SVG coordinates', () => {
  expect(appendPicodashSparklineSamples([1, 2], [3, Number.NaN, 4], 3)).toEqual([2, 3, 4])
  expect(
    projectPicodashSparklinePath([0, 5, 10], {
      height: 100,
      maxValue: 10,
      minValue: 0,
      width: 200,
    }),
  ).toBe('M 0 100 L 100 50 L 200 0')
  expect(
    projectPicodashSparklinePath([0, 5, Number.NaN], {
      height: 100,
      maxValue: 10,
      minValue: 0,
      width: 200,
    }),
  ).toBe('M 0 100 L 100 50')
  expect(
    projectPicodashSparklinePath([0, Number.NaN, 10], {
      height: 100,
      maxValue: 10,
      minValue: 0,
      width: 200,
    }),
  ).toBe('M 0 100 M 200 0')
  expect(projectPicodashSparklinePath([])).toBe('')
  expect(
    resolvePicodashSparklineBounds(
      [
        { x: -10, y: 5 },
        { x: 20, y: 10 },
      ],
      [{ dataKey: 'x' }, { dataKey: 'y' }],
    ),
  ).toEqual({ maxValue: 21.6, minValue: -21.6 })
  expect(resolvePicodashSparklineBounds([{ x: 5, y: 5 }], [{ dataKey: 'x' }])).toEqual({
    maxValue: 5.4,
    minValue: -5.4,
  })
  expect(resolvePicodashSparklineBounds([{ x: 0.01 }], [{ dataKey: 'x' }])).toEqual({
    maxValue: 0.0108,
    minValue: -0.0108,
  })
  expect(resolvePicodashSparklineBounds([{ x: 0 }], [{ dataKey: 'x' }])).toEqual({
    maxValue: 1.08,
    minValue: -1.08,
  })
  const largeHistory = Array.from({ length: 200_000 }, (_, index) => ({
    value: index - 100_000,
  }))
  expect(resolvePicodashSparklineBounds(largeHistory, [{ dataKey: 'value' }])).toEqual({
    maxValue: 108_000,
    minValue: -108_000,
  })
  expect(
    resolvePicodashSparklineProjectionBounds(
      largeHistory,
      [{ dataKey: 'value' }],
      undefined,
      undefined,
    ),
  ).toEqual({
    maxValue: 99_999,
    minValue: -100_000,
  })
  expect(projectPicodashSparklinePath(largeHistory.map(({ value }) => value))).toMatch(/^M 0 88 L /)
  expect(projectPicodashSparklineBaseline(0, 100, { height: 100, width: 200 })).toBe(
    'M 0 100 H 200',
  )
  expect(projectPicodashSparklineBaseline(-25, 75, { height: 100, width: 200 })).toBe(
    'M 0 75 H 200',
  )
  expect(projectPicodashSparklineBaseline(10, 100)).toBe('')
  expect(shouldJumpPicodashSparklineRange(20, 10, false)).toBe(false)
  expect(shouldJumpPicodashSparklineRange(20, 10, true)).toBe(true)
  expect(shouldJumpPicodashSparklineRange(10, 20, false)).toBe(true)
  expect(shouldUpdatePicodashSparklineRange(15, 10, 10, false)).toBe(false)
  expect(shouldUpdatePicodashSparklineRange(15, 10, 10, true)).toBe(true)
  expect(shouldUpdatePicodashSparklineRange(10, 20, 10, false)).toBe(true)
})

test('reports active async sparkline failures and suppresses stale source failures', async () => {
  const reported: unknown[] = []
  const sourceError = new Error('Source stopped.')

  await settlePicodashSparklineSource(
    Promise.reject(sourceError),
    () => true,
    (error) => reported.push(error),
  )
  await settlePicodashSparklineSource(
    Promise.reject(new Error('Replaced source stopped.')),
    () => false,
    (error) => reported.push(error),
  )
  await settlePicodashSparklineSource(
    Promise.resolve(),
    () => true,
    (error) => reported.push(error),
  )

  expect(reported).toEqual([sourceError])
})

test('routes async sparkline failures to the latest handler and ignores visibility cancellation', async () => {
  const reported: string[] = []
  let rejectSource: ((error: unknown) => void) | undefined
  let visible = true
  let handler = () => reported.push('initial')
  const consumption = new Promise<void>((_resolve, reject) => {
    rejectSource = reject
  })
  const settlement = settlePicodashSparklineSource(
    consumption,
    () => visible,
    () => handler(),
  )

  handler = () => reported.push('latest')
  visible = false
  rejectSource?.(new Error('Visibility cancellation.'))
  await settlement

  expect(reported).toEqual([])

  await settlePicodashSparklineSource(
    Promise.reject(new Error('Current source failed.')),
    () => true,
    () => handler(),
  )
  expect(reported).toEqual(['latest'])
})

test('reports synchronous async sparkline source factory failures', async () => {
  const sourceError = new Error('Source factory failed.')
  const reported: unknown[] = []

  await settlePicodashSparklineSourceConsumption(
    () => {
      throw sourceError
    },
    () => true,
    (error) => reported.push(error),
  )

  expect(reported).toEqual([sourceError])
})

test('does not create an async sparkline source after its effect becomes inactive', async () => {
  let active = true
  let consumptionCalls = 0

  const settlement = settlePicodashSparklineSourceConsumption(
    () => {
      consumptionCalls += 1
    },
    () => active,
  )
  active = false

  await settlement

  expect(consumptionCalls).toBe(0)
})

test('creates every supported PicodashChart type with type-specific Recharts props', () => {
  const data = [
    { category: 'A', value: 12 },
    { category: 'B', value: 18 },
  ]
  const charts = [
    <PicodashChart
      key="area"
      id="area"
      cartesianGridProps={{ vertical: false }}
      data={data}
      series={[{ dataKey: 'value' }]}
      type="area"
      xAxisProps={{ dataKey: 'category' }}
    />,
    <PicodashChart key="bar" id="bar" data={data} series={[{ dataKey: 'value' }]} type="bar" />,
    <PicodashChart key="line" id="line" data={data} series={[{ dataKey: 'value' }]} type="line" />,
    <PicodashChart
      key="pie"
      id="pie"
      data={data}
      pieProps={{ dataKey: 'value', nameKey: 'category' }}
      type="pie"
    />,
    <PicodashChart
      key="radar"
      id="radar"
      data={data}
      polarAngleAxisProps={{ dataKey: 'category' }}
      polarGridProps={{ gridType: 'circle' }}
      series={[{ dataKey: 'value' }]}
      type="radar"
    />,
    <PicodashChart
      key="radial"
      id="radial"
      data={data}
      polarGridProps={{ radialLines: false }}
      series={[{ dataKey: 'value' }]}
      type="radial"
    />,
  ]

  expect(charts.every(isValidElement)).toBe(true)
})

test('normalizes segmented options to an enabled selection', () => {
  const icon = <span data-icon="spacing" />
  const options = [
    { disabled: true, label: 'Unavailable', value: 'disabled' },
    { icon, label: 'Ready', value: 'ready' },
  ]

  expect(normalizeSegmentedValue('disabled', options)).toBe('ready')
  expect(normalizeSegmentedValue('missing', options, 'disabled')).toBe('ready')
  expect(segmentedOptionValue(options[1]!)).toBe('ready')
  expect(segmentedOptionLabel(options[1]!)).toBe('Ready')
  expect(segmentedOptionIcon(options[1]!)).toBe(icon)
  expect(segmentedOptionIcon('plain')).toBeUndefined()
  expect(segmentedOptionDisabled(options[0]!)).toBe(true)
  expect(
    normalizeSegmentedValue('missing', [{ disabled: true, value: 'disabled' }]),
  ).toBeUndefined()
})

test('normalizes select values across dynamic and disabled options', () => {
  const options = [{ disabled: true, value: 'legacy' }, 'current']

  expect(normalizeSelectValue('legacy', options)).toBe('legacy')
  expect(normalizeSelectValue('missing', options, 'current')).toBe('current')
  expect(normalizeSelectValue('missing', options, 'missing')).toBe('legacy')
  expect(normalizeSelectValue('missing', [])).toBeUndefined()
})

test('validates every alignment and falls back to center', () => {
  expect(picodashAlignmentOptions).toHaveLength(9)
  expect(picodashAlignmentValues).toEqual(picodashAlignmentOptions.map(({ value }) => value))
  expect(picodashAlignmentOptions.every(({ value }) => isPicodashAlignmentValue(value))).toBe(true)
  expect(normalizeAlignmentValue('bottom-right')).toBe('bottom-right')
  expect(normalizeAlignmentValue('baseline')).toBe('center')
})

test('normalizes vector bounds, finite coordinates, and step', () => {
  expect(normalizeVectorBounds(8, -4)).toEqual({ min: -4, max: 8 })
  expect(
    normalizeVector3Value({ x: Number.NaN, y: -12, z: 20 }, { x: 2, y: 2, z: 2 }, -5, 10),
  ).toEqual({ x: 2, y: -5, z: 10 })
  expect(normalizeVectorStep(0)).toBe(1)
  expect(normalizeVectorStep(0.25)).toBe(0.25)
})

test('normalizes range bounds and snaps an ordered tuple', () => {
  expect(normalizeRangeBounds(10, -10, -1)).toEqual({ min: -10, max: 10, step: 1 })
  expect(normalizeRangeValue([8.8, -4.2], { min: -10, max: 10, step: 2 })).toEqual([-4, 8])
  expect(
    normalizeRangeValue([Number.NaN, Number.POSITIVE_INFINITY], {
      fallback: [2, 6],
      min: 0,
      max: 10,
      step: 1,
    }),
  ).toEqual([2, 6])
})

test('projects the range fill between the thumbs inner edges', () => {
  expect(projectPicodashRangeFill([24, 76], 0, 100)).toEqual({
    highPercent: 76,
    insetInlineEnd: 'min(calc(24% + 7px), 50%)',
    insetInlineStart: 'min(calc(24% + 7px), 50%)',
    lowPercent: 24,
    midpointPercent: 50,
  })

  expect(projectPicodashRangeFill([-5, 5], -10, 10)).toMatchObject({
    highPercent: 75,
    insetInlineEnd: 'min(calc(25% + 7px), 50%)',
    insetInlineStart: 'min(calc(25% + 7px), 50%)',
    lowPercent: 25,
  })

  expect(projectPicodashRangeFill([8, 2], 0, 10)).toMatchObject({
    highPercent: 80,
    insetInlineEnd: 'min(calc(20% + 7px), 50%)',
    insetInlineStart: 'min(calc(20% + 7px), 50%)',
    lowPercent: 20,
  })
})

test('collapses the range fill cleanly for close or coincident thumbs', () => {
  expect(projectPicodashRangeFill([49, 51])).toMatchObject({
    insetInlineEnd: 'min(calc(49% + 7px), 50%)',
    insetInlineStart: 'min(calc(49% + 7px), 50%)',
    midpointPercent: 50,
  })

  expect(projectPicodashRangeFill([50, 50])).toMatchObject({
    highPercent: 50,
    insetInlineEnd: 'min(calc(50% + 7px), 50%)',
    insetInlineStart: 'min(calc(50% + 7px), 50%)',
    lowPercent: 50,
    midpointPercent: 50,
  })

  expect(projectPicodashRangeFill([3, 3], 3, 3)).toEqual({
    highPercent: 0,
    insetInlineEnd: 'min(calc(100% + 7px), 100%)',
    insetInlineStart: 'min(calc(0% + 7px), 0%)',
    lowPercent: 0,
    midpointPercent: 0,
  })
})

test('normalizes and projects XY values', () => {
  const bounds = normalizePicodashXYBounds({ step: 0.25, xMax: -1, xMin: 1, yMax: 2, yMin: -2 })
  expect(bounds).toEqual({ step: 0.25, xMax: 1, xMin: -1, yMax: 2, yMin: -2 })
  expect(normalizePicodashXYValue({ x: 0.63, y: 4 }, bounds)).toEqual({ x: 0.75, y: 2 })
  expect(projectPicodashXYValue({ x: 0, y: 0 }, bounds)).toEqual({ x: 0.5, y: 0.5 })
  expect(
    projectPicodashXYPointer(50, 25, { height: 100, left: 0, top: 0, width: 100 }, bounds),
  ).toEqual({ x: 0, y: 1 })
  const labelMetrics = {
    gap: 5,
    labelHeight: 18,
    labelWidth: 60,
    padWidth: 200,
    pointWidth: 12,
  }
  expect(projectPicodashXYLabelPosition(150, 60, labelMetrics)).toEqual({ x: 91, y: 37 })
  expect(projectPicodashXYLabelPosition(10, 4, labelMetrics)).toEqual({ x: 21, y: 0 })
  expect(projectPicodashXYLabelPosition(198, 60, labelMetrics)).toEqual({ x: 139, y: 37 })
})

test('normalizes gradient stops, colors, and pointer projection', () => {
  const gradient = normalizePicodashGradient([
    { color: '#fff', id: 'end', position: 1.5 },
    { color: 'invalid', id: 'end', position: -1 },
  ])
  expect(gradient).toEqual([
    { color: '#000000', id: 'end-2', position: 0 },
    { color: '#ffffff', id: 'end', position: 1 },
  ])
  expect(normalizePicodashHexColor('#0Af')).toBe('#00aaff')
  expect(projectPicodashGradientPosition(75, { left: 25, width: 100 })).toBe(0.5)
  expect(gradientCssValue(gradient)).toContain('#000000 0%')
  expect(gradientCssValue(gradient, 135)).toContain('linear-gradient(135deg')
  expect(gradientRotationRegistrationId('gradient-a', 'rotation')).not.toBe(
    gradientRotationRegistrationId('gradient-b', 'rotation'),
  )
})

test('normalizes malformed gradient values without projecting unknown records', () => {
  const fallback = [
    { color: '#111827', id: 'start', position: 0 },
    { color: '#f9fafb', id: 'end', position: 1 },
  ]

  expect(normalizePicodashGradient('not-a-gradient')).toEqual(fallback)
  expect(normalizePicodashGradient({ color: '#ffffff' })).toEqual(fallback)
  expect(normalizePicodashGradient(null)).toEqual(fallback)
  expect(normalizePicodashGradient([null, 'invalid', { color: '#0af', position: 0.25 }])).toEqual([
    { color: '#00aaff', id: 'stop-1', position: 0.25 },
    { color: '#00aaff', id: 'end', position: 1 },
  ])
})

test('accepts safe media URLs without interpreting SVG markup', () => {
  expect(normalizePicodashMediaUrl('/preview.svg')).toBe('/preview.svg')
  expect(normalizePicodashMediaUrl('data:image/svg+xml,%3Csvg%3E%3C/svg%3E')).toContain(
    'data:image/svg+xml',
  )
  expect(normalizePicodashMediaUrl('javascript:alert(1)')).toBeUndefined()
  expect(normalizePicodashMediaUrl('<svg onload="alert(1)">')).toBeUndefined()
  expect(objectFitClassName('scale-down')).toBe('object-scale-down')
})

test('projects files to JSON-compatible metadata with stable unique IDs', () => {
  const files = [
    { lastModified: 123, name: 'Scene.PNG', size: 2048, type: 'image/png' },
    { lastModified: 123, name: 'Scene.PNG', size: 2048, type: 'image/png' },
  ]
  const metadata = projectPicodashFileMetadata(files)

  expect(metadata).toEqual([
    {
      id: 'scene-png-2048-123',
      lastModified: 123,
      name: 'Scene.PNG',
      size: 2048,
      type: 'image/png',
    },
    {
      id: 'scene-png-2048-123-2',
      lastModified: 123,
      name: 'Scene.PNG',
      size: 2048,
      type: 'image/png',
    },
  ])
  expect(normalizePicodashDropzoneValue([{ name: '  ', size: -5 }])).toEqual([
    {
      id: 'file-1',
      lastModified: 0,
      name: 'Unnamed file',
      size: 0,
      type: 'application/octet-stream',
    },
  ])
  expect(
    metadata.every((item) => Object.values(item).every((value) => typeof value !== 'object')),
  ).toBe(true)
})

test('normalizes malformed dropzone values and appends only within remaining capacity', () => {
  expect(normalizePicodashDropzoneValue('not-a-file-list')).toEqual([])
  expect(normalizePicodashDropzoneValue({ name: 'scene.png' })).toEqual([])
  expect(normalizePicodashDropzoneValue(null)).toEqual([])
  expect(
    normalizePicodashDropzoneValue([null, 'invalid', { name: ' scene.png ', size: 4 }]),
  ).toEqual([
    {
      id: 'file-3',
      lastModified: 0,
      name: 'scene.png',
      size: 4,
      type: 'application/octet-stream',
    },
  ])

  const partition = partitionPicodashFilesByCapacity(['third', 'overflow'], 2, 3, true)
  expect(partition).toEqual({ acceptedFiles: ['third'], overflowFiles: ['overflow'] })
  expect(partitionPicodashFilesByCapacity(['overflow'], 3, 3, true)).toEqual({
    acceptedFiles: [],
    overflowFiles: ['overflow'],
  })
  expect(partitionPicodashFilesByCapacity(['one', 'two'], 20, 0, true)).toEqual({
    acceptedFiles: ['one', 'two'],
    overflowFiles: [],
  })
})

test('restores dropzone viewer focus only to a connected thumbnail trigger', () => {
  const focusOptions: FocusOptions[] = []
  const connectedTrigger = {
    focus: (options?: FocusOptions) => {
      if (options) focusOptions.push(options)
    },
    isConnected: true,
  }

  expect(restoreDropzoneViewerFocus(connectedTrigger)).toBe(true)
  expect(focusOptions).toEqual([{ preventScroll: true }])
  expect(
    restoreDropzoneViewerFocus({
      focus: () => {
        throw new Error('Disconnected triggers must not receive focus')
      },
      isConnected: false,
    }),
  ).toBe(false)
  expect(restoreDropzoneViewerFocus(null)).toBe(false)
})

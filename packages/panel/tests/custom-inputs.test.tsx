import { isValidElement } from 'react'
import { expect, test, vi } from 'vite-plus/test'
import { tweakerAlignmentValues } from '../src/inputs/alignment.tsx'
import { restoreDropzoneViewerFocus } from '../src/inputs/dropzone.tsx'
import { projectTweakerRangeFill } from '../src/inputs/range.tsx'
import {
  exactTweakerObjectArrayValue,
  exactTweakerObjectValue,
  exactTweakerTupleValue,
  synchronizeTweakerFieldValue,
} from '../src/tweaker-control-value.ts'
import { createTweakerPanelStore } from '../src/tweaker-panel-store.ts'
import { serializeTweakerPanelValues } from '../src/tweaker-panel-documents.ts'
import {
  gradientCssValue,
  isTweakerAlignmentValue,
  normalizeAlignmentValue,
  normalizeRangeBounds,
  normalizeRangeValue,
  normalizeSegmentedValue,
  normalizeTweakerDropzoneValue,
  normalizeTweakerGradient,
  normalizeTweakerHexColor,
  normalizeTweakerMediaUrl,
  normalizeTweakerXYBounds,
  normalizeTweakerXYValue,
  normalizeVector3Value,
  normalizeVectorBounds,
  normalizeVectorStep,
  objectFitClassName,
  partitionTweakerFilesByCapacity,
  projectTweakerFileMetadata,
  projectTweakerGradientPosition,
  projectTweakerXYLabelPosition,
  projectTweakerXYPointer,
  projectTweakerXYValue,
  segmentedOptionDisabled,
  segmentedOptionIcon,
  segmentedOptionLabel,
  segmentedOptionValue,
  TweakerAlignment,
  TweakerDropzone,
  TweakerGradient,
  TweakerMediaPreview,
  TweakerRange,
  TweakerSegmented,
  TweakerVector3,
  TweakerXYPad,
  tweakerAlignmentOptions,
  type TweakerControlContentLayout,
} from '../src/index.ts'

test('exports valid elements for every custom input', () => {
  const layout: TweakerControlContentLayout = 'block'
  const elements = [
    <TweakerSegmented key="segmented" options={['one', 'two']} />,
    <TweakerAlignment key="alignment" />,
    <TweakerVector3 key="vector" />,
    <TweakerRange key="range" />,
    <TweakerXYPad key="xy" contentLayout={layout} />,
    <TweakerGradient key="gradient" />,
    <TweakerMediaPreview key="media" alt="Preview" />,
    <TweakerDropzone key="dropzone" />,
  ]

  expect(elements.every(isValidElement)).toBe(true)
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

test('persists a valid segmented fallback from the latest stored value', () => {
  const store = createTweakerPanelStore({
    defaultValues: { mode: 'initial' },
    panelId: 'segmented',
  })
  const options = ['rendered-stale', 'fallback']
  const fields = store.getState().fields
  const guardedSetValue = vi.fn()
  const control = {
    disabled: true,
    field: 'mode',
    readOnly: true,
    setValue: guardedSetValue,
    value: 'rendered-stale',
  }

  store.setState((state) => ({ values: { ...state.values, mode: 'latest-removed' } }))
  synchronizeTweakerFieldValue(
    control,
    (currentValue) => normalizeSegmentedValue(currentValue, options, 'fallback'),
    (currentValue, normalizedValue) => currentValue === normalizedValue,
    store,
  )
  expect(store.getState().values.mode).toBe('fallback')
  expect(store.getState().fields).toBe(fields)
  expect(guardedSetValue).not.toHaveBeenCalled()

  const canonicalValues = store.getState().values
  synchronizeTweakerFieldValue(
    control,
    (currentValue) => normalizeSegmentedValue(currentValue, options, 'fallback'),
    (currentValue, normalizedValue) => currentValue === normalizedValue,
    store,
  )
  expect(store.getState().values).toBe(canonicalValues)

  store.setState((state) => ({ values: { ...state.values, mode: 'removed-again' } }))
  synchronizeTweakerFieldValue(
    control,
    (currentValue) =>
      normalizeSegmentedValue(
        currentValue,
        [{ disabled: true, value: 'disabled' }, 'ready'],
        'missing',
      ),
    (currentValue, normalizedValue) => currentValue === normalizedValue,
    store,
  )
  expect(store.getState().values.mode).toBe('ready')

  store.setState((state) => ({ values: { ...state.values, mode: 'unchanged' } }))
  const unchangedValues = store.getState().values
  synchronizeTweakerFieldValue(
    control,
    (currentValue) => normalizeSegmentedValue(currentValue, []),
    (currentValue, normalizedValue) => currentValue === normalizedValue,
    store,
  )
  expect(store.getState().values).toBe(unchangedValues)

  const fieldlessSetValue = vi.fn()
  const fieldlessControl = { setValue: fieldlessSetValue, value: 'fieldless-invalid' }
  synchronizeTweakerFieldValue(
    fieldlessControl,
    () => 'phantom',
    () => false,
    store,
  )
  expect(store.getState().values).toBe(unchangedValues)
  expect(fieldlessSetValue).not.toHaveBeenCalled()
})

test('validates every alignment and falls back to centre', () => {
  expect(tweakerAlignmentOptions).toHaveLength(9)
  expect(tweakerAlignmentValues).toEqual(tweakerAlignmentOptions.map(({ value }) => value))
  expect(tweakerAlignmentOptions.every(({ value }) => isTweakerAlignmentValue(value))).toBe(true)
  expect(normalizeAlignmentValue('bottom-right')).toBe('bottom-right')
  expect(normalizeAlignmentValue('baseline')).toBe('center')
})

test('persists a canonical alignment value before later exports', () => {
  const store = createTweakerPanelStore({
    defaultValues: { alignment: 'baseline' },
    panelId: 'alignment',
  })
  store.getState().registerItem({
    defaultValue: 'center',
    fieldId: 'alignment',
    id: 'alignment-control',
    kind: 'control',
    parentId: 'root',
    placement: 'auto',
    reorderable: true,
  })
  const fields = store.getState().fields

  synchronizeTweakerFieldValue(
    { field: 'alignment', value: 'baseline' },
    (currentValue) => normalizeAlignmentValue(currentValue),
    (currentValue, normalizedValue) => currentValue === normalizedValue,
    store,
  )

  expect(store.getState().values.alignment).toBe('center')
  expect(store.getState().fields).toBe(fields)
  expect(JSON.parse(serializeTweakerPanelValues(store.getState(), 'json'))).toEqual({
    alignment: 'center',
  })
})

test('normalizes vector bounds, finite coordinates, and step', () => {
  expect(normalizeVectorBounds(8, -4)).toEqual({ min: -4, max: 8 })
  expect(
    normalizeVector3Value({ x: Number.NaN, y: -12, z: 20 }, { x: 2, y: 2, z: 2 }, -5, 10),
  ).toEqual({ x: 2, y: -5, z: 10 })
  expect(normalizeVectorStep(0)).toBe(1)
  expect(normalizeVectorStep(0.25)).toBe(0.25)
})

test('persists a canonical Vector3 from the latest stored value without changing metadata', () => {
  const store = createTweakerPanelStore({
    defaultValues: { vector: { x: 0, y: 0, z: 0 } },
    panelId: 'vectors',
  })
  const control = {
    disabled: true,
    field: 'vector',
    readOnly: true,
    value: { x: 1, y: 1, z: 1 },
  }
  const fallback = { x: 0, y: 0, z: 0 }
  const synchronize = () =>
    synchronizeTweakerFieldValue(
      control,
      (currentValue) => normalizeVector3Value(currentValue, fallback, -5, 5),
      (currentValue, normalizedValue) =>
        exactTweakerObjectValue(currentValue, normalizedValue, ['x', 'y', 'z']),
      store,
    )

  store.setState((state) => ({
    values: { ...state.values, vector: { extra: 99, x: 9, y: -9, z: 2 } },
  }))
  const fields = store.getState().fields
  synchronize()
  expect(store.getState().values.vector).toEqual({ x: 5, y: -5, z: 2 })
  expect(store.getState().fields).toBe(fields)

  const values = store.getState().values
  synchronize()
  expect(store.getState().values).toBe(values)

  store.setState((state) => ({ values: { ...state.values, vector: null } }))
  synchronize()
  expect(store.getState().values.vector).toEqual(fallback)
  expect(store.getState().fields).toBe(fields)
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

test('persists a dynamically normalized field range despite a guarded control setter', () => {
  const store = createTweakerPanelStore({
    defaultValues: { range: [2, 9] },
    panelId: 'ranges',
  })
  const guardedSetValue = vi.fn()
  const normalization = { fallback: [0, 6] as [number, number], max: 6, min: 0, step: 1 }
  const control = {
    disabled: true,
    field: 'range',
    readOnly: true,
    setValue: guardedSetValue,
    value: [2, 9],
  }
  const synchronize = () =>
    synchronizeTweakerFieldValue(
      control,
      (currentValue) => normalizeRangeValue(currentValue, normalization),
      exactTweakerTupleValue,
      store,
    )

  store.setState((state) => ({ values: { ...state.values, range: [3, 8] } }))
  const cleanFields = store.getState().fields
  synchronize()
  expect(store.getState().values.range).toEqual([3, 6])
  expect(store.getState().fields).toBe(cleanFields)
  expect(store.getState().fields.range).toEqual({
    defaultValue: [2, 9],
    dirty: false,
    errors: [],
    touched: false,
  })
  expect(guardedSetValue).not.toHaveBeenCalled()

  const values = store.getState().values
  synchronize()
  expect(store.getState().values).toBe(values)

  store.getState().setFieldValue('range', [4, 9])
  store.setState((state) => ({
    fields: {
      ...state.fields,
      range: { ...state.fields.range!, errors: ['existing error'] },
    },
  }))
  const dirtyFields = store.getState().fields
  synchronize()
  expect(store.getState().values.range).toEqual([4, 6])
  expect(store.getState().fields).toBe(dirtyFields)
  expect(store.getState().fields.range).toEqual({
    defaultValue: [2, 9],
    dirty: true,
    errors: ['existing error'],
    touched: true,
  })

  store.setState((state) => ({ values: { ...state.values, range: [2, 6, 99] } }))
  synchronize()
  expect(store.getState().values.range).toEqual([2, 6])
  expect(store.getState().fields).toBe(dirtyFields)

  store.setState((state) => ({ values: { ...state.values, range: null } }))
  synchronize()
  expect(store.getState().values.range).toEqual([0, 6])
  expect(store.getState().fields).toBe(dirtyFields)
})

test('projects the range fill between the thumbs inner edges', () => {
  expect(projectTweakerRangeFill([24, 76], 0, 100)).toEqual({
    highPercent: 76,
    insetInlineEnd: 'min(calc(24% + 7px), 50%)',
    insetInlineStart: 'min(calc(24% + 7px), 50%)',
    lowPercent: 24,
    midpointPercent: 50,
  })

  expect(projectTweakerRangeFill([-5, 5], -10, 10)).toMatchObject({
    highPercent: 75,
    insetInlineEnd: 'min(calc(25% + 7px), 50%)',
    insetInlineStart: 'min(calc(25% + 7px), 50%)',
    lowPercent: 25,
  })

  expect(projectTweakerRangeFill([8, 2], 0, 10)).toMatchObject({
    highPercent: 80,
    insetInlineEnd: 'min(calc(20% + 7px), 50%)',
    insetInlineStart: 'min(calc(20% + 7px), 50%)',
    lowPercent: 20,
  })
})

test('collapses the range fill cleanly for close or coincident thumbs', () => {
  expect(projectTweakerRangeFill([49, 51])).toMatchObject({
    insetInlineEnd: 'min(calc(49% + 7px), 50%)',
    insetInlineStart: 'min(calc(49% + 7px), 50%)',
    midpointPercent: 50,
  })

  expect(projectTweakerRangeFill([50, 50])).toMatchObject({
    highPercent: 50,
    insetInlineEnd: 'min(calc(50% + 7px), 50%)',
    insetInlineStart: 'min(calc(50% + 7px), 50%)',
    lowPercent: 50,
    midpointPercent: 50,
  })

  expect(projectTweakerRangeFill([3, 3], 3, 3)).toEqual({
    highPercent: 0,
    insetInlineEnd: 'min(calc(100% + 7px), 100%)',
    insetInlineStart: 'min(calc(0% + 7px), 0%)',
    lowPercent: 0,
    midpointPercent: 0,
  })
})

test('normalizes and projects XY values', () => {
  const bounds = normalizeTweakerXYBounds({ step: 0.25, xMax: -1, xMin: 1, yMax: 2, yMin: -2 })
  expect(bounds).toEqual({ step: 0.25, xMax: 1, xMin: -1, yMax: 2, yMin: -2 })
  expect(normalizeTweakerXYValue({ x: 0.63, y: 4 }, bounds)).toEqual({ x: 0.75, y: 2 })
  expect(projectTweakerXYValue({ x: 0, y: 0 }, bounds)).toEqual({ x: 0.5, y: 0.5 })
  expect(
    projectTweakerXYPointer(50, 25, { height: 100, left: 0, top: 0, width: 100 }, bounds),
  ).toEqual({ x: 0, y: 1 })
  const labelMetrics = {
    gap: 5,
    labelHeight: 18,
    labelWidth: 60,
    padWidth: 200,
    pointWidth: 12,
  }
  expect(projectTweakerXYLabelPosition(150, 60, labelMetrics)).toEqual({ x: 91, y: 37 })
  expect(projectTweakerXYLabelPosition(10, 4, labelMetrics)).toEqual({ x: 21, y: 0 })
  expect(projectTweakerXYLabelPosition(198, 60, labelMetrics)).toEqual({ x: 139, y: 37 })
})

test('persists a canonical XY value from reactive bounds and repairs malformed shapes', () => {
  const store = createTweakerPanelStore({
    defaultValues: { xy: { x: 0.25, y: 0.75 } },
    panelId: 'xy',
  })
  const bounds = normalizeTweakerXYBounds({
    step: 0.25,
    xMax: 1,
    xMin: 0,
    yMax: 1,
    yMin: 0,
  })
  const fallback = { x: 0.25, y: 0.75 }
  const control = {
    disabled: true,
    field: 'xy',
    readOnly: true,
    value: { x: 0.5, y: 0.5 },
  }
  const synchronize = () =>
    synchronizeTweakerFieldValue(
      control,
      (currentValue) => normalizeTweakerXYValue(currentValue, bounds, fallback),
      (currentValue, normalizedValue) =>
        exactTweakerObjectValue(currentValue, normalizedValue, ['x', 'y']),
      store,
    )

  store.setState((state) => ({
    values: { ...state.values, xy: { extra: 99, x: 1.6, y: -0.2 } },
  }))
  const fields = store.getState().fields
  synchronize()
  expect(store.getState().values.xy).toEqual({ x: 1, y: 0 })
  expect(store.getState().fields).toBe(fields)

  const values = store.getState().values
  synchronize()
  expect(store.getState().values).toBe(values)

  store.setState((state) => ({ values: { ...state.values, xy: 'malformed' } }))
  synchronize()
  expect(store.getState().values.xy).toEqual(fallback)
  expect(store.getState().fields).toBe(fields)
})

test('normalizes gradient stops, colors, and pointer projection', () => {
  const gradient = normalizeTweakerGradient([
    { color: '#fff', id: 'end', position: 1.5 },
    { color: 'invalid', id: 'end', position: -1 },
  ])
  expect(gradient).toEqual([
    { color: '#000000', id: 'end-2', position: 0 },
    { color: '#ffffff', id: 'end', position: 1 },
  ])
  expect(normalizeTweakerHexColor('#0Af')).toBe('#00aaff')
  expect(projectTweakerGradientPosition(75, { left: 25, width: 100 })).toBe(0.5)
  expect(gradientCssValue(gradient)).toContain('#000000 0%')
})

test('normalizes malformed gradient values without projecting unknown records', () => {
  const fallback = [
    { color: '#111827', id: 'start', position: 0 },
    { color: '#f9fafb', id: 'end', position: 1 },
  ]

  expect(normalizeTweakerGradient('not-a-gradient')).toEqual(fallback)
  expect(normalizeTweakerGradient({ color: '#ffffff' })).toEqual(fallback)
  expect(normalizeTweakerGradient(null)).toEqual(fallback)
  expect(normalizeTweakerGradient([null, 'invalid', { color: '#0af', position: 0.25 }])).toEqual([
    { color: '#00aaff', id: 'stop-1', position: 0.25 },
    { color: '#00aaff', id: 'end', position: 1 },
  ])
})

test('persists canonical gradient stops from the latest stored value before export', () => {
  const store = createTweakerPanelStore({
    defaultValues: {
      gradient: [
        { color: '#ABC', extra: true, id: ' end ', position: 2 },
        { color: 'invalid', id: 'end', position: -1 },
      ],
    },
    panelId: 'gradient',
  })
  store.getState().registerItem({
    defaultValue: [],
    fieldId: 'gradient',
    id: 'gradient-control',
    kind: 'control',
    parentId: 'root',
    placement: 'auto',
    reorderable: true,
  })
  const control = {
    disabled: true,
    field: 'gradient',
    readOnly: true,
    value: [],
  }
  const synchronize = () =>
    synchronizeTweakerFieldValue(
      control,
      normalizeTweakerGradient,
      (currentValue, normalizedValue) =>
        exactTweakerObjectArrayValue(currentValue, normalizedValue, ['color', 'id', 'position']),
      store,
    )
  const fields = store.getState().fields

  synchronize()

  const expected = [
    { color: '#000000', id: 'end-2', position: 0 },
    { color: '#aabbcc', id: 'end', position: 1 },
  ]
  expect(store.getState().values.gradient).toEqual(expected)
  expect(store.getState().fields).toBe(fields)
  expect(JSON.parse(serializeTweakerPanelValues(store.getState(), 'json'))).toEqual({
    gradient: expected,
  })

  const values = store.getState().values
  synchronize()
  expect(store.getState().values).toBe(values)
})

test('accepts safe media URLs without interpreting SVG markup', () => {
  expect(normalizeTweakerMediaUrl('/preview.svg')).toBe('/preview.svg')
  expect(normalizeTweakerMediaUrl('data:image/svg+xml,%3Csvg%3E%3C/svg%3E')).toContain(
    'data:image/svg+xml',
  )
  expect(normalizeTweakerMediaUrl('javascript:alert(1)')).toBeUndefined()
  expect(normalizeTweakerMediaUrl('<svg onload="alert(1)">')).toBeUndefined()
  expect(objectFitClassName('scale-down')).toBe('object-scale-down')
})

test('projects files to JSON-compatible metadata with stable unique IDs', () => {
  const files = [
    { lastModified: 123, name: 'Scene.PNG', size: 2048, type: 'image/png' },
    { lastModified: 123, name: 'Scene.PNG', size: 2048, type: 'image/png' },
  ]
  const metadata = projectTweakerFileMetadata(files)

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
  expect(normalizeTweakerDropzoneValue([{ name: '  ', size: -5 }])).toEqual([
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
  expect(normalizeTweakerDropzoneValue('not-a-file-list')).toEqual([])
  expect(normalizeTweakerDropzoneValue({ name: 'scene.png' })).toEqual([])
  expect(normalizeTweakerDropzoneValue(null)).toEqual([])
  expect(
    normalizeTweakerDropzoneValue([null, 'invalid', { name: ' scene.png ', size: 4 }]),
  ).toEqual([
    {
      id: 'file-3',
      lastModified: 0,
      name: 'scene.png',
      size: 4,
      type: 'application/octet-stream',
    },
  ])

  const partition = partitionTweakerFilesByCapacity(['third', 'overflow'], 2, 3, true)
  expect(partition).toEqual({ acceptedFiles: ['third'], overflowFiles: ['overflow'] })
  expect(partitionTweakerFilesByCapacity(['overflow'], 3, 3, true)).toEqual({
    acceptedFiles: [],
    overflowFiles: ['overflow'],
  })
  expect(partitionTweakerFilesByCapacity(['one', 'two'], 20, 0, true)).toEqual({
    acceptedFiles: ['one', 'two'],
    overflowFiles: [],
  })
})

test('persists canonical dropzone metadata from the latest stored value before export', () => {
  const store = createTweakerPanelStore({
    defaultValues: {
      assets: [
        { id: ' My File ', lastModified: -3, name: '  ', size: -2 },
        {
          extra: 'drop',
          id: 'my-file',
          lastModified: -1,
          name: ' photo.png ',
          size: 42,
          type: ' image/png ',
        },
        'invalid',
      ],
    },
    panelId: 'dropzone',
  })
  store.getState().registerItem({
    defaultValue: [],
    fieldId: 'assets',
    id: 'assets-control',
    kind: 'control',
    parentId: 'root',
    placement: 'auto',
    reorderable: true,
  })
  const control = {
    disabled: true,
    field: 'assets',
    readOnly: true,
    value: [],
  }
  const synchronize = () =>
    synchronizeTweakerFieldValue(
      control,
      normalizeTweakerDropzoneValue,
      (currentValue, normalizedValue) =>
        exactTweakerObjectArrayValue(currentValue, normalizedValue, [
          'id',
          'lastModified',
          'name',
          'size',
          'type',
        ]),
      store,
    )
  const fields = store.getState().fields

  synchronize()

  const expected = [
    {
      id: 'my-file',
      lastModified: 0,
      name: 'Unnamed file',
      size: 0,
      type: 'application/octet-stream',
    },
    {
      id: 'my-file-2',
      lastModified: 0,
      name: 'photo.png',
      size: 42,
      type: 'image/png',
    },
  ]
  expect(store.getState().values.assets).toEqual(expected)
  expect(store.getState().fields).toBe(fields)
  expect(JSON.parse(serializeTweakerPanelValues(store.getState(), 'json'))).toEqual({
    assets: expected,
  })

  const values = store.getState().values
  synchronize()
  expect(store.getState().values).toBe(values)
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

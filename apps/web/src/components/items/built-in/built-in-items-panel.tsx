import { TextAlignCenter, TextAlignEnd, TextAlignStart, type LucideIcon } from 'lucide-react'
import {
  PicodashDisplay,
  PicodashDropzone,
  PicodashGradient,
  PicodashGroup,
  PicodashMatrix2D,
  PicodashMediaPreview,
  PicodashNumber,
  PicodashPanel,
  PicodashRange,
  PicodashSegmented,
  PicodashSelect,
  PicodashSlider,
  PicodashSwitch,
  PicodashText,
  PicodashVector3,
  PicodashXYPad,
  type PicodashDropzoneValue,
  type PicodashGradientValue,
  type PicodashMatrix2DOption,
  type PicodashPanelDockedPosition,
  type PicodashPanelPlacement,
  type PicodashRangeValue,
  type PicodashPanelSnappedPosition,
  type PicodashVector3Value,
  type PicodashXYValue,
} from '@picodash/panel'
import { createPicodashStore, type PicodashJsonValue, type PicodashParser } from '@picodash/store'
import { usePicodashStoreSelector } from '@picodash/store/react'
import { ShadcnChartItem } from '@/components/items/custom/shadcn-chart'
import { StreamingSparklineItem } from '@/components/items/custom/streaming-sparkline'

export const builtInItemsPanelId = 'built-in-items'

export type BuiltInChartType = 'area' | 'bar' | 'line' | 'pie' | 'radar' | 'radial'
export type BuiltInContentLayout = 'block' | 'full' | 'inline'
export type BuiltInMatrixSelectionRole = 'radio' | 'toggle'
export type BuiltInPanelPlacementMode = PicodashPanelPlacement['mode']

export const builtInPanelPlacementPositions = {
  fixed: [
    'top-left',
    'top-right',
    'bottom-left',
    'bottom-right',
    'full-left',
    'full-right',
    'middle-left',
    'middle-right',
  ],
  floating: [
    'top-left',
    'top',
    'top-right',
    'right',
    'bottom-right',
    'bottom',
    'bottom-left',
    'left',
  ],
  hybrid: [
    'top-left',
    'top',
    'top-right',
    'full-right',
    'bottom-right',
    'bottom',
    'bottom-left',
    'full-left',
  ],
} as const satisfies Record<BuiltInPanelPlacementMode, readonly BuiltInPanelPlacementPosition[]>

export type BuiltInPanelPlacementPosition =
  | PicodashPanelDockedPosition
  | PicodashPanelSnappedPosition

const panelPlacementPoints = {
  'bottom-left': [0, 1],
  'bottom-right': [1, 1],
  bottom: [0.5, 1],
  'full-left': [0, 0.5],
  'full-right': [1, 0.5],
  left: [0, 0.5],
  'middle-left': [0, 0.5],
  'middle-right': [1, 0.5],
  right: [1, 0.5],
  'top-left': [0, 0],
  'top-right': [1, 0],
  top: [0.5, 0],
} as const satisfies Record<BuiltInPanelPlacementPosition, readonly [number, number]>

export function closestBuiltInPanelPlacementPosition(
  position: BuiltInPanelPlacementPosition,
  mode: BuiltInPanelPlacementMode,
): BuiltInPanelPlacementPosition {
  const validPositions = builtInPanelPlacementPositions[
    mode
  ] as readonly BuiltInPanelPlacementPosition[]
  if (validPositions.includes(position)) return position

  const [sourceX, sourceY] = panelPlacementPoints[position]
  return validPositions.reduce((closest, candidate) => {
    const [closestX, closestY] = panelPlacementPoints[closest]
    const [candidateX, candidateY] = panelPlacementPoints[candidate]
    const closestDistance = Math.hypot(closestX - sourceX, closestY - sourceY)
    const candidateDistance = Math.hypot(candidateX - sourceX, candidateY - sourceY)
    return candidateDistance < closestDistance ? candidate : closest
  })
}

export const builtInItemIds = [
  'text',
  'multilineText',
  'number',
  'switch',
  'select',
  'slider',
  'sliderMarks',
  'range',
  'segmented',
  'vector3',
  'alignment',
  'xyPad',
  'gradient',
  'previewAsset',
  'droppedFiles',
  'sparkline',
  'shadcn-frame-chart',
  'displayFallback',
  'display',
] as const

export type BuiltInItemId = (typeof builtInItemIds)[number]

export const builtInGroupIds = [
  'common-items',
  'spatial-items',
  'media-items',
  'chart-items',
  'visualization-items',
] as const

export type BuiltInGroupId = (typeof builtInGroupIds)[number]

export interface BuiltInItemExampleProps {
  contentLayout: BuiltInContentLayout
  description: string
  disabled: boolean
  readOnly: boolean
  reorderable: boolean
  visible: boolean
}

export interface BuiltInGroupExampleProps {
  collapsible: boolean
  defaultCollapsed: boolean
  visible: boolean
}

export interface BuiltInItemsExampleConfig {
  chartAccessibilityLayer: boolean
  chartType: BuiltInChartType
  commonGroupLabel: string
  commonGroupReorderable: boolean
  dropzoneMaxFiles: number
  dropzoneMaxSize: number
  dropzoneShowPreviews: boolean
  groupProps: Record<BuiltInGroupId, BuiltInGroupExampleProps>
  itemProps: Record<BuiltInItemId, BuiltInItemExampleProps>
  matrixSelectionRole: BuiltInMatrixSelectionRole
  multiline: boolean
  numberMax: number
  numberMin: number
  numberStep: number
  panelCollapsible: boolean
  panelPlacementMode: BuiltInPanelPlacementMode
  panelPlacementPosition: BuiltInPanelPlacementPosition
  panelTitle: string
  panelWidth: number
  rangeMax: number
  rangeMin: number
  rangeStep: number
  sliderMarksMax: number
  sliderMarksMin: number
  sliderMarksStep: number
  sliderMax: number
  sliderMin: number
  sliderStep: number
  sparklineAutoscale: boolean
  sparklineContinuous: boolean
  sparklineMaxValue: number
  sparklineMaxPoints: number
  sparklineMinValue: number
  sparklineShowBaseline: boolean
  vectorMax: number
  vectorMin: number
  vectorStep: number
  xyPadStep: number
  xyPadXMax: number
  xyPadXMin: number
  xyPadYMax: number
  xyPadYMin: number
}

function itemExampleProps(
  description = '',
  contentLayout: BuiltInContentLayout = 'inline',
  reorderable = true,
): BuiltInItemExampleProps {
  return {
    contentLayout,
    description,
    disabled: false,
    readOnly: false,
    reorderable,
    visible: true,
  }
}

function groupExampleProps(): BuiltInGroupExampleProps {
  return {
    collapsible: true,
    defaultCollapsed: false,
    visible: true,
  }
}

export const defaultBuiltInItemsExampleConfig: BuiltInItemsExampleConfig = {
  chartAccessibilityLayer: true,
  chartType: 'line',
  commonGroupLabel: 'Common inputs',
  commonGroupReorderable: true,
  dropzoneMaxFiles: 3,
  dropzoneMaxSize: 5_000_000,
  dropzoneShowPreviews: true,
  groupProps: {
    'chart-items': groupExampleProps(),
    'common-items': groupExampleProps(),
    'media-items': groupExampleProps(),
    'spatial-items': groupExampleProps(),
    'visualization-items': groupExampleProps(),
  },
  itemProps: {
    alignment: itemExampleProps(),
    display: itemExampleProps(),
    displayFallback: itemExampleProps(
      'The fallback prop supplies optional content when value is unset.',
    ),
    droppedFiles: itemExampleProps('', 'block'),
    gradient: itemExampleProps(
      'Drag stops or use arrow keys. Double-click the gradient to add a stop.',
      'block',
    ),
    multilineText: itemExampleProps(
      'The multiline prop switches the wrapped input to an auto-growing Textarea.',
    ),
    number: itemExampleProps(),
    previewAsset: itemExampleProps('', 'block'),
    range: itemExampleProps(),
    segmented: itemExampleProps(),
    select: itemExampleProps(),
    'shadcn-frame-chart': itemExampleProps(
      'A typed chart composition using public grid, axis, series, and tooltip props.',
      'block',
      false,
    ),
    slider: itemExampleProps(),
    sliderMarks: itemExampleProps(
      'The marks prop adds optional reference points along the slider track.',
    ),
    sparkline: itemExampleProps(
      'Move anywhere in the viewport. X and Y velocity stream at the display frame rate while this item is visible.',
      'block',
      false,
    ),
    switch: itemExampleProps(),
    text: itemExampleProps(),
    vector3: itemExampleProps(),
    xyPad: itemExampleProps('', 'block'),
  },
  matrixSelectionRole: 'radio',
  multiline: true,
  numberMax: 100,
  numberMin: 0,
  numberStep: 1,
  panelCollapsible: true,
  panelPlacementMode: 'floating',
  panelPlacementPosition: 'top-right',
  panelTitle: 'Built-in Items',
  panelWidth: 368,
  rangeMax: 100,
  rangeMin: 0,
  rangeStep: 1,
  sliderMarksMax: 1,
  sliderMarksMin: 0,
  sliderMarksStep: 0.01,
  sliderMax: 100,
  sliderMin: 0,
  sliderStep: 1,
  sparklineAutoscale: false,
  sparklineContinuous: true,
  sparklineMaxValue: 1800,
  sparklineMaxPoints: 56,
  sparklineMinValue: -1800,
  sparklineShowBaseline: true,
  vectorMax: 10,
  vectorMin: -10,
  vectorStep: 0.25,
  xyPadStep: 0.01,
  xyPadXMax: 1,
  xyPadXMin: 0,
  xyPadYMax: 1,
  xyPadYMin: 0,
}

export const densityOptions = [
  { label: 'Compact', value: 'compact' },
  { label: 'Balanced', value: 'balanced' },
  { label: 'Comfortable', value: 'comfortable' },
]

export const sliderMarks = [0, 0.5, 1]

export const segmentedOptions = [
  { label: 'Tight', value: 'compact' },
  { label: 'Balanced', value: 'balanced' },
  { label: 'Open', value: 'comfortable' },
]

export const percentFormatOptions = { style: 'percent' as const }

export const builtInItemDefaults = {
  alignment: 'center' as const,
  display: 'Ready',
  droppedFiles: [],
  gradient: [
    { color: '#22d3ee', id: 'cyan', position: 0 },
    { color: '#facc15', id: 'amber', position: 0.58 },
    { color: '#fb7185', id: 'rose', position: 1 },
  ],
  gradientRotation: 135,
  multilineText: 'A text area grows with its contents.',
  number: 24,
  previewAsset: '/favicon.svg',
  range: [24, 76] as [number, number],
  segmented: 'balanced',
  select: 'balanced',
  slider: 48,
  sliderMarks: 0.5,
  switch: true,
  text: 'Studio',
  vector3: { x: 1.25, y: -0.5, z: 3 },
  xyPad: { x: 0.68, y: 0.32 },
}

export type AlignmentValue =
  | 'bottom-center'
  | 'bottom-left'
  | 'bottom-right'
  | 'center'
  | 'middle-left'
  | 'middle-right'
  | 'top-center'
  | 'top-left'
  | 'top-right'

export interface BuiltInItemValues {
  alignment: AlignmentValue
  display: string
  droppedFiles: PicodashDropzoneValue
  gradient: PicodashGradientValue
  gradientRotation: number
  multilineText: string
  number: number
  previewAsset: string
  range: PicodashRangeValue
  segmented: string
  select: string
  slider: number
  sliderMarks: number
  switch: boolean
  text: string
  vector3: PicodashVector3Value
  xyPad: PicodashXYValue
}

const stringParser = parserFor<string>(
  (value): value is string => typeof value === 'string',
  'Value must be a string.',
)
const finiteNumberParser = parserFor<number>(
  (value): value is number => typeof value === 'number' && Number.isFinite(value),
  'Value must be a finite number.',
)

export const builtInItemsPanelStore = createPicodashStore<BuiltInItemValues>({
  fields: {
    alignment: {
      defaultValue: builtInItemDefaults.alignment,
      parse: parserFor<AlignmentValue>(
        (value): value is AlignmentValue =>
          typeof value === 'string' &&
          [
            'bottom-center',
            'bottom-left',
            'bottom-right',
            'center',
            'middle-left',
            'middle-right',
            'top-center',
            'top-left',
            'top-right',
          ].includes(value),
        'Alignment must be one of the supported matrix positions.',
      ),
    },
    display: { defaultValue: builtInItemDefaults.display, parse: stringParser },
    droppedFiles: {
      defaultValue: builtInItemDefaults.droppedFiles,
      parse: parserFor<PicodashDropzoneValue>(
        isDroppedFileMetadataList,
        'Dropped files must be a list of serializable file metadata records.',
      ),
    },
    gradient: {
      defaultValue: builtInItemDefaults.gradient,
      parse: parserFor<PicodashGradientValue>(
        isGradientValue,
        'Gradient stops must include a string id, hex color, and finite position.',
      ),
    },
    gradientRotation: {
      defaultValue: builtInItemDefaults.gradientRotation,
      parse: finiteNumberParser,
    },
    multilineText: { defaultValue: builtInItemDefaults.multilineText, parse: stringParser },
    number: { defaultValue: builtInItemDefaults.number, parse: finiteNumberParser },
    previewAsset: { defaultValue: builtInItemDefaults.previewAsset, parse: stringParser },
    range: {
      defaultValue: builtInItemDefaults.range,
      parse: parserFor<PicodashRangeValue>(
        (value): value is PicodashRangeValue =>
          Array.isArray(value) &&
          value.length === 2 &&
          value.every((entry) => typeof entry === 'number' && Number.isFinite(entry)),
        'Range must contain two finite numbers.',
      ),
    },
    segmented: { defaultValue: builtInItemDefaults.segmented, parse: stringParser },
    select: { defaultValue: builtInItemDefaults.select, parse: stringParser },
    slider: { defaultValue: builtInItemDefaults.slider, parse: finiteNumberParser },
    sliderMarks: { defaultValue: builtInItemDefaults.sliderMarks, parse: finiteNumberParser },
    switch: {
      defaultValue: builtInItemDefaults.switch,
      parse: parserFor<boolean>(
        (value): value is boolean => typeof value === 'boolean',
        'Value must be a boolean.',
      ),
    },
    text: { defaultValue: builtInItemDefaults.text, parse: stringParser },
    vector3: {
      defaultValue: builtInItemDefaults.vector3,
      parse: parserFor<PicodashVector3Value>(
        isVector3Value,
        'Vector3 must contain finite x, y, and z coordinates.',
      ),
    },
    xyPad: {
      defaultValue: builtInItemDefaults.xyPad,
      parse: parserFor<PicodashXYValue>(
        isXYValue,
        'XY value must contain finite x and y coordinates.',
      ),
    },
  },
  panelId: builtInItemsPanelId,
})

function parserFor<TValue extends PicodashJsonValue>(
  accepts: (input: unknown) => input is TValue,
  message: string,
): PicodashParser<TValue, false> {
  return ((input: unknown) =>
    accepts(input)
      ? { output: { value: input }, success: true }
      : { errors: [message], success: false }) as PicodashParser<TValue, false>
}

function isFiniteCoordinate(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
}

function isXYValue(value: unknown): value is PicodashXYValue {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return isFiniteCoordinate(candidate.x) && isFiniteCoordinate(candidate.y)
}

function isVector3Value(value: unknown): value is PicodashVector3Value {
  if (!isXYValue(value)) return false
  return isFiniteCoordinate((value as Record<string, unknown>).z)
}

function isGradientValue(value: unknown): value is PicodashGradientValue {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    value.every((entry) => {
      if (typeof entry !== 'object' || entry === null) return false
      const stop = entry as Record<string, unknown>
      return (
        typeof stop.id === 'string' &&
        typeof stop.color === 'string' &&
        /^#[\da-f]{6}$/i.test(stop.color) &&
        isFiniteCoordinate(stop.position)
      )
    })
  )
}

function isDroppedFileMetadataList(value: unknown): value is PicodashDropzoneValue {
  return (
    Array.isArray(value) &&
    value.every((entry) => {
      if (typeof entry !== 'object' || entry === null) return false
      const file = entry as Record<string, unknown>
      return (
        typeof file.id === 'string' &&
        typeof file.name === 'string' &&
        typeof file.type === 'string' &&
        isFiniteCoordinate(file.lastModified) &&
        isFiniteCoordinate(file.size)
      )
    })
  )
}

const alignmentRows = [
  { className: 'items-start', label: 'Top', value: 'top' },
  { className: 'items-center', label: 'Middle', value: 'middle' },
  { className: 'items-end', label: 'Bottom', value: 'bottom' },
] as const

const alignmentColumns = [
  { className: 'justify-start', Icon: TextAlignStart, label: 'left', value: 'left' },
  { className: 'justify-center', Icon: TextAlignCenter, label: 'center', value: 'center' },
  { className: 'justify-end', Icon: TextAlignEnd, label: 'right', value: 'right' },
] as const satisfies readonly {
  className: string
  Icon: LucideIcon
  label: string
  value: string
}[]

type AlignmentPosition =
  `${(typeof alignmentRows)[number]['value']}-${(typeof alignmentColumns)[number]['value']}`
type InferredAlignmentValue = Exclude<AlignmentPosition, 'middle-center'> | 'center'

const alignmentTypeCheck: AlignmentValue extends InferredAlignmentValue
  ? InferredAlignmentValue extends AlignmentValue
    ? true
    : never
  : never = true
void alignmentTypeCheck

export const alignmentOptions = alignmentRows.map((row, rowIndex) =>
  alignmentColumns.map((column, columnIndex) => ({
    'aria-label': `${row.label} ${column.label}`,
    children: (
      <column.Icon aria-hidden="true" className="size-(--picodash-icon-sm)" strokeWidth={2} />
    ),
    className: [
      'relative flex size-(--picodash-control-height-md) p-(--picodash-space-1) text-picodash-muted transition-colors duration-(--picodash-duration-fast) hover:bg-picodash-surface-muted hover:text-picodash-text data-[state=on]:bg-picodash-accent data-[state=on]:text-picodash-accent-text',
      columnIndex === 0 ? '' : 'border-l border-picodash-control',
      rowIndex === 0 ? '' : 'border-t border-picodash-control',
      row.className,
      column.className,
    ]
      .filter(Boolean)
      .join(' '),
    'data-alignment-index': rowIndex * alignmentColumns.length + columnIndex,
    title: `${row.label} ${column.label}`,
    value:
      row.value === 'middle' && column.value === 'center'
        ? 'center'
        : (`${row.value}-${column.value}` as AlignmentValue),
  })),
) satisfies readonly (readonly PicodashMatrix2DOption<AlignmentValue>[])[]

export const alignmentContainerProps = {
  'aria-label': 'Alignment',
  className:
    'border-picodash-control shadow-picodash-sm rounded-picodash-control overflow-hidden border bg-(--_picodash-choice-background) p-(--picodash-space-0-5)',
}

export const builtInPropTypes = {
  PicodashChart: `type PicodashChartProps =
  | PicodashAreaChartProps
  | PicodashBarChartProps
  | PicodashLineChartProps
  | PicodashPieChartProps
  | PicodashRadarChartProps
  | PicodashRadialChartProps`,
  PicodashDisplay: `type PicodashDisplayProps = {
  field?: PicodashField<Values, keyof Values>
  id?: string
  label?: ReactNode
  value?: ReactiveProp<ReactNode>
  fallback?: ReactNode
}`,
  PicodashDropzone: `type PicodashDropzoneProps = {
  field: PicodashField<Values, keyof Values>
  accept?: Accept
  maxFiles?: number
  maxSize?: number
  showPreviews?: boolean
}`,
  PicodashGradient: `type PicodashGradientProps = {
  field: PicodashField<Values, keyof Values>
  rotationField?: PicodashField<Values, keyof Values>
}`,
  PicodashMatrix2D: `type PicodashMatrix2DProps<T> = {
  field: PicodashField<Values, keyof Values>
  options: Matrix2DOption<T>[][]
  containerProps?: ComponentProps<"div">
  selectionRole?: "radio" | "toggle"
  validationMessage?: string
}`,
  PicodashMediaPreview: `type PicodashMediaPreviewProps = {
  field: PicodashField<Values, keyof Values>
  src?: ReactiveProp<string>
  alt: string
  objectFit?: CSSProperties["objectFit"]
}`,
  PicodashNumber: `type PicodashNumberProps = {
  field: PicodashField<Values, keyof Values>
  min?: ReactiveProp<number>
  max?: ReactiveProp<number>
  step?: ReactiveProp<number>
}`,
  PicodashRange: `type PicodashRangeProps = {
  field: PicodashField<Values, keyof Values>
  min?: ReactiveProp<number>
  max?: ReactiveProp<number>
  step?: ReactiveProp<number>
}`,
  PicodashSegmented: `type PicodashSegmentedProps = {
  field: PicodashField<Values, keyof Values>
  options: SegmentedOption[]
}`,
  PicodashSelect: `type PicodashSelectProps = {
  field: PicodashField<Values, keyof Values>
  options: ReactiveProp<SelectOption[]>
}`,
  PicodashSlider: `type PicodashSliderProps = {
  field: PicodashField<Values, keyof Values>
  min?: ReactiveProp<number>
  max?: ReactiveProp<number>
  step?: ReactiveProp<number>
  marks?: ReactiveProp<SliderMarks>
  formatOptions?: Intl.NumberFormatOptions
}`,
  PicodashSparkline: `type PicodashSparklineProps = {
  id: string
  data: Array<number | Record<string, number>> | (() => AsyncIterable<PicodashSparklineEmission>) | PicodashSparklineSource
  series?: Array<{
    dataKey: string
    label?: string
    stroke?: string
    strokeWidth?: number
  }>
  maxPoints?: number
  continuous?: boolean
  stroke?: string
} & (
  | { autoscale: true; minValue?: never; maxValue?: never }
  | { autoscale?: false; minValue?: number; maxValue?: number }
)`,
  PicodashSwitch: `type PicodashSwitchProps = {
  field: PicodashField<Values, keyof Values>
}`,
  PicodashText: `type PicodashTextProps = {
  field: PicodashField<Values, keyof Values>
  placeholder?: string
  multiline?: boolean
}`,
  PicodashVector3: `type PicodashVector3Props = {
  field: PicodashField<Values, keyof Values>
  min?: ReactiveProp<number>
  max?: ReactiveProp<number>
  step?: ReactiveProp<number>
}`,
  PicodashXYPad: `type PicodashXYPadProps = {
  field: PicodashField<Values, keyof Values>
  xMin?: ReactiveProp<number>
  xMax?: ReactiveProp<number>
  yMin?: ReactiveProp<number>
  yMax?: ReactiveProp<number>
  step?: ReactiveProp<number>
}`,
} as const

type BuiltInComponentName = keyof typeof builtInPropTypes

function propTypeHelp(component: BuiltInComponentName) {
  return (
    <span className="grid gap-(--picodash-space-2)">
      <span className="text-picodash-strong font-medium">{component}</span>
      <code className="text-picodash-text block font-mono text-(length:--picodash-font-size-md) leading-(--picodash-line-relaxed) whitespace-pre-wrap">
        {builtInPropTypes[component]}
      </code>
    </span>
  )
}

export function BuiltInItemsPanel({
  config = defaultBuiltInItemsExampleConfig,
  defaultVisible = false,
}: {
  config?: BuiltInItemsExampleConfig
  defaultVisible?: boolean
}) {
  const rootOrder = usePicodashStoreSelector(
    builtInItemsPanelStore,
    (state) => state.itemMetadata.order.root ?? [],
  )
  const draggingId = usePicodashStoreSelector(
    builtInItemsPanelStore,
    (state) => state.interaction.draggingId,
  )

  return (
    <PicodashPanel
      store={builtInItemsPanelStore}
      title={config.panelTitle}
      close
      collapsible={config.panelCollapsible}
      defaultPlacement={placementForBuiltInItemsConfig(config)}
      defaultVisible={defaultVisible}
      width={config.panelWidth}
      className="top-4 right-4 max-w-[calc(100dvw-2rem)] bg-(--picodash-color-surface)/72 backdrop-blur-xl lg:top-8 lg:right-8"
      data-example-width={config.panelWidth}
    >
      <output data-built-in-root-order hidden>
        {rootOrder.join(',')}
      </output>
      <output data-built-in-dragging-id hidden>
        {draggingId ?? ''}
      </output>
      <PicodashGroup
        {...config.groupProps['common-items']}
        id="common-items"
        label={config.commonGroupLabel}
        reorderable={config.commonGroupReorderable}
      >
        <PicodashText
          {...config.itemProps.text}
          field={builtInItemsPanelStore.fields.text}
          label="Text"
          help={propTypeHelp('PicodashText')}
          placeholder="Enter text"
        />
        <PicodashText
          {...config.itemProps.multilineText}
          field={builtInItemsPanelStore.fields.multilineText}
          label="Text"
          help={propTypeHelp('PicodashText')}
          multiline={config.multiline}
          placeholder="Enter longer text"
        />
        <PicodashNumber
          {...config.itemProps.number}
          field={builtInItemsPanelStore.fields.number}
          label="Number"
          help={propTypeHelp('PicodashNumber')}
          min={config.numberMin}
          max={config.numberMax}
          step={config.numberStep}
        />
        <PicodashSwitch
          {...config.itemProps.switch}
          field={builtInItemsPanelStore.fields.switch}
          label="Switch"
          help={propTypeHelp('PicodashSwitch')}
        />
        <PicodashSelect
          {...config.itemProps.select}
          field={builtInItemsPanelStore.fields.select}
          label="Select"
          help={propTypeHelp('PicodashSelect')}
          options={densityOptions}
        />
        <PicodashSlider
          {...config.itemProps.slider}
          field={builtInItemsPanelStore.fields.slider}
          label="Slider"
          help={propTypeHelp('PicodashSlider')}
          min={config.sliderMin}
          max={config.sliderMax}
          step={config.sliderStep}
        />
        <PicodashSlider
          {...config.itemProps.sliderMarks}
          field={builtInItemsPanelStore.fields.sliderMarks}
          label="Slider"
          help={propTypeHelp('PicodashSlider')}
          min={config.sliderMarksMin}
          max={config.sliderMarksMax}
          step={config.sliderMarksStep}
          marks={sliderMarks}
          formatOptions={percentFormatOptions}
        />
        <PicodashRange
          {...config.itemProps.range}
          field={builtInItemsPanelStore.fields.range}
          label="Range"
          help={propTypeHelp('PicodashRange')}
          min={config.rangeMin}
          max={config.rangeMax}
          step={config.rangeStep}
        />
        <PicodashSegmented
          {...config.itemProps.segmented}
          field={builtInItemsPanelStore.fields.segmented}
          label="Segmented"
          help={propTypeHelp('PicodashSegmented')}
          options={segmentedOptions}
        />
        <PicodashVector3
          {...config.itemProps.vector3}
          field={builtInItemsPanelStore.fields.vector3}
          label="Vector3"
          help={propTypeHelp('PicodashVector3')}
          max={config.vectorMax}
          min={config.vectorMin}
          step={config.vectorStep}
        />
        <PicodashMatrix2D
          {...config.itemProps.alignment}
          field={builtInItemsPanelStore.fields.alignment}
          label="Matrix2D"
          help={propTypeHelp('PicodashMatrix2D')}
          containerProps={alignmentContainerProps}
          options={alignmentOptions}
          selectionRole={config.matrixSelectionRole}
          validationMessage="Alignment must be one of the nine supported positions."
        />
      </PicodashGroup>

      <PicodashGroup
        {...config.groupProps['spatial-items']}
        id="spatial-items"
        label="Direct manipulation"
      >
        <PicodashXYPad
          {...config.itemProps.xyPad}
          field={builtInItemsPanelStore.fields.xyPad}
          label="XYPad"
          help={propTypeHelp('PicodashXYPad')}
          step={config.xyPadStep}
          xMax={config.xyPadXMax}
          xMin={config.xyPadXMin}
          yMax={config.xyPadYMax}
          yMin={config.xyPadYMin}
        />
        <PicodashGradient
          {...config.itemProps.gradient}
          field={builtInItemsPanelStore.fields.gradient}
          label="Gradient"
          help={propTypeHelp('PicodashGradient')}
          rotationField={builtInItemsPanelStore.fields.gradientRotation}
        />
      </PicodashGroup>

      <PicodashGroup {...config.groupProps['media-items']} id="media-items" label="Media and files">
        <PicodashMediaPreview
          {...config.itemProps.previewAsset}
          alt="Picodash mark"
          field={builtInItemsPanelStore.fields.previewAsset}
          label="MediaPreview"
          help={propTypeHelp('PicodashMediaPreview')}
          src="/favicon.svg"
        />
        <PicodashDropzone
          {...config.itemProps.droppedFiles}
          accept={{ 'image/*': ['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp'] }}
          field={builtInItemsPanelStore.fields.droppedFiles}
          label="Dropzone"
          help={propTypeHelp('PicodashDropzone')}
          maxFiles={config.dropzoneMaxFiles}
          maxSize={config.dropzoneMaxSize}
          showPreviews={config.dropzoneShowPreviews}
        />
      </PicodashGroup>

      <PicodashGroup {...config.groupProps['chart-items']} id="chart-items" label="Charts">
        <StreamingSparklineItem
          {...config.itemProps.sparkline}
          autoscale={config.sparklineAutoscale}
          continuous={config.sparklineContinuous}
          help={propTypeHelp('PicodashSparkline')}
          maxValue={config.sparklineMaxValue}
          maxPoints={config.sparklineMaxPoints}
          minValue={config.sparklineMinValue}
          showBaseline={config.sparklineShowBaseline}
        />
        <ShadcnChartItem
          {...config.itemProps['shadcn-frame-chart']}
          accessibilityLayer={config.chartAccessibilityLayer}
          help={propTypeHelp('PicodashChart')}
          type={config.chartType}
        />
      </PicodashGroup>

      <PicodashGroup
        {...config.groupProps['visualization-items']}
        id="visualization-items"
        label="Display variants"
      >
        <PicodashDisplay
          {...config.itemProps.displayFallback}
          id="displayFallback"
          label="Display"
          fallback="Waiting"
          help={propTypeHelp('PicodashDisplay')}
        />
        <PicodashDisplay
          {...config.itemProps.display}
          field={builtInItemsPanelStore.fields.display}
          label="Display"
          help={propTypeHelp('PicodashDisplay')}
        />
      </PicodashGroup>
    </PicodashPanel>
  )
}

export function placementForBuiltInItemsConfig(
  config: Pick<BuiltInItemsExampleConfig, 'panelPlacementMode' | 'panelPlacementPosition'>,
): PicodashPanelPlacement {
  const { panelPlacementMode: mode } = config
  const position = closestBuiltInPanelPlacementPosition(config.panelPlacementPosition, mode)
  if (mode === 'fixed') {
    return {
      disposition: { kind: 'docked', position: position as PicodashPanelDockedPosition },
      mode,
    }
  }
  if (mode === 'hybrid') {
    return position === 'bottom' || position === 'top'
      ? { disposition: { kind: 'snapped', position }, mode }
      : {
          disposition: {
            kind: 'docked',
            position: position as Exclude<
              PicodashPanelDockedPosition,
              'middle-left' | 'middle-right'
            >,
          },
          mode,
        }
  }
  return {
    disposition: { kind: 'snapped', position: position as PicodashPanelSnappedPosition },
    mode,
  }
}

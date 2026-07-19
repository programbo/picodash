import { TextAlignCenter, TextAlignEnd, TextAlignStart, type LucideIcon } from 'lucide-react'
import {
  createTweakerPanelStore,
  TweakerDisplay,
  TweakerDropzone,
  TweakerGradient,
  TweakerGroup,
  TweakerMatrix2D,
  TweakerMediaPreview,
  TweakerNumber,
  TweakerPanel,
  TweakerRange,
  TweakerSegmented,
  TweakerSelect,
  TweakerSlider,
  TweakerSwitch,
  TweakerText,
  TweakerVector3,
  TweakerXYPad,
  type TweakerMatrix2DOption,
} from 'panel'
import { ShadcnChartItem } from '@/custom-items/shadcn-chart'
import { StreamingSparklineItem } from '@/custom-items/streaming-sparkline'

export const builtInItemsPanelId = 'built-in-items'

export type BuiltInChartType = 'area' | 'bar' | 'line' | 'pie' | 'radar' | 'radial'
export type BuiltInContentLayout = 'block' | 'full' | 'inline'
export type BuiltInMatrixSelectionRole = 'radio' | 'toggle'

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

export const builtInItemsPanelStore = createTweakerPanelStore({
  initialValues: builtInItemDefaults,
  panelId: builtInItemsPanelId,
})

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
type AlignmentValue = Exclude<AlignmentPosition, 'middle-center'> | 'center'

export const alignmentOptions = alignmentRows.map((row, rowIndex) =>
  alignmentColumns.map((column, columnIndex) => ({
    'aria-label': `${row.label} ${column.label}`,
    children: (
      <column.Icon aria-hidden="true" className="size-(--tweaker-icon-sm)" strokeWidth={2} />
    ),
    className: [
      'relative flex size-(--tweaker-control-height-md) p-(--tweaker-space-1) text-tweaker-muted transition-colors duration-(--tweaker-duration-fast) hover:bg-tweaker-surface-muted hover:text-tweaker-text data-[state=on]:bg-tweaker-accent data-[state=on]:text-tweaker-accent-text',
      columnIndex === 0 ? '' : 'border-l border-tweaker-control',
      rowIndex === 0 ? '' : 'border-t border-tweaker-control',
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
) satisfies readonly (readonly TweakerMatrix2DOption<AlignmentValue>[])[]

export const alignmentContainerProps = {
  'aria-label': 'Alignment',
  className:
    'border-tweaker-control shadow-tweaker-sm rounded-tweaker-control overflow-hidden border bg-(--_tweaker-choice-background) p-(--tweaker-space-0-5)',
}

export const builtInPropTypes = {
  TweakerChart: `type TweakerChartProps =
  | TweakerAreaChartProps
  | TweakerBarChartProps
  | TweakerLineChartProps
  | TweakerPieChartProps
  | TweakerRadarChartProps
  | TweakerRadialChartProps`,
  TweakerDisplay: `type TweakerDisplayProps = {
  id: string
  label?: ReactNode
  value?: ReactiveProp<ReactNode>
  fallback?: ReactNode
}`,
  TweakerDropzone: `type TweakerDropzoneProps = {
  field: string
  accept?: Accept
  maxFiles?: number
  maxSize?: number
  showPreviews?: boolean
}`,
  TweakerGradient: `type TweakerGradientProps = {
  field: string
  defaultValue?: GradientStop[]
  defaultRotation?: number
  rotationField?: string
}`,
  TweakerMatrix2D: `type TweakerMatrix2DProps<T> = {
  field: string
  defaultValue?: T
  options: Matrix2DOption<T>[][]
  containerProps?: ComponentProps<"div">
  selectionRole?: "radio" | "toggle"
  validationMessage?: string
}`,
  TweakerMediaPreview: `type TweakerMediaPreviewProps = {
  field: string
  src?: ReactiveProp<string>
  alt: string
  objectFit?: CSSProperties["objectFit"]
}`,
  TweakerNumber: `type TweakerNumberProps = {
  field: string
  defaultValue?: number
  min?: ReactiveProp<number>
  max?: ReactiveProp<number>
  step?: ReactiveProp<number>
}`,
  TweakerRange: `type TweakerRangeProps = {
  field: string
  defaultValue?: [number, number]
  min?: ReactiveProp<number>
  max?: ReactiveProp<number>
  step?: ReactiveProp<number>
}`,
  TweakerSegmented: `type TweakerSegmentedProps = {
  field: string
  defaultValue?: string
  options: SegmentedOption[]
}`,
  TweakerSelect: `type TweakerSelectProps = {
  field: string
  defaultValue?: string
  options: ReactiveProp<SelectOption[]>
}`,
  TweakerSlider: `type TweakerSliderProps = {
  field: string
  defaultValue?: number
  min?: ReactiveProp<number>
  max?: ReactiveProp<number>
  step?: ReactiveProp<number>
  marks?: ReactiveProp<SliderMarks>
  formatOptions?: Intl.NumberFormatOptions
}`,
  TweakerSparkline: `type TweakerSparklineProps = {
  id: string
  data: Array<number | Record<string, number>> | (() => AsyncIterable<TweakerSparklineEmission>) | TweakerSparklineSource
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
  TweakerSwitch: `type TweakerSwitchProps = {
  field: string
  defaultValue?: boolean
}`,
  TweakerText: `type TweakerTextProps = {
  field: string
  defaultValue?: string
  placeholder?: string
  multiline?: boolean
}`,
  TweakerVector3: `type TweakerVector3Props = {
  field: string
  defaultValue?: { x: number; y: number; z: number }
  min?: ReactiveProp<number>
  max?: ReactiveProp<number>
  step?: ReactiveProp<number>
}`,
  TweakerXYPad: `type TweakerXYPadProps = {
  field: string
  defaultValue?: { x: number; y: number }
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
    <span className="grid gap-(--tweaker-space-2)">
      <span className="text-tweaker-strong font-medium">{component}</span>
      <code className="text-tweaker-text block font-mono text-(length:--tweaker-font-size-md) leading-(--tweaker-line-relaxed) whitespace-pre-wrap">
        {builtInPropTypes[component]}
      </code>
    </span>
  )
}

export function BuiltInItemsPanel({
  config = defaultBuiltInItemsExampleConfig,
}: {
  config?: BuiltInItemsExampleConfig
}) {
  return (
    <TweakerPanel
      store={builtInItemsPanelStore}
      title={config.panelTitle}
      collapsible={config.panelCollapsible}
      defaultPlacement="top-right"
      width={config.panelWidth}
      className="bg-tweaker-surface/72 top-4 right-4 max-w-[calc(100dvw-2rem)] backdrop-blur-xl lg:top-8 lg:right-8"
      data-example-width={config.panelWidth}
    >
      <TweakerGroup
        {...config.groupProps['common-items']}
        id="common-items"
        label={config.commonGroupLabel}
        reorderable={config.commonGroupReorderable}
      >
        <TweakerText
          {...config.itemProps.text}
          field="text"
          label="Text"
          defaultValue={builtInItemDefaults.text}
          help={propTypeHelp('TweakerText')}
          placeholder="Enter text"
        />
        <TweakerText
          {...config.itemProps.multilineText}
          field="multilineText"
          label="Text"
          defaultValue={builtInItemDefaults.multilineText}
          help={propTypeHelp('TweakerText')}
          multiline={config.multiline}
          placeholder="Enter longer text"
        />
        <TweakerNumber
          {...config.itemProps.number}
          field="number"
          label="Number"
          defaultValue={builtInItemDefaults.number}
          help={propTypeHelp('TweakerNumber')}
          min={config.numberMin}
          max={config.numberMax}
          step={config.numberStep}
        />
        <TweakerSwitch
          {...config.itemProps.switch}
          field="switch"
          label="Switch"
          defaultValue={builtInItemDefaults.switch}
          help={propTypeHelp('TweakerSwitch')}
        />
        <TweakerSelect
          {...config.itemProps.select}
          field="select"
          label="Select"
          defaultValue={builtInItemDefaults.select}
          help={propTypeHelp('TweakerSelect')}
          options={densityOptions}
        />
        <TweakerSlider
          {...config.itemProps.slider}
          field="slider"
          label="Slider"
          defaultValue={builtInItemDefaults.slider}
          help={propTypeHelp('TweakerSlider')}
          min={config.sliderMin}
          max={config.sliderMax}
          step={config.sliderStep}
        />
        <TweakerSlider
          {...config.itemProps.sliderMarks}
          field="sliderMarks"
          label="Slider"
          defaultValue={builtInItemDefaults.sliderMarks}
          help={propTypeHelp('TweakerSlider')}
          min={config.sliderMarksMin}
          max={config.sliderMarksMax}
          step={config.sliderMarksStep}
          marks={sliderMarks}
          formatOptions={percentFormatOptions}
        />
        <TweakerRange
          {...config.itemProps.range}
          field="range"
          label="Range"
          defaultValue={builtInItemDefaults.range}
          help={propTypeHelp('TweakerRange')}
          min={config.rangeMin}
          max={config.rangeMax}
          step={config.rangeStep}
        />
        <TweakerSegmented
          {...config.itemProps.segmented}
          field="segmented"
          label="Segmented"
          defaultValue={builtInItemDefaults.segmented}
          help={propTypeHelp('TweakerSegmented')}
          options={segmentedOptions}
        />
        <TweakerVector3
          {...config.itemProps.vector3}
          field="vector3"
          label="Vector3"
          defaultValue={builtInItemDefaults.vector3}
          help={propTypeHelp('TweakerVector3')}
          max={config.vectorMax}
          min={config.vectorMin}
          step={config.vectorStep}
        />
        <TweakerMatrix2D
          {...config.itemProps.alignment}
          field="alignment"
          label="Matrix2D"
          defaultValue={builtInItemDefaults.alignment}
          help={propTypeHelp('TweakerMatrix2D')}
          containerProps={alignmentContainerProps}
          options={alignmentOptions}
          selectionRole={config.matrixSelectionRole}
          validationMessage="Alignment must be one of the nine supported positions."
        />
      </TweakerGroup>

      <TweakerGroup
        {...config.groupProps['spatial-items']}
        id="spatial-items"
        label="Direct manipulation"
      >
        <TweakerXYPad
          {...config.itemProps.xyPad}
          field="xyPad"
          label="XYPad"
          defaultValue={builtInItemDefaults.xyPad}
          help={propTypeHelp('TweakerXYPad')}
          step={config.xyPadStep}
          xMax={config.xyPadXMax}
          xMin={config.xyPadXMin}
          yMax={config.xyPadYMax}
          yMin={config.xyPadYMin}
        />
        <TweakerGradient
          {...config.itemProps.gradient}
          defaultRotation={builtInItemDefaults.gradientRotation}
          field="gradient"
          label="Gradient"
          defaultValue={builtInItemDefaults.gradient}
          help={propTypeHelp('TweakerGradient')}
          rotationField="gradientRotation"
        />
      </TweakerGroup>

      <TweakerGroup {...config.groupProps['media-items']} id="media-items" label="Media and files">
        <TweakerMediaPreview
          {...config.itemProps.previewAsset}
          alt="Tweaker mark"
          field="previewAsset"
          label="MediaPreview"
          help={propTypeHelp('TweakerMediaPreview')}
          src="/favicon.svg"
        />
        <TweakerDropzone
          {...config.itemProps.droppedFiles}
          accept={{ 'image/*': ['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp'] }}
          field="droppedFiles"
          label="Dropzone"
          help={propTypeHelp('TweakerDropzone')}
          maxFiles={config.dropzoneMaxFiles}
          maxSize={config.dropzoneMaxSize}
          showPreviews={config.dropzoneShowPreviews}
        />
      </TweakerGroup>

      <TweakerGroup {...config.groupProps['chart-items']} id="chart-items" label="Charts">
        <StreamingSparklineItem
          {...config.itemProps.sparkline}
          autoscale={config.sparklineAutoscale}
          continuous={config.sparklineContinuous}
          help={propTypeHelp('TweakerSparkline')}
          maxValue={config.sparklineMaxValue}
          maxPoints={config.sparklineMaxPoints}
          minValue={config.sparklineMinValue}
          showBaseline={config.sparklineShowBaseline}
        />
        <ShadcnChartItem
          {...config.itemProps['shadcn-frame-chart']}
          accessibilityLayer={config.chartAccessibilityLayer}
          help={propTypeHelp('TweakerChart')}
          type={config.chartType}
        />
      </TweakerGroup>

      <TweakerGroup
        {...config.groupProps['visualization-items']}
        id="visualization-items"
        label="Display variants"
      >
        <TweakerDisplay
          {...config.itemProps.displayFallback}
          id="displayFallback"
          label="Display"
          fallback="Waiting"
          help={propTypeHelp('TweakerDisplay')}
        />
        <TweakerDisplay
          {...config.itemProps.display}
          id="display"
          label="Display"
          help={propTypeHelp('TweakerDisplay')}
          value={builtInItemDefaults.display}
        />
      </TweakerGroup>
    </TweakerPanel>
  )
}

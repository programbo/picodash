import hljs from 'highlight.js/lib/core'
import typescript from 'highlight.js/lib/languages/typescript'
import { Check, Copy } from 'lucide-react'
import { Tooltip as TooltipPrimitive } from 'radix-ui'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { darkStyles, JsonView } from 'react-json-view-lite'
import 'react-json-view-lite/dist/index.css'
import { useTweakerPanelStoreSelector } from 'panel'
import type { TweakerPanelState } from 'panel/advanced'
import {
  alignmentContainerProps,
  alignmentOptions,
  builtInPropTypes,
  builtInItemDefaults,
  builtInItemsPanelStore,
  densityOptions,
  percentFormatOptions,
  segmentedOptions,
  sliderMarks,
  type BuiltInContentLayout,
  type BuiltInGroupExampleProps,
  type BuiltInGroupId,
  type BuiltInItemExampleProps,
  type BuiltInItemId,
  type BuiltInItemsExampleConfig,
} from '@/built-in-items-panel'
import { shadcnChartTypes } from '@/custom-items/shadcn-chart'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

hljs.registerLanguage('typescript', typescript)

type InteractiveJsxExampleProps = {
  config: BuiltInItemsExampleConfig
  onConfigChange: (config: BuiltInItemsExampleConfig) => void
  onProviderThemeChange: (theme: string) => void
  providerTheme: string
}

type StaticPropValue = (
  | {
      ariaLabel?: string
      kind: 'boolean'
      onChange?: (value: boolean) => void
      value: boolean
    }
  | { jsonValue?: unknown; kind: 'expression'; value: string }
  | {
      ariaLabel?: string
      kind: 'number'
      max?: number
      min?: number
      onChange?: (value: number) => void
      value: number
    }
  | {
      ariaLabel?: string
      kind: 'string'
      onChange?: (value: string) => void
      value: string
      values?: readonly string[]
    }
) & {
  hidden?: boolean
}

type CommonInputLine = {
  controlId?: string
  name: string
  props: Record<string, StaticPropValue>
}

type UpdateItemProp = <Key extends keyof BuiltInItemExampleProps>(
  id: BuiltInItemId,
  key: Key,
  value: BuiltInItemExampleProps[Key],
) => void

type UpdateGroupProp = <Key extends keyof BuiltInGroupExampleProps>(
  id: BuiltInGroupId,
  key: Key,
  value: BuiltInGroupExampleProps[Key],
) => void

function commonInputLinesForConfig(
  config: BuiltInItemsExampleConfig,
  updateBoolean?: (key: BooleanConfigKey, value: boolean) => void,
  updateItemProp?: UpdateItemProp,
  updateNumber?: (key: NumberConfigKey, value: number) => void,
  updateString?: (key: StringConfigKey, value: string) => void,
): CommonInputLine[] {
  const editableBoolean = (key: BooleanConfigKey, ariaLabel: string): StaticPropValue => ({
    ariaLabel,
    kind: 'boolean',
    onChange: updateBoolean ? (value) => updateBoolean(key, value) : undefined,
    value: config[key],
  })
  const editableNumber = (
    key: NumberConfigKey,
    ariaLabel: string,
    min = -1000,
    max = 1000,
  ): StaticPropValue => ({
    ariaLabel,
    kind: 'number',
    max,
    min,
    onChange: updateNumber ? (value) => updateNumber(key, value) : undefined,
    value: config[key],
  })

  const lines: CommonInputLine[] = [
    {
      name: 'TweakerText',
      props: {
        field: { kind: 'string', value: 'text' },
        label: { kind: 'string', value: 'Text' },
        defaultValue: {
          jsonValue: builtInItemDefaults.text,
          kind: 'expression',
          value: 'builtInItemDefaults.text',
        },
        placeholder: { kind: 'string', value: 'Enter text' },
      },
    },
    {
      name: 'TweakerText',
      props: {
        field: { kind: 'string', value: 'multilineText' },
        label: { kind: 'string', value: 'Text' },
        defaultValue: {
          jsonValue: builtInItemDefaults.multilineText,
          kind: 'expression',
          value: 'builtInItemDefaults.multilineText',
        },
        multiline: editableBoolean('multiline', 'Multiline text'),
        placeholder: { kind: 'string', value: 'Enter longer text' },
      },
    },
    {
      name: 'TweakerNumber',
      props: {
        field: { kind: 'string', value: 'number' },
        label: { kind: 'string', value: 'Number' },
        defaultValue: {
          jsonValue: builtInItemDefaults.number,
          kind: 'expression',
          value: 'builtInItemDefaults.number',
        },
        min: editableNumber('numberMin', 'Number minimum'),
        max: editableNumber('numberMax', 'Number maximum'),
        step: editableNumber('numberStep', 'Number step', 0.01, 100),
      },
    },
    {
      name: 'TweakerSwitch',
      props: {
        field: { kind: 'string', value: 'switch' },
        label: { kind: 'string', value: 'Switch' },
        defaultValue: {
          jsonValue: builtInItemDefaults.switch,
          kind: 'expression',
          value: 'builtInItemDefaults.switch',
        },
      },
    },
    {
      name: 'TweakerSelect',
      props: {
        field: { kind: 'string', value: 'select' },
        label: { kind: 'string', value: 'Select' },
        defaultValue: {
          jsonValue: builtInItemDefaults.select,
          kind: 'expression',
          value: 'builtInItemDefaults.select',
        },
        options: { jsonValue: densityOptions, kind: 'expression', value: 'densityOptions' },
      },
    },
    {
      name: 'TweakerSlider',
      props: {
        field: { kind: 'string', value: 'slider' },
        label: { kind: 'string', value: 'Slider' },
        defaultValue: {
          jsonValue: builtInItemDefaults.slider,
          kind: 'expression',
          value: 'builtInItemDefaults.slider',
        },
        min: editableNumber('sliderMin', 'Slider minimum'),
        max: editableNumber('sliderMax', 'Slider maximum'),
        step: editableNumber('sliderStep', 'Slider step', 0.01, 100),
      },
    },
    {
      name: 'TweakerSlider',
      props: {
        field: { kind: 'string', value: 'sliderMarks' },
        label: { kind: 'string', value: 'Slider' },
        defaultValue: {
          jsonValue: builtInItemDefaults.sliderMarks,
          kind: 'expression',
          value: 'builtInItemDefaults.sliderMarks',
        },
        min: editableNumber('sliderMarksMin', 'Marked slider minimum', -10, 10),
        max: editableNumber('sliderMarksMax', 'Marked slider maximum', -10, 10),
        step: editableNumber('sliderMarksStep', 'Marked slider step', 0.001, 1),
        marks: { jsonValue: sliderMarks, kind: 'expression', value: 'sliderMarks' },
        formatOptions: {
          jsonValue: percentFormatOptions,
          kind: 'expression',
          value: 'percentFormatOptions',
        },
      },
    },
    {
      name: 'TweakerRange',
      props: {
        field: { kind: 'string', value: 'range' },
        label: { kind: 'string', value: 'Range' },
        defaultValue: {
          jsonValue: builtInItemDefaults.range,
          kind: 'expression',
          value: 'builtInItemDefaults.range',
        },
        min: editableNumber('rangeMin', 'Range minimum'),
        max: editableNumber('rangeMax', 'Range maximum'),
        step: editableNumber('rangeStep', 'Range step', 0.01, 100),
      },
    },
    {
      name: 'TweakerSegmented',
      props: {
        field: { kind: 'string', value: 'segmented' },
        label: { kind: 'string', value: 'Segmented' },
        defaultValue: {
          jsonValue: builtInItemDefaults.segmented,
          kind: 'expression',
          value: 'builtInItemDefaults.segmented',
        },
        options: {
          jsonValue: segmentedOptions,
          kind: 'expression',
          value: 'segmentedOptions',
        },
      },
    },
    {
      name: 'TweakerVector3',
      props: {
        field: { kind: 'string', value: 'vector3' },
        label: { kind: 'string', value: 'Vector3' },
        defaultValue: {
          jsonValue: builtInItemDefaults.vector3,
          kind: 'expression',
          value: 'builtInItemDefaults.vector3',
        },
        min: editableNumber('vectorMin', 'Vector3 minimum'),
        max: editableNumber('vectorMax', 'Vector3 maximum'),
        step: editableNumber('vectorStep', 'Vector3 step', 0.01, 100),
      },
    },
    {
      name: 'TweakerMatrix2D',
      props: {
        field: { kind: 'string', value: 'alignment' },
        label: { kind: 'string', value: 'Matrix2D' },
        defaultValue: {
          jsonValue: builtInItemDefaults.alignment,
          kind: 'expression',
          value: 'builtInItemDefaults.alignment',
        },
        containerProps: {
          jsonValue: alignmentContainerProps,
          kind: 'expression',
          value: 'alignmentContainerProps',
        },
        options: {
          jsonValue: alignmentOptions.map((row) =>
            row.map(({ ['aria-label']: ariaLabel, title, value }) => ({
              'aria-label': ariaLabel,
              title,
              value,
            })),
          ),
          kind: 'expression',
          value: 'alignmentOptions',
        },
        selectionRole: {
          ariaLabel: 'Matrix2D selection role',
          kind: 'string',
          onChange: updateString
            ? (value) => updateString('matrixSelectionRole', value)
            : undefined,
          value: config.matrixSelectionRole,
          values: ['radio', 'toggle'],
        },
        validationMessage: {
          kind: 'string',
          value: 'Alignment must be one of the nine supported positions.',
        },
      },
    },
  ]

  return lines.map((line) => withItemExampleProps(line, config, updateItemProp))
}

function remainingGroupsForConfig(
  config: BuiltInItemsExampleConfig,
  updateBoolean?: (key: BooleanConfigKey, value: boolean) => void,
  updateItemProp?: UpdateItemProp,
  updateNumber?: (key: NumberConfigKey, value: number) => void,
  updateString?: (key: StringConfigKey, value: string) => void,
): {
  id: string
  label: string
  lines: CommonInputLine[]
}[] {
  const editableBoolean = (key: BooleanConfigKey, ariaLabel: string): StaticPropValue => ({
    ariaLabel,
    kind: 'boolean',
    onChange: updateBoolean ? (value) => updateBoolean(key, value) : undefined,
    value: config[key],
  })
  const editableNumber = (
    key: NumberConfigKey,
    ariaLabel: string,
    min: number,
    max: number,
  ): StaticPropValue => ({
    ariaLabel,
    kind: 'number',
    max,
    min,
    onChange: updateNumber ? (value) => updateNumber(key, value) : undefined,
    value: config[key],
  })

  const groups: {
    id: string
    label: string
    lines: CommonInputLine[]
  }[] = [
    {
      id: 'spatial-items',
      label: 'Direct manipulation',
      lines: [
        {
          name: 'TweakerXYPad',
          props: {
            field: { kind: 'string', value: 'xyPad' },
            label: { kind: 'string', value: 'XYPad' },
            defaultValue: {
              jsonValue: builtInItemDefaults.xyPad,
              kind: 'expression',
              value: 'builtInItemDefaults.xyPad',
            },
            step: editableNumber('xyPadStep', 'XYPad step', 0.001, 1),
            xMin: editableNumber('xyPadXMin', 'XYPad X minimum', -100, 100),
            xMax: editableNumber('xyPadXMax', 'XYPad X maximum', -100, 100),
            yMin: editableNumber('xyPadYMin', 'XYPad Y minimum', -100, 100),
            yMax: editableNumber('xyPadYMax', 'XYPad Y maximum', -100, 100),
          },
        },
        {
          name: 'TweakerGradient',
          props: {
            field: { kind: 'string', value: 'gradient' },
            label: { kind: 'string', value: 'Gradient' },
            defaultValue: {
              jsonValue: builtInItemDefaults.gradient,
              kind: 'expression',
              value: 'builtInItemDefaults.gradient',
            },
            defaultRotation: {
              jsonValue: builtInItemDefaults.gradientRotation,
              kind: 'expression',
              value: 'builtInItemDefaults.gradientRotation',
            },
            rotationField: { kind: 'string', value: 'gradientRotation' },
          },
        },
      ],
    },
    {
      id: 'media-items',
      label: 'Media and files',
      lines: [
        {
          controlId: 'previewAsset',
          name: 'TweakerMediaPreview',
          props: {
            field: { kind: 'string', value: 'previewAsset' },
            label: { kind: 'string', value: 'MediaPreview' },
            alt: { kind: 'string', value: 'Tweaker mark' },
            src: { kind: 'string', value: '/favicon.svg' },
          },
        },
        {
          controlId: 'droppedFiles',
          name: 'TweakerDropzone',
          props: {
            field: { kind: 'string', value: 'droppedFiles' },
            label: { kind: 'string', value: 'Dropzone' },
            accept: {
              jsonValue: { 'image/*': ['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp'] },
              kind: 'expression',
              value: 'imageAccept',
            },
            maxFiles: editableNumber('dropzoneMaxFiles', 'Dropzone maximum files', 1, 20),
            maxSize: editableNumber(
              'dropzoneMaxSize',
              'Dropzone maximum file size',
              1,
              100_000_000,
            ),
            showPreviews: editableBoolean('dropzoneShowPreviews', 'Dropzone show previews'),
          },
        },
      ],
    },
    {
      id: 'chart-items',
      label: 'Charts',
      lines: [
        {
          controlId: 'sparkline',
          name: 'TweakerSparkline',
          props: {
            id: { kind: 'string', value: 'sparkline' },
            label: { kind: 'string', value: 'Sparkline' },
            data: { kind: 'expression', value: 'mouseVelocityStream' },
            series: {
              jsonValue: [
                {
                  dataKey: 'x',
                  label: 'X velocity',
                  stroke: 'var(--tweaker-color-accent)',
                },
                {
                  dataKey: 'y',
                  label: 'Y velocity',
                  stroke: 'var(--tweaker-color-warning)',
                },
              ],
              kind: 'expression',
              value: 'velocitySeries',
            },
            autoscale: editableBoolean('sparklineAutoscale', 'Sparkline automatic scale'),
            continuous: editableBoolean('sparklineContinuous', 'Sparkline continuous streaming'),
            maxPoints: editableNumber('sparklineMaxPoints', 'Sparkline maximum points', 2, 240),
            showBaseline: editableBoolean('sparklineShowBaseline', 'Sparkline show baseline'),
            ...(config.sparklineAutoscale
              ? {}
              : {
                  minValue: editableNumber(
                    'sparklineMinValue',
                    'Sparkline minimum value',
                    -10_000,
                    10_000,
                  ),
                  maxValue: editableNumber(
                    'sparklineMaxValue',
                    'Sparkline maximum value',
                    -10_000,
                    10_000,
                  ),
                }),
          },
        },
        {
          controlId: 'shadcn-frame-chart',
          name: 'TweakerChart',
          props: chartPropsForConfig(config, updateBoolean, updateString),
        },
      ],
    },
    {
      id: 'visualization-items',
      label: 'Display variants',
      lines: [
        {
          controlId: 'displayFallback',
          name: 'TweakerDisplay',
          props: {
            id: { kind: 'string', value: 'displayFallback' },
            label: { kind: 'string', value: 'Display' },
            fallback: { kind: 'string', value: 'Waiting' },
          },
        },
        {
          controlId: 'display',
          name: 'TweakerDisplay',
          props: {
            id: { kind: 'string', value: 'display' },
            label: { kind: 'string', value: 'Display' },
            value: {
              jsonValue: builtInItemDefaults.display,
              kind: 'expression',
              value: 'builtInItemDefaults.display',
            },
          },
        },
      ],
    },
  ]

  return groups.map((group) => ({
    ...group,
    lines: group.lines.map((line) => withItemExampleProps(line, config, updateItemProp)),
  }))
}

function withItemExampleProps(
  line: CommonInputLine,
  config: BuiltInItemsExampleConfig,
  updateItemProp?: UpdateItemProp,
): CommonInputLine {
  const id = controlIdForLine(line) as BuiltInItemId
  const item = config.itemProps[id]
  const editableBoolean = (
    key: 'disabled' | 'readOnly' | 'reorderable' | 'visible',
    ariaLabel: string,
  ): StaticPropValue =>
    hiddenProp({
      ariaLabel,
      kind: 'boolean',
      onChange: updateItemProp ? (value) => updateItemProp(id, key, value) : undefined,
      value: item[key],
    })
  const presentationProps: Record<string, StaticPropValue> = {
    contentLayout: hiddenProp({
      ariaLabel: `Content layout for ${id}`,
      kind: 'string',
      onChange: updateItemProp
        ? (value) => updateItemProp(id, 'contentLayout', value as BuiltInContentLayout)
        : undefined,
      value: item.contentLayout,
      values: ['inline', 'block', 'full'],
    }),
    disabled: editableBoolean('disabled', `Disabled for ${id}`),
    reorderable: editableBoolean('reorderable', `Reorderable for ${id}`),
    visible: editableBoolean('visible', `Visible for ${id}`),
  }
  if (line.props.field !== undefined) {
    presentationProps.readOnly = editableBoolean('readOnly', `Read only for ${id}`)
  }

  return {
    ...line,
    props: {
      ...line.props,
      ...presentationProps,
      description: {
        ariaLabel: `Description for ${id}`,
        kind: 'string',
        onChange: updateItemProp ? (value) => updateItemProp(id, 'description', value) : undefined,
        value: item.description,
      },
    },
  }
}

function chartPropsForConfig(
  config: BuiltInItemsExampleConfig,
  updateBoolean?: (key: BooleanConfigKey, value: boolean) => void,
  updateString?: (key: StringConfigKey, value: string) => void,
): Record<string, StaticPropValue> {
  const shared: Record<string, StaticPropValue> = {
    id: { kind: 'string', value: 'shadcn-frame-chart' },
    label: { kind: 'string', value: 'Chart' },
    type: {
      ariaLabel: 'Chart type',
      kind: 'string',
      onChange: updateString ? (value) => updateString('chartType', value) : undefined,
      value: config.chartType,
      values: shadcnChartTypes,
    },
    data: {
      jsonValue: [
        { frame: '01', gpu: 8.9, target: 16.7 },
        { frame: '02', gpu: 11.4, target: 16.7 },
      ],
      kind: 'expression',
      value: 'frameData',
    },
    accessibilityLayer: hiddenProp({
      ariaLabel: 'Chart accessibility layer',
      kind: 'boolean',
      onChange: updateBoolean
        ? (value) => updateBoolean('chartAccessibilityLayer', value)
        : undefined,
      value: config.chartAccessibilityLayer,
    }),
    tooltipProps: {
      jsonValue: { cursor: false },
      kind: 'expression',
      value: 'tooltipProps',
    },
  }
  const cartesianProps: Record<string, StaticPropValue> = {
    cartesianGridProps: {
      jsonValue: { strokeDasharray: '2 4', vertical: false },
      kind: 'expression',
      value: 'gridProps',
    },
    xAxisProps: {
      jsonValue: { axisLine: false, dataKey: 'frame', tickLine: false, tickMargin: 8 },
      kind: 'expression',
      value: 'xAxisProps',
    },
    yAxisProps: {
      jsonValue: {
        allowDecimals: false,
        axisLine: false,
        domain: [0, 20],
        tickLine: false,
        ticks: [0, 5, 10, 15, 20],
      },
      kind: 'expression',
      value: 'yAxisProps',
    },
  }

  if (config.chartType === 'pie') {
    return {
      ...shared,
      pieProps: {
        jsonValue: {
          dataKey: 'gpu',
          innerRadius: 28,
          nameKey: 'frame',
          outerRadius: 55,
          paddingAngle: 2,
        },
        kind: 'expression',
        value: 'pieProps',
      },
      pieChartProps: {
        jsonValue: { margin: { bottom: 4, top: 4 } },
        kind: 'expression',
        value: 'pieChartProps',
      },
    }
  }

  if (config.chartType === 'radar' || config.chartType === 'radial') {
    const isRadar = config.chartType === 'radar'
    return {
      ...shared,
      series: {
        jsonValue: [{ dataKey: 'gpu', fillOpacity: isRadar ? 0.28 : undefined }],
        kind: 'expression',
        value: isRadar ? 'radarSeries' : 'radialSeries',
      },
      polarGridProps: {
        jsonValue: { gridType: isRadar ? 'polygon' : 'circle' },
        kind: 'expression',
        value: 'polarGridProps',
      },
      polarAngleAxisProps: {
        jsonValue: isRadar ? { dataKey: 'frame' } : { domain: [0, 20], type: 'number' },
        kind: 'expression',
        value: 'polarAngleAxisProps',
      },
      ...(isRadar
        ? {
            polarRadiusAxisProps: {
              jsonValue: { domain: [0, 20], tick: false },
              kind: 'expression' as const,
              value: 'polarRadiusAxisProps',
            },
            radarChartProps: {
              jsonValue: { margin: { bottom: 4, left: 12, right: 12, top: 4 } },
              kind: 'expression' as const,
              value: 'radarChartProps',
            },
          }
        : {
            radialBarChartProps: {
              jsonValue: {
                endAngle: 0,
                innerRadius: '24%',
                outerRadius: '92%',
                startAngle: 180,
              },
              kind: 'expression' as const,
              value: 'radialBarChartProps',
            },
          }),
    }
  }

  const seriesName =
    config.chartType === 'area'
      ? 'areaSeries'
      : config.chartType === 'bar'
        ? 'barSeries'
        : 'frameSeries'
  const chartPropsName = `${config.chartType}ChartProps`
  return {
    ...shared,
    series: {
      jsonValue:
        config.chartType === 'bar'
          ? [{ dataKey: 'gpu', fill: 'var(--chart-1)' }]
          : [{ dataKey: 'gpu', stroke: 'var(--chart-1)', type: 'monotone' }],
      kind: 'expression',
      value: seriesName,
    },
    ...cartesianProps,
    [chartPropsName]: {
      jsonValue: { margin: { left: 12, right: 8, top: 8 } },
      kind: 'expression',
      value: chartPropsName,
    },
  }
}

type NumberConfigKey = {
  [Key in keyof BuiltInItemsExampleConfig]: BuiltInItemsExampleConfig[Key] extends number
    ? Key
    : never
}[keyof BuiltInItemsExampleConfig]

type StringConfigKey = {
  [Key in keyof BuiltInItemsExampleConfig]: BuiltInItemsExampleConfig[Key] extends string
    ? Key
    : never
}[keyof BuiltInItemsExampleConfig]

type BooleanConfigKey = {
  [Key in keyof BuiltInItemsExampleConfig]: BuiltInItemsExampleConfig[Key] extends boolean
    ? Key
    : never
}[keyof BuiltInItemsExampleConfig]

export function InteractiveJsxExample({
  config,
  onConfigChange,
  onProviderThemeChange,
  providerTheme,
}: InteractiveJsxExampleProps) {
  const [activeTab, setActiveTab] = useState('code')
  const [copied, setCopied] = useState(false)
  const [showAllProps, setShowAllProps] = useState(false)
  const panelState = useTweakerPanelStoreSelector(builtInItemsPanelStore, (state) => state)
  const panelStoreSnapshot = useMemo(() => snapshotForDisplay(panelState), [panelState])
  const codeViewportRef = useRef<HTMLPreElement>(null)
  const declarationRefs = useRef(new Map<string, HTMLElement>())
  const focusedField = panelState.interaction.focusedId

  useEffect(() => {
    if (activeTab !== 'code' || !focusedField) return

    const viewport = codeViewportRef.current
    const declaration = declarationRefs.current.get(focusedField)
    if (!viewport || !declaration) return

    const viewportBounds = viewport.getBoundingClientRect()
    const declarationBounds = declaration.getBoundingClientRect()
    const isVisible =
      declarationBounds.top >= viewportBounds.top &&
      declarationBounds.bottom <= viewportBounds.bottom
    if (isVisible) return

    const centeredTop =
      viewport.scrollTop +
      declarationBounds.top -
      viewportBounds.top -
      (viewport.clientHeight - declarationBounds.height) / 2

    viewport.scrollTo({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      top: Math.max(0, centeredTop),
    })
  }, [activeTab, focusedField])

  const updateConfig = <Key extends keyof BuiltInItemsExampleConfig>(
    key: Key,
    value: BuiltInItemsExampleConfig[Key],
  ) => {
    onConfigChange({ ...config, [key]: value })
  }

  const updateNumberConfig = (key: NumberConfigKey, value: number) => {
    const pairedKey = pairedNumberBounds[key]
    if (!pairedKey) {
      updateConfig(key, value)
      return
    }

    const nextConfig = { ...config, [key]: value }
    const editingMinimum = key.includes('Min')
    if (editingMinimum && value > config[pairedKey]) nextConfig[pairedKey] = value
    if (!editingMinimum && value < config[pairedKey]) nextConfig[pairedKey] = value
    onConfigChange(nextConfig)
  }

  const updateStringConfig = (key: StringConfigKey, value: string) => {
    onConfigChange({ ...config, [key]: value } as BuiltInItemsExampleConfig)
  }

  const updateItemProp: UpdateItemProp = (id, key, value) => {
    onConfigChange({
      ...config,
      itemProps: {
        ...config.itemProps,
        [id]: { ...config.itemProps[id], [key]: value },
      },
    })
  }

  const updateGroupProp: UpdateGroupProp = (id, key, value) => {
    onConfigChange({
      ...config,
      groupProps: {
        ...config.groupProps,
        [id]: { ...config.groupProps[id], [key]: value },
      },
    })
  }

  const commonInputLines = commonInputLinesForConfig(
    config,
    updateConfig,
    updateItemProp,
    updateNumberConfig,
    updateStringConfig,
  )
  const remainingGroups = remainingGroupsForConfig(
    config,
    updateConfig,
    updateItemProp,
    updateNumberConfig,
    updateStringConfig,
  )

  const copySource = async () => {
    await navigator.clipboard.writeText(sourceForExample(providerTheme, config, showAllProps))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <section
      className="relative min-h-svh overflow-x-hidden px-4 py-5 sm:px-6 lg:py-8 lg:pr-[calc(var(--demo-panel-width)+3rem)] lg:pl-8 min-[141rem]:px-8"
      data-interactive-jsx-example
      style={{ '--demo-panel-width': `${config.panelWidth}px` } as CSSProperties}
    >
      <div className="grid max-w-6xl min-w-0 gap-5 min-[141rem]:mx-auto">
        <Tabs
          className="min-w-0 gap-0 overflow-hidden border border-white/12 bg-zinc-950/78 shadow-2xl shadow-black/35 backdrop-blur-xl"
          data-interactive-tabs
          value={activeTab}
          onValueChange={setActiveTab}
        >
          <div className="flex items-center justify-between border-b border-white/10 bg-white/4 px-4 py-2.5">
            <TabsList
              aria-label="Interactive example views"
              className="h-7 gap-4 rounded-none p-0"
              variant="line"
            >
              <TabsTrigger
                className="h-7 flex-none rounded-none px-0 font-mono text-xs text-zinc-400 data-active:text-cyan-200"
                value="code"
              >
                <span className="size-2 bg-cyan-300" />
                Code
              </TabsTrigger>
              <TabsTrigger
                className="h-7 flex-none rounded-none px-0 font-mono text-xs text-zinc-400 data-active:text-violet-200"
                value="store"
              >
                <span className="size-2 bg-violet-300" />
                Store
              </TabsTrigger>
            </TabsList>
            {activeTab === 'code' ? (
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-1.5 font-mono text-[11px] text-zinc-400 transition-colors hover:text-zinc-200">
                  <input
                    checked={showAllProps}
                    className="size-3 accent-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none"
                    type="checkbox"
                    onChange={(event) => setShowAllProps(event.target.checked)}
                  />
                  Show all props
                </label>
                <button
                  className="flex h-7 items-center gap-1.5 border border-white/12 bg-white/5 px-2 font-mono text-[11px] text-zinc-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none"
                  type="button"
                  onClick={copySource}
                >
                  {copied ? (
                    <Check aria-hidden="true" className="size-3 text-cyan-300" />
                  ) : (
                    <Copy aria-hidden="true" className="size-3" />
                  )}
                  <span aria-live="polite">{copied ? 'Copied' : 'Copy JSX'}</span>
                </button>
              </div>
            ) : (
              <span className="flex items-center gap-2 font-mono text-[11px] text-zinc-400">
                <span className="size-1.5 animate-pulse bg-emerald-300 motion-reduce:animate-none" />
                Live panel state
              </span>
            )}
          </div>

          <TabsContent className="min-h-0" value="code">
            <pre
              ref={codeViewportRef}
              aria-label="Interactive JSX example"
              className="max-h-[calc(100svh-15rem)] min-w-0 overflow-auto p-4 font-mono text-[13px] leading-7 text-zinc-300 sm:p-5 sm:text-sm"
            >
              <code className="block min-w-max">
                <CodeLine>
                  <Punctuation>&lt;</Punctuation>
                  <Tag>TweakerProvider</Tag>
                </CodeLine>
                <CodeLine indent={1}>
                  <Prop>persistLayout</Prop>
                </CodeLine>
                <CodeLine indent={1}>
                  <Prop>storageKey</Prop>
                  <Punctuation>=&quot;</Punctuation>
                  <StringValue>tweaker-demo:panel-layout:v1</StringValue>
                  <Punctuation>&quot;</Punctuation>
                </CodeLine>
                <CodeLine indent={1}>
                  <Prop>theme</Prop>
                  <Punctuation>=&quot;</Punctuation>
                  <InlineSelect
                    ariaLabel="Provider theme"
                    value={providerTheme}
                    values={['dark', 'light', 'ocean', 'plum']}
                    onChange={onProviderThemeChange}
                  />
                  <Punctuation>&quot;</Punctuation>
                </CodeLine>
                <CodeLine>
                  <Punctuation>&gt;</Punctuation>
                </CodeLine>

                <CodeLine indent={1}>
                  <Punctuation>&lt;</Punctuation>
                  <Tag>TweakerPanel</Tag>
                </CodeLine>
                <CodeLine indent={2}>
                  <Prop>store</Prop>
                  <Punctuation>=&#123;</Punctuation>
                  <Expression
                    actionLabel="Open live panel store"
                    onActivate={() => setActiveTab('store')}
                  >
                    builtInItemsPanelStore
                  </Expression>
                  <Punctuation>&#125;</Punctuation>
                </CodeLine>
                <CodeLine indent={2}>
                  <Prop>title</Prop>
                  <Punctuation>=&quot;</Punctuation>
                  <InlineText
                    ariaLabel="Panel title"
                    className="w-34 sm:w-40"
                    value={config.panelTitle}
                    onChange={(value) => updateConfig('panelTitle', value)}
                  />
                  <Punctuation>&quot;</Punctuation>
                </CodeLine>
                <CodeLine indent={2}>
                  <Prop>collapsible</Prop>
                  <Punctuation>=&#123;</Punctuation>
                  <InlineBoolean
                    ariaLabel="Panel collapsible"
                    value={config.panelCollapsible}
                    onChange={(value) => updateConfig('panelCollapsible', value)}
                  />
                  <Punctuation>&#125;</Punctuation>
                </CodeLine>
                <CodeLine indent={2}>
                  <Prop>width</Prop>
                  <Punctuation>=&#123;</Punctuation>
                  <InlineNumber
                    ariaLabel="Panel width"
                    max={520}
                    min={280}
                    value={config.panelWidth}
                    onChange={(value) => updateConfig('panelWidth', value)}
                  />
                  <Punctuation>&#125;</Punctuation>
                </CodeLine>
                {showAllProps ? (
                  <>
                    <CodeLine indent={2} muted>
                      <Prop>defaultPlacement</Prop>
                      <Punctuation>=&quot;</Punctuation>
                      <StringValue>top-right</StringValue>
                      <Punctuation>&quot;</Punctuation>
                    </CodeLine>
                    <CodeLine indent={2} muted>
                      <Prop>className</Prop>
                      <Punctuation>=&quot;</Punctuation>
                      <StringValue>
                        bg-tweaker-surface/72 top-4 right-4 max-w-[calc(100dvw-2rem)]
                        backdrop-blur-xl lg:top-8 lg:right-8
                      </StringValue>
                      <Punctuation>&quot;</Punctuation>
                    </CodeLine>
                  </>
                ) : null}
                <CodeLine indent={1}>
                  <Punctuation>&gt;</Punctuation>
                </CodeLine>

                <CodeLine indent={2}>
                  <Punctuation>&lt;</Punctuation>
                  <Tag>TweakerGroup</Tag> <Prop>id</Prop>
                  <Punctuation>=&quot;</Punctuation>
                  <StringValue>common-items</StringValue>
                  <Punctuation>&quot;</Punctuation>
                </CodeLine>
                <CodeLine indent={3}>
                  <Prop>label</Prop>
                  <Punctuation>=&quot;</Punctuation>
                  <InlineText
                    ariaLabel="Common inputs group label"
                    className="w-30 sm:w-36"
                    value={config.commonGroupLabel}
                    onChange={(value) => updateConfig('commonGroupLabel', value)}
                  />
                  <Punctuation>&quot;</Punctuation>
                </CodeLine>
                <CodeLine indent={3}>
                  <Prop>reorderable</Prop>
                  <Punctuation>=&#123;</Punctuation>
                  <InlineBoolean
                    ariaLabel="Common inputs group reorderable"
                    value={config.commonGroupReorderable}
                    onChange={(value) => updateConfig('commonGroupReorderable', value)}
                  />
                  <Punctuation>&#125;</Punctuation>
                </CodeLine>
                <HiddenGroupProps
                  config={config.groupProps['common-items']}
                  groupId="common-items"
                  visible={showAllProps}
                  onChange={updateGroupProp}
                />
                <CodeLine indent={2}>
                  <Punctuation>&gt;</Punctuation>
                </CodeLine>

                {commonInputLines.map((line) => {
                  const field = controlIdForLine(line)
                  return (
                    <StaticControlLine
                      key={`${line.name}:${field}`}
                      focused={panelState.interaction.focusedId === field}
                      hovered={panelState.interaction.hoveredId === field}
                      elementRef={(element) => {
                        if (element) declarationRefs.current.set(field, element)
                        else declarationRefs.current.delete(field)
                      }}
                      showAllProps={showAllProps}
                      {...line}
                    />
                  )
                })}

                <CodeLine indent={2}>
                  <Punctuation>&lt;/</Punctuation>
                  <Tag>TweakerGroup</Tag>
                  <Punctuation>&gt;</Punctuation>
                </CodeLine>

                {remainingGroups.map((group) => (
                  <span key={group.id} className="block">
                    <CodeLine indent={2}>
                      <Punctuation>&lt;</Punctuation>
                      <Tag>TweakerGroup</Tag>
                    </CodeLine>
                    <CodeLine indent={3}>
                      <Prop>id</Prop>
                      <Punctuation>=&quot;</Punctuation>
                      <StringValue>{group.id}</StringValue>
                      <Punctuation>&quot;</Punctuation>
                    </CodeLine>
                    <CodeLine indent={3}>
                      <Prop>label</Prop>
                      <Punctuation>=&quot;</Punctuation>
                      <StringValue>{group.label}</StringValue>
                      <Punctuation>&quot;</Punctuation>
                    </CodeLine>
                    <HiddenGroupProps
                      config={config.groupProps[group.id as BuiltInGroupId]}
                      groupId={group.id as BuiltInGroupId}
                      visible={showAllProps}
                      onChange={updateGroupProp}
                    />
                    <CodeLine indent={2}>
                      <Punctuation>&gt;</Punctuation>
                    </CodeLine>
                    {group.lines.map((line) => {
                      const field = controlIdForLine(line)
                      return (
                        <StaticControlLine
                          key={`${line.name}:${field}`}
                          focused={panelState.interaction.focusedId === field}
                          hovered={panelState.interaction.hoveredId === field}
                          elementRef={(element) => {
                            if (element) declarationRefs.current.set(field, element)
                            else declarationRefs.current.delete(field)
                          }}
                          showAllProps={showAllProps}
                          {...line}
                        />
                      )
                    })}
                    <CodeLine indent={2}>
                      <Punctuation>&lt;/</Punctuation>
                      <Tag>TweakerGroup</Tag>
                      <Punctuation>&gt;</Punctuation>
                    </CodeLine>
                  </span>
                ))}
                <CodeLine indent={1}>
                  <Punctuation>&lt;/</Punctuation>
                  <Tag>TweakerPanel</Tag>
                  <Punctuation>&gt;</Punctuation>
                </CodeLine>
                <CodeLine>
                  <Punctuation>&lt;/</Punctuation>
                  <Tag>TweakerProvider</Tag>
                  <Punctuation>&gt;</Punctuation>
                </CodeLine>
              </code>
            </pre>
          </TabsContent>
          <TabsContent className="min-h-0" value="store">
            <div
              aria-label="Live Built-in Items panel store"
              className="max-h-[calc(100svh-15rem)] min-w-0 overflow-auto p-4 sm:p-5"
              data-live-store-viewer
            >
              <JsonView
                aria-label="Collapsible live panel state"
                clickToExpandNode
                data={panelStoreSnapshot}
                shouldExpandNode={expandStoreNode}
                style={storeJsonStyles}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  )
}

function snapshotForDisplay(state: TweakerPanelState) {
  return {
    panelId: state.panelId,
    values: state.values,
    meta: state.meta,
    order: state.order,
    collapsedGroups: state.collapsedGroups,
    fields: state.fields,
    items: Object.fromEntries(
      Object.entries(state.items).map(([id, item]) => [
        id,
        {
          id: item.id,
          kind: item.kind,
          field: item.field,
          label: item.label,
          parentId: item.parentId,
          pin: item.pin,
          reorderable: item.reorderable,
          hidden: item.hidden,
          collapsible: item.collapsible,
          defaultCollapsed: item.defaultCollapsed,
          valueMode: item.valueMode,
        },
      ]),
    ),
    interaction: state.interaction,
    repairProposal: state.repairProposal,
  }
}

function CodeLine({
  children,
  indent = 0,
  muted = false,
}: {
  children: ReactNode
  indent?: 0 | 1 | 2 | 3 | 4
  muted?: boolean
}) {
  const indentClass = ['', 'pl-4', 'pl-8', 'pl-12', 'pl-16'][indent]
  return <span className={cn('block min-h-7', indentClass, muted && 'opacity-60')}>{children}</span>
}

function HiddenGroupProps({
  config,
  groupId,
  onChange,
  visible,
}: {
  config: BuiltInGroupExampleProps
  groupId: BuiltInGroupId
  onChange: UpdateGroupProp
  visible: boolean
}) {
  if (!visible) return null
  return (
    <>
      <CodeLine indent={3} muted>
        <Prop>collapsible</Prop>
        <Punctuation>=&#123;</Punctuation>
        <InlineBoolean
          ariaLabel={`Collapsible for ${groupId}`}
          value={config.collapsible}
          onChange={(value) => onChange(groupId, 'collapsible', value)}
        />
        <Punctuation>&#125;</Punctuation>
      </CodeLine>
      <CodeLine indent={3} muted>
        <Prop>defaultCollapsed</Prop>
        <Punctuation>=&#123;</Punctuation>
        <InlineBoolean
          ariaLabel={`Default collapsed for ${groupId}`}
          value={config.defaultCollapsed}
          onChange={(value) => onChange(groupId, 'defaultCollapsed', value)}
        />
        <Punctuation>&#125;</Punctuation>
      </CodeLine>
      <CodeLine indent={3} muted>
        <Prop>visible</Prop>
        <Punctuation>=&#123;</Punctuation>
        <InlineBoolean
          ariaLabel={`Visible for ${groupId}`}
          value={config.visible}
          onChange={(value) => onChange(groupId, 'visible', value)}
        />
        <Punctuation>&#125;</Punctuation>
      </CodeLine>
    </>
  )
}

function StaticControlLine({
  controlId,
  elementRef,
  focused,
  hovered,
  name,
  props,
  showAllProps,
}: {
  controlId?: string
  elementRef: (element: HTMLElement | null) => void
  focused: boolean
  hovered: boolean
  name: string
  props: Record<string, StaticPropValue>
  showAllProps: boolean
}) {
  const displayedProps = Object.entries(propsForLine({ controlId, name, props })).filter(
    ([, value]) => showAllProps || !value.hidden,
  )

  return (
    <span
      ref={elementRef}
      className={cn(
        '-mx-2 block border-l-2 border-transparent px-2 transition-[background-color,border-color,box-shadow] duration-150',
        hovered && 'border-cyan-300/45 bg-cyan-300/8',
        focused &&
          'border-cyan-200 bg-cyan-300/12 ring-1 ring-cyan-200/55 ring-inset shadow-[0_0_24px_rgb(34_211_238_/_0.08)]',
      )}
      data-jsx-control={String(controlId ?? props.field?.value ?? props.id?.value ?? name)}
      data-jsx-focused={focused ? 'true' : 'false'}
      data-jsx-hovered={hovered ? 'true' : 'false'}
    >
      <CodeLine indent={3}>
        <Punctuation>&lt;</Punctuation>
        <Tag>{name}</Tag>
      </CodeLine>
      {displayedProps.map(([propName, value]) => (
        <CodeLine key={propName} indent={4} muted={value.hidden}>
          <Prop>{propName}</Prop>
          {value.kind === 'string' ? (
            <>
              <Punctuation>=&quot;</Punctuation>
              {value.onChange && value.ariaLabel ? (
                value.values ? (
                  <InlineSelect
                    ariaLabel={value.ariaLabel}
                    className="w-auto min-w-18 text-amber-200"
                    value={value.value}
                    values={[...value.values]}
                    onChange={value.onChange}
                  />
                ) : (
                  <InlineText
                    ariaLabel={value.ariaLabel}
                    className="w-64 sm:w-96"
                    value={value.value}
                    onChange={value.onChange}
                  />
                )
              ) : (
                <StringValue>{value.value}</StringValue>
              )}
              <Punctuation>&quot;</Punctuation>
            </>
          ) : (
            <>
              <Punctuation>=&#123;</Punctuation>
              {value.kind === 'expression' ? (
                propName === 'help' ? (
                  <HelpExpression component={name}>{value.value}</HelpExpression>
                ) : (
                  <Expression jsonValue={value.jsonValue}>{value.value}</Expression>
                )
              ) : value.kind === 'number' && value.onChange && value.ariaLabel ? (
                <InlineNumber
                  ariaLabel={value.ariaLabel}
                  max={value.max ?? 1000}
                  min={value.min ?? -1000}
                  value={value.value}
                  onChange={value.onChange}
                />
              ) : value.kind === 'boolean' && value.onChange && value.ariaLabel ? (
                <InlineBoolean
                  ariaLabel={value.ariaLabel}
                  value={value.value}
                  onChange={value.onChange}
                />
              ) : (
                <Literal>{String(value.value)}</Literal>
              )}
              <Punctuation>&#125;</Punctuation>
            </>
          )}
        </CodeLine>
      ))}
      <CodeLine indent={3}>
        <Punctuation>/&gt;</Punctuation>
      </CodeLine>
    </span>
  )
}

function propsForLine(line: CommonInputLine) {
  const inheritedProps: Record<string, StaticPropValue> = {
    help: hiddenProp({
      kind: 'expression',
      value: `propTypeHelp('${line.name}')`,
    }),
  }

  const componentProps: Record<string, StaticPropValue> =
    line.name === 'TweakerSparkline'
      ? {
          ariaLabel: hiddenProp({
            kind: 'string',
            value: 'Streaming horizontal and vertical pointer velocity',
          }),
        }
      : {}

  const hiddenProps = Object.fromEntries(
    Object.entries({ ...componentProps, ...inheritedProps }).filter(
      ([name]) => line.props[name] === undefined,
    ),
  )
  const entries = Object.entries({ ...line.props, ...hiddenProps })
  const visibleEntries = entries.filter(([name, value]) => name !== 'description' && !value.hidden)
  const descriptionEntry = entries.find(([name]) => name === 'description')
  const hiddenEntries = entries.filter(([name, value]) => name !== 'description' && value.hidden)

  return Object.fromEntries([
    ...visibleEntries,
    ...(descriptionEntry ? [descriptionEntry] : []),
    ...hiddenEntries,
  ])
}

function hiddenProp(value: StaticPropValue): StaticPropValue {
  return { ...value, hidden: true }
}

function controlIdForLine(line: CommonInputLine) {
  return String(line.controlId ?? line.props.field?.value ?? line.props.id?.value ?? line.name)
}

function InlineText({
  ariaLabel,
  className,
  onChange,
  value,
}: {
  ariaLabel: string
  className?: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <input
      aria-label={ariaLabel}
      className={`${inlineEditorClassName} ${className ?? ''}`}
      data-jsx-prop={ariaLabel}
      spellCheck={false}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

function InlineNumber({
  ariaLabel,
  max,
  min,
  onChange,
  value,
}: {
  ariaLabel: string
  max: number
  min: number
  onChange: (value: number) => void
  value: number
}) {
  const [draft, setDraft] = useState(String(value))
  const cancelBlurRef = useRef(false)
  const focusedRef = useRef(false)

  useEffect(() => {
    if (!focusedRef.current) setDraft(String(value))
  }, [value])

  const commitDraft = () => {
    const nextValue = Number(draft)
    if (!Number.isFinite(nextValue)) {
      setDraft(String(value))
      return
    }
    const clampedValue = Math.min(max, Math.max(min, nextValue))
    setDraft(String(clampedValue))
    onChange(clampedValue)
  }

  return (
    <input
      aria-label={ariaLabel}
      className={`${inlineEditorClassName} w-14 tabular-nums`}
      data-jsx-prop={ariaLabel}
      max={max}
      min={min}
      type="number"
      value={draft}
      onBlur={() => {
        focusedRef.current = false
        if (cancelBlurRef.current) {
          cancelBlurRef.current = false
          setDraft(String(value))
          return
        }
        commitDraft()
      }}
      onFocus={() => {
        focusedRef.current = true
      }}
      onChange={(event) => {
        const nextDraft = event.target.value
        setDraft(nextDraft)
        const nextValue = Number(nextDraft)
        if (
          nextDraft !== '' &&
          Number.isFinite(nextValue) &&
          nextValue >= min &&
          nextValue <= max
        ) {
          onChange(nextValue)
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
          cancelBlurRef.current = true
          setDraft(String(value))
          event.currentTarget.blur()
        }
      }}
    />
  )
}

function InlineBoolean({
  ariaLabel,
  onChange,
  value,
}: {
  ariaLabel: string
  onChange: (value: boolean) => void
  value: boolean
}) {
  return (
    <button
      aria-checked={value}
      aria-label={ariaLabel}
      className={cn(
        inlineEditorClassName,
        'inline-flex w-15 cursor-pointer items-center justify-between gap-1 rounded-sm px-1 text-rose-200',
        value
          ? 'border-rose-300/55 bg-rose-300/15'
          : 'border-zinc-500/50 bg-zinc-400/10 text-zinc-300',
      )}
      data-jsx-prop={ariaLabel}
      data-state={value ? 'checked' : 'unchecked'}
      role="switch"
      type="button"
      onClick={() => onChange(!value)}
    >
      <span
        aria-hidden
        className={cn(
          'size-2 rounded-full transition-[background-color,box-shadow]',
          value ? 'bg-rose-300 shadow-[0_0_6px_rgb(253_164_175/0.6)]' : 'bg-zinc-500',
        )}
      />
      <span>{String(value)}</span>
    </button>
  )
}

function InlineSelect({
  ariaLabel,
  className = 'w-18',
  onChange,
  value,
  values,
}: {
  ariaLabel: string
  className?: string
  onChange: (value: string) => void
  value: string
  values: string[]
}) {
  return (
    <select
      aria-label={ariaLabel}
      className={`${inlineEditorClassName} ${className} appearance-none text-center`}
      data-jsx-prop={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {values.map((option) => (
        <option key={option} className="bg-zinc-950 text-zinc-100" value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}

const inlineEditorClassName =
  'h-6 border border-cyan-300/35 bg-cyan-300/10 px-1 align-middle font-mono text-[12px] leading-none text-cyan-100 outline-none transition-colors hover:border-cyan-200/60 hover:bg-cyan-300/15 focus-visible:border-cyan-200 focus-visible:ring-2 focus-visible:ring-cyan-300/35 sm:text-[13px]'

function Punctuation({ children }: { children: ReactNode }) {
  return <span className="text-zinc-500">{children}</span>
}

function Tag({ children }: { children: ReactNode }) {
  return <span className="text-cyan-300">{children}</span>
}

function Prop({ children }: { children: ReactNode }) {
  return <span className="text-sky-200">{children}</span>
}

function StringValue({ children }: { children: ReactNode }) {
  return <span className="text-amber-200">{children}</span>
}

function Expression({
  actionLabel,
  children,
  jsonValue,
  onActivate,
}: {
  actionLabel?: string
  children: ReactNode
  jsonValue?: unknown
  onActivate?: () => void
}) {
  if (jsonValue === undefined) {
    if (!onActivate) return <span className="text-violet-200">{children}</span>

    return (
      <button
        aria-label={actionLabel}
        className="cursor-pointer text-violet-200 underline decoration-violet-300/35 decoration-dotted underline-offset-4 transition-colors outline-none hover:text-violet-100 hover:decoration-violet-200 focus-visible:ring-2 focus-visible:ring-violet-300/60"
        type="button"
        onClick={onActivate}
      >
        {children}
      </button>
    )
  }

  return (
    <span
      className="group/expression relative inline-block cursor-help text-violet-200 underline decoration-violet-300/35 decoration-dotted underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60"
      data-jsx-variable={typeof children === 'string' ? children : undefined}
      tabIndex={0}
    >
      {children}
      <span className="absolute bottom-full left-1/2 z-30 hidden -translate-x-1/2 pb-2 group-focus-within/expression:block group-hover/expression:block">
        <span
          className="block max-h-72 min-w-64 overflow-auto border border-violet-300/30 bg-zinc-950 p-3 text-left font-mono text-xs leading-5 whitespace-pre text-zinc-200 shadow-2xl shadow-black/50"
          role="tooltip"
        >
          {JSON.stringify(jsonValue, null, 2)}
        </span>
      </span>
    </span>
  )
}

function HelpExpression({ children, component }: { children: ReactNode; component: string }) {
  const propType = builtInPropTypes[component as keyof typeof builtInPropTypes]
  if (!propType) return <Expression>{children}</Expression>
  const highlightedPropType = hljs.highlight(`// ${component}\n${propType}`, {
    language: 'typescript',
  }).value

  return (
    <TooltipPrimitive.Provider delayDuration={180}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <span
            className="inline-block cursor-help text-violet-200 underline decoration-violet-300/35 decoration-dotted underline-offset-4 outline-none hover:text-violet-100 focus-visible:ring-2 focus-visible:ring-violet-300/60"
            data-jsx-help={component}
            tabIndex={0}
          >
            {children}
          </span>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            className="rounded-tweaker-surface border-tweaker-border bg-tweaker-surface-raised text-tweaker-text z-50 max-h-96 w-[42rem] max-w-[calc(100vw-2rem)] overflow-auto border px-(--tweaker-space-3) py-(--tweaker-space-2-5) text-(length:--tweaker-font-size-lg) leading-(--tweaker-line-tight) shadow-[0_10px_15px_-3px_rgb(0_0_0/0.25),0_4px_6px_-4px_rgb(0_0_0/0.25)] outline-none"
            data-jsx-prop-type-tooltip={component}
            data-tweaker-theme="dark"
            sideOffset={8}
          >
            <code
              className="text-tweaker-text block font-mono text-(length:--tweaker-font-size-md) leading-(--tweaker-line-relaxed) whitespace-pre [&_.hljs-attr]:text-sky-200 [&_.hljs-comment]:text-zinc-500 [&_.hljs-keyword]:text-violet-300 [&_.hljs-literal]:text-rose-300 [&_.hljs-number]:text-rose-200 [&_.hljs-string]:text-amber-200 [&_.hljs-title.class_]:text-cyan-200 [&_.hljs-title.function_]:text-cyan-200 [&_.hljs-type]:text-cyan-200"
              dangerouslySetInnerHTML={{ __html: highlightedPropType }}
            />
            <TooltipPrimitive.Arrow className="fill-tweaker-surface-raised" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}

function Literal({ children }: { children: ReactNode }) {
  return <span className="text-rose-200">{children}</span>
}

function sourceForExample(
  providerTheme: string,
  config: BuiltInItemsExampleConfig,
  showAllProps = false,
) {
  const noopBooleanUpdate = () => undefined
  const noopItemUpdate: UpdateItemProp = () => undefined
  const noopNumberUpdate = () => undefined
  const noopStringUpdate = () => undefined
  const serializeControls = (lines: CommonInputLine[]) =>
    lines
      .map((line) => {
        const serializedProps = Object.entries(propsForLine(line))
          .filter(([, value]) => showAllProps || !value.hidden)
          .map(([propName, value]) => {
            if (value.kind === 'string') {
              const serializedValue = JSON.stringify(value.value)
              return value.onChange
                ? `${propName}={${serializedValue}}`
                : `${propName}=${serializedValue}`
            }
            return `${propName}={${String(value.value)}}`
          })
          .map((prop) => `        ${prop}`)
          .join('\n')
        if (!serializedProps) return `      <${line.name} />`
        return `      <${line.name}\n${serializedProps}\n      />`
      })
      .join('\n')

  const commonControls = serializeControls(
    commonInputLinesForConfig(
      config,
      noopBooleanUpdate,
      noopItemUpdate,
      noopNumberUpdate,
      noopStringUpdate,
    ),
  )
  const hiddenGroupSource = (groupId: BuiltInGroupId) => {
    if (!showAllProps) return ''
    const group = config.groupProps[groupId]
    return `
      collapsible={${group.collapsible}}
      defaultCollapsed={${group.defaultCollapsed}}
      visible={${group.visible}}`
  }
  const remainingSource = remainingGroupsForConfig(
    config,
    noopBooleanUpdate,
    noopItemUpdate,
    noopNumberUpdate,
    noopStringUpdate,
  )
    .map(
      (group) => `    <TweakerGroup
      id=${JSON.stringify(group.id)}
      label=${JSON.stringify(group.label)}${hiddenGroupSource(group.id as BuiltInGroupId)}
    >
${serializeControls(group.lines)}
    </TweakerGroup>`,
    )
    .join('\n')

  return `<TweakerProvider
  persistLayout
  storageKey="tweaker-demo:panel-layout:v1"
  theme={${JSON.stringify(providerTheme)}}
>
  <TweakerPanel
    store={builtInItemsPanelStore}
    title={${JSON.stringify(config.panelTitle)}}
    collapsible={${config.panelCollapsible}}
    width={${config.panelWidth}}${
      showAllProps
        ? `
    defaultPlacement="top-right"
    className="bg-tweaker-surface/72 top-4 right-4 max-w-[calc(100dvw-2rem)] backdrop-blur-xl lg:top-8 lg:right-8"`
        : ''
    }
  >
    <TweakerGroup
      id="common-items"
      label={${JSON.stringify(config.commonGroupLabel)}}
      reorderable={${config.commonGroupReorderable}}${hiddenGroupSource('common-items')}
    >
${commonControls}
    </TweakerGroup>
${remainingSource}
  </TweakerPanel>
</TweakerProvider>`
}

const pairedNumberBounds: Partial<Record<NumberConfigKey, NumberConfigKey>> = {
  numberMax: 'numberMin',
  numberMin: 'numberMax',
  rangeMax: 'rangeMin',
  rangeMin: 'rangeMax',
  sliderMarksMax: 'sliderMarksMin',
  sliderMarksMin: 'sliderMarksMax',
  sliderMax: 'sliderMin',
  sliderMin: 'sliderMax',
  sparklineMaxValue: 'sparklineMinValue',
  sparklineMinValue: 'sparklineMaxValue',
  vectorMax: 'vectorMin',
  vectorMin: 'vectorMax',
  xyPadXMax: 'xyPadXMin',
  xyPadXMin: 'xyPadXMax',
  xyPadYMax: 'xyPadYMin',
  xyPadYMin: 'xyPadYMax',
}

const expandStoreNode = (level: number) => level < 2

const storeJsonStyles = {
  ...darkStyles,
  container: `${darkStyles.container} min-w-max bg-transparent! font-mono text-xs leading-5`,
  label: `${darkStyles.label} text-sky-200!`,
  clickableLabel: `${darkStyles.clickableLabel} rounded-sm outline-none hover:bg-white/6 focus-visible:ring-2 focus-visible:ring-violet-300/60`,
  childFieldsContainer: `${darkStyles.childFieldsContainer} ml-1 border-l border-white/8 pl-3`,
  stringValue: `${darkStyles.stringValue} text-amber-200!`,
  numberValue: `${darkStyles.numberValue} text-rose-200!`,
  booleanValue: `${darkStyles.booleanValue} text-violet-200!`,
  nullValue: `${darkStyles.nullValue} text-zinc-500!`,
  punctuation: `${darkStyles.punctuation} text-zinc-500!`,
  expandIcon: `${darkStyles.expandIcon} text-violet-300!`,
  collapseIcon: `${darkStyles.collapseIcon} text-violet-300!`,
  collapsedContent: `${darkStyles.collapsedContent} text-zinc-500!`,
}

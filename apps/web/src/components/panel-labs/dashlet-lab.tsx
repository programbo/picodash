'use client'

import { useMemo, useState } from 'react'
import * as z from 'zod/mini'
import {
  createPicodashPanelStore,
  PicodashDisplay,
  PicodashDropzone,
  PicodashGradient,
  PicodashGroup,
  PicodashItem,
  PicodashMatrix2D,
  PicodashMediaPreview,
  PicodashNumber,
  PicodashPanel,
  PicodashProvider,
  PicodashRange,
  PicodashSegmented,
  PicodashSelect,
  PicodashSlider,
  PicodashSwitch,
  PicodashText,
  PicodashVector3,
  PicodashXYPad,
  usePicodashPanel,
  usePicodashPanelStoreSelector,
} from '@picodash/panel'
import { usePicodashProviderSelector, type PicodashPanelState } from '@picodash/panel/advanced'
import {
  alignmentContainerProps,
  alignmentOptions,
  builtInItemDefaults,
  densityOptions,
  percentFormatOptions,
  segmentedOptions,
  sliderMarks,
} from '@/components/items/built-in/built-in-items-panel'
import {
  ShadcnChartItem,
  shadcnChartTypes,
  type ShadcnChartType,
} from '@/components/items/custom/shadcn-chart'
import { MouseVelocitySparklineItem } from '@/components/items/custom/mouse-velocity-sparkline'
import { StreamingSparklineItem } from '@/components/items/custom/streaming-sparkline'
import { WaveformSpectrumItem } from '@/components/items/custom/waveform-spectrum'

const builtInPanelId = 'dashlet-lab-built-ins'
const examplesPanelId = 'dashlet-lab-examples'
const lifecyclePanelId = 'dashlet-lab-lifecycle'
const compactDensityOptions = densityOptions.slice(0, 2)

function densityOptionsForSwitch(state: PicodashPanelState) {
  return state.values.switch ? densityOptions : compactDensityOptions
}

export const dashletLabBuiltInStore = createPicodashPanelStore({
  initialValues: builtInItemDefaults,
  panelId: builtInPanelId,
})

export const dashletLabExamplesStore = createPicodashPanelStore({
  initialValues: { presetName: 'Studio', signalMode: 'waveform' },
  panelId: examplesPanelId,
})

const presetNameSchema = z
  .string()
  .check(
    z.trim(),
    z.minLength(3, 'Preset name must contain at least 3 characters.'),
    z.maxLength(24, 'Preset name must contain at most 24 characters.'),
  )

export function DashletLab() {
  const [chartType, setChartType] = useState<ShadcnChartType>('line')
  const [sparklineAutoscale, setSparklineAutoscale] = useState(false)
  const [sparklineBaseline, setSparklineBaseline] = useState(true)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [lifecycleMounted, setLifecycleMounted] = useState(false)

  return (
    <main
      className="bg-background text-foreground min-h-svh p-5 sm:p-8"
      data-dashlet-lab
      data-product-route="dashlet-lab"
    >
      <PicodashProvider persistLayout={false} theme={theme}>
        <DashletLabControls
          chartType={chartType}
          lifecycleMounted={lifecycleMounted}
          setChartType={setChartType}
          setLifecycleMounted={setLifecycleMounted}
          setSparklineAutoscale={setSparklineAutoscale}
          setSparklineBaseline={setSparklineBaseline}
          setTheme={setTheme}
          sparklineAutoscale={sparklineAutoscale}
          sparklineBaseline={sparklineBaseline}
          theme={theme}
        />
        <BuiltInDashlets
          chartType={chartType}
          sparklineAutoscale={sparklineAutoscale}
          sparklineBaseline={sparklineBaseline}
        />
        <ExampleDashlets />
        {lifecycleMounted ? <LifecycleDashlet /> : null}
      </PicodashProvider>
    </main>
  )
}

function DashletLabControls({
  chartType,
  lifecycleMounted,
  setChartType,
  setLifecycleMounted,
  setSparklineAutoscale,
  setSparklineBaseline,
  setTheme,
  sparklineAutoscale,
  sparklineBaseline,
  theme,
}: {
  chartType: ShadcnChartType
  lifecycleMounted: boolean
  setChartType: (type: ShadcnChartType) => void
  setLifecycleMounted: (mounted: boolean) => void
  setSparklineAutoscale: (autoscale: boolean) => void
  setSparklineBaseline: (showBaseline: boolean) => void
  setTheme: (theme: 'dark' | 'light') => void
  sparklineAutoscale: boolean
  sparklineBaseline: boolean
  theme: 'dark' | 'light'
}) {
  const builtInState = usePicodashPanelStoreSelector(dashletLabBuiltInStore, (state) => state)
  const exampleState = usePicodashPanelStoreSelector(dashletLabExamplesStore, (state) => state)
  const lifecycleController = usePicodashPanel(lifecyclePanelId)
  const registeredPanels = usePicodashProviderSelector((state) => state.panelOrder)
  const stateReadout = useMemo(
    () =>
      JSON.stringify(
        {
          builtIns: {
            slider: builtInState.values.slider,
            switch: builtInState.values.switch,
            text: builtInState.values.text,
          },
          examples: {
            presetName: exampleState.values.presetName,
            signalMode: exampleState.values.signalMode,
          },
          registeredPanels,
        },
        null,
        2,
      ),
    [
      builtInState.values.slider,
      builtInState.values.switch,
      builtInState.values.text,
      exampleState.values.presetName,
      exampleState.values.signalMode,
      registeredPanels,
    ],
  )

  return (
    <section
      className="relative z-1000 mx-auto grid max-w-3xl gap-4"
      aria-labelledby="dashlet-lab-title"
    >
      <header className="grid gap-2">
        <p className="text-muted-foreground text-sm font-medium tracking-widest uppercase">
          Isolated verification fixture
        </p>
        <h1 id="dashlet-lab-title" className="text-3xl font-semibold">
          Dashlet lab
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Every bundled Dashlet and app-local example in one intentionally stateful surface.
        </p>
      </header>

      <fieldset
        className="border-border grid gap-3 rounded-lg border p-4"
        data-dashlet-lab-controls
      >
        <legend className="px-1 text-sm font-medium">Visual and lifecycle controls</legend>
        <label className="grid gap-1 text-sm">
          Chart variant
          <select
            aria-label="Chart variant"
            className="bg-background border-input h-9 rounded-md border px-2"
            value={chartType}
            onChange={(event) => setChartType(event.target.value as ShadcnChartType)}
          >
            {shadcnChartTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            checked={sparklineAutoscale}
            type="checkbox"
            onChange={(event) => setSparklineAutoscale(event.target.checked)}
          />
          Autoscale sparkline
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            checked={sparklineBaseline}
            type="checkbox"
            onChange={(event) => setSparklineBaseline(event.target.checked)}
          />
          Show sparkline baseline
        </label>
        <button
          className="border-input hover:bg-muted w-fit rounded-md border px-3 py-2 text-sm"
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          Use {theme === 'dark' ? 'light' : 'dark'} theme
        </button>
        <button
          className="border-input hover:bg-muted w-fit rounded-md border px-3 py-2 text-sm"
          type="button"
          onClick={() => setLifecycleMounted(!lifecycleMounted)}
        >
          {lifecycleMounted ? 'Unmount lifecycle panel' : 'Mount lifecycle panel'}
        </button>
        {lifecycleController ? (
          <button
            className="border-input hover:bg-muted w-fit rounded-md border px-3 py-2 text-sm"
            type="button"
            onClick={() => lifecycleController.toggle()}
          >
            Toggle lifecycle panel visibility
          </button>
        ) : null}
      </fieldset>

      <section
        className="border-border rounded-lg border p-4"
        aria-labelledby="dashlet-state-title"
      >
        <h2 id="dashlet-state-title" className="text-sm font-medium">
          State readout
        </h2>
        <pre className="bg-muted/40 mt-2 overflow-auto rounded-md p-3 text-xs" data-dashlet-state>
          {stateReadout}
        </pre>
      </section>
    </section>
  )
}

function BuiltInDashlets({
  chartType,
  sparklineAutoscale,
  sparklineBaseline,
}: {
  chartType: ShadcnChartType
  sparklineAutoscale: boolean
  sparklineBaseline: boolean
}) {
  return (
    <PicodashPanel
      data-dashlet-panel="built-ins"
      defaultPlacement="top-left"
      drag={false}
      style={{ top: '24rem' }}
      store={dashletLabBuiltInStore}
      title="Built-in Dashlets"
      width={420}
    >
      <PicodashGroup id="common-items" label="Common inputs">
        <PicodashText field="text" label="Text" defaultValue={builtInItemDefaults.text} />
        <PicodashText
          field="multilineText"
          label="Text"
          defaultValue={builtInItemDefaults.multilineText}
          multiline
        />
        <PicodashNumber
          field="number"
          label="Number"
          defaultValue={24}
          min={0}
          max={100}
          step={1}
        />
        <PicodashSwitch field="switch" label="Switch" defaultValue />
        <PicodashSelect
          field="select"
          label="Select"
          defaultValue="balanced"
          options={densityOptionsForSwitch}
        />
        <PicodashSlider
          field="slider"
          label="Slider"
          defaultValue={48}
          min={0}
          max={100}
          step={1}
          visible={(state) => state.values.switch !== false}
        />
        <PicodashSlider
          field="sliderMarks"
          label="Slider"
          defaultValue={0.5}
          formatOptions={percentFormatOptions}
          marks={sliderMarks}
          min={0}
          max={1}
          step={0.01}
        />
        <PicodashRange
          field="range"
          label="Range"
          defaultValue={[24, 76]}
          min={0}
          max={100}
          step={1}
        />
        <PicodashSegmented
          field="segmented"
          label="Segmented"
          defaultValue="balanced"
          options={segmentedOptions}
        />
        <PicodashVector3
          field="vector3"
          label="Vector3"
          defaultValue={builtInItemDefaults.vector3}
          min={-10}
          max={10}
          step={0.25}
        />
        <PicodashMatrix2D
          containerProps={alignmentContainerProps}
          defaultValue="center"
          field="alignment"
          label="Matrix2D"
          options={alignmentOptions}
          selectionRole="radio"
          validationMessage="Alignment must be one of the nine supported positions."
        />
      </PicodashGroup>

      <PicodashGroup id="spatial-items" label="Direct manipulation">
        <PicodashXYPad
          defaultValue={builtInItemDefaults.xyPad}
          field="xyPad"
          label="XYPad"
          step={0.01}
          xMax={1}
          xMin={0}
          yMax={1}
          yMin={0}
        />
        <PicodashGradient
          defaultRotation={135}
          defaultValue={builtInItemDefaults.gradient}
          field="gradient"
          label="Gradient"
          rotationField="gradientRotation"
        />
      </PicodashGroup>

      <PicodashGroup id="media-items" label="Media and files">
        <PicodashMediaPreview
          alt="Picodash mark"
          field="previewAsset"
          label="MediaPreview"
          src="/favicon.svg"
        />
        <PicodashDropzone
          accept={{ 'image/*': ['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp'] }}
          field="droppedFiles"
          label="Dropzone"
          maxFiles={3}
          maxSize={5_000_000}
          showPreviews
        />
      </PicodashGroup>

      <PicodashGroup id="chart-items" label="Charts">
        <StreamingSparklineItem
          autoscale={sparklineAutoscale}
          continuous
          maxPoints={56}
          showBaseline={sparklineBaseline}
        />
        <ShadcnChartItem accessibilityLayer type={chartType} />
      </PicodashGroup>

      <PicodashGroup id="visualization-items" label="Display variants">
        <PicodashDisplay fallback="Waiting" id="displayFallback" label="Display" />
        <PicodashDisplay
          id="display"
          label="Display"
          value={(state) =>
            `Slider ${state.values.slider ?? 0} / switch ${state.values.switch ? 'on' : 'off'}`
          }
        />
      </PicodashGroup>
    </PicodashPanel>
  )
}

function ExampleDashlets() {
  return (
    <PicodashPanel
      data-dashlet-panel="examples"
      defaultPlacement="top-right"
      drag={false}
      style={{ top: '24rem' }}
      store={dashletLabExamplesStore}
      title="App example Dashlets"
      width={380}
    >
      <PicodashGroup id="app-examples" label="App-local examples">
        <ValidatedPresetNameItem />
        <MouseVelocitySparklineItem />
        <WaveformSpectrumItem />
      </PicodashGroup>
    </PicodashPanel>
  )
}

function LifecycleDashlet() {
  return (
    <PicodashPanel
      close={{ behavior: 'deregister' }}
      data-dashlet-panel="lifecycle"
      defaultPlacement="bottom-left"
      drag={false}
      id={lifecyclePanelId}
      title="Lifecycle Dashlet"
      width={260}
    >
      <PicodashDisplay id="lifecycle-status" label="Status" value="Registered on mount" />
    </PicodashPanel>
  )
}

function ValidatedPresetNameItem() {
  return (
    <PicodashItem<string>
      contentLayout="block"
      defaultValue="Studio"
      description="A Zod Standard Schema validates an app-local Dashlet."
      field="presetName"
      label="Preset name"
      reorderable={false}
      validate={presetNameSchema}
    >
      {(item) => (
        <input
          aria-describedby={item.fieldState?.errors.length ? item.errorId : undefined}
          aria-invalid={Boolean(item.fieldState?.errors.length)}
          className="border-input bg-picodash-control col-span-full h-8 w-full rounded-md border px-2 text-sm"
          data-validated-preset-name
          disabled={item.disabled}
          id={item.inputId}
          readOnly={item.readOnly}
          value={
            typeof item.fieldState?.draftValue === 'string'
              ? item.fieldState.draftValue
              : (item.value ?? '')
          }
          onChange={(event) => item.setInput(event.target.value)}
        />
      )}
    </PicodashItem>
  )
}

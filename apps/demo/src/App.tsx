import { Activity, Braces, Layers3, ListTree, MousePointer2 } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { z } from 'zod'
import {
  createTweakerPanelStore,
  TweakerDisplay,
  TweakerGroup,
  TweakerItem,
  TweakerNumber,
  TweakerPanel,
  TweakerProvider,
  TweakerSelect,
  TweakerSlider,
  TweakerSwitch,
  useTweakerPanelStoreSelector,
  useTweakerTheme,
  type TweakerGradientValue,
  type TweakerSliderMark,
  type TweakerValue,
} from 'panel'
import {
  gradientCssValue,
  useTweakerSelector,
  type TweakerPanelRegistration,
  type TweakerPanelState,
} from 'panel/advanced'
import {
  BuiltInItemsPanel,
  builtInItemsPanelId,
  builtInItemsPanelStore,
} from '@/built-in-items-panel'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  MouseVelocitySparklineItem,
  viewportPointerTarget,
} from '@/custom-items/mouse-velocity-sparkline'
import { ShadcnChartItem } from '@/custom-items/shadcn-chart'
import { WaveformSpectrumItem } from '@/custom-items/waveform-spectrum'

const scenePanelId = 'scene-controls'
const outputPanelId = 'custom-items'

const sceneDefaults = {
  bloom: true,
  cameraHeight: 48,
  maxBounces: 6,
  motionBlur: false,
  exposure: 1.1,
  opacity: 0.72,
  shadowSoftness: 0.42,
  quality: 'balanced',
  textureQuality: 'high',
  renderScale: 1,
}

const customItemDefaults = {
  presetName: 'Studio',
  signalMode: 'waveform',
}

const scenePanelStore = createTweakerPanelStore({
  initialMeta: {
    canEdit: true,
    opacityMax: 1,
    opacityMin: 0,
    opacityStops: [0, 0.5, 1],
    unit: '%',
  },
  initialValues: sceneDefaults,
  panelId: scenePanelId,
})

export const customItemPanelStore = createTweakerPanelStore({
  initialValues: customItemDefaults,
  panelId: outputPanelId,
})

const presetNameSchema = z
  .string()
  .trim()
  .min(3, 'Preset name must contain at least 3 characters.')
  .max(24, 'Preset name must contain at most 24 characters.')

const opacityHighlightedStates = { highlighted: true }
const opacityDefaultStates = { highlighted: false }
const bloomEnabledStates = { enabled: true }
const bloomDisabledStates = { enabled: false }

type PanelSnapshot = Pick<
  TweakerPanelState,
  'collapsedGroups' | 'fields' | 'interaction' | 'items' | 'meta' | 'order' | 'panelId' | 'values'
>

type PanelSnapshots = Record<string, PanelSnapshot | undefined>

type ProviderSnapshot = {
  panelOrder: string[]
  panels: Record<string, TweakerPanelRegistration>
}

export function App() {
  const [themes, setThemes] = useState<DemoThemes>(readDemoThemes)

  useEffect(() => {
    const handleThemeChange = (event: Event) => {
      const detail = (event as CustomEvent<DemoThemeChange>).detail
      setThemes((current) => ({
        custom: detail.custom === null ? undefined : (detail.custom ?? current.custom),
        provider: detail.provider === null ? undefined : (detail.provider ?? current.provider),
        scene: detail.scene === null ? undefined : (detail.scene ?? current.scene),
      }))
    }

    window.addEventListener('tweaker-demo-theme-change', handleThemeChange)
    return () => window.removeEventListener('tweaker-demo-theme-change', handleThemeChange)
  }, [])

  return (
    <main className="dark bg-background text-foreground relative min-h-svh overflow-hidden">
      <TweakerProvider
        persistLayout
        storageKey="tweaker-demo:panel-layout:v1"
        theme={themes.provider ?? 'dark'}
      >
        <DemoExperience themes={themes} />
      </TweakerProvider>
    </main>
  )
}

type DemoThemes = {
  custom?: string
  provider?: string
  scene?: string
}

type DemoThemeChange = {
  [Key in keyof DemoThemes]?: string | null
}

function readDemoThemes(): DemoThemes {
  const search = new URLSearchParams(window.location.search)
  return {
    custom: search.get('customTheme') ?? undefined,
    provider: search.get('providerTheme') ?? undefined,
    scene: search.get('sceneTheme') ?? undefined,
  }
}

function DemoExperience({ themes }: { themes: DemoThemes }) {
  const showStateLab = window.location.pathname.replace(/\/+$/, '') === '/state-lab'
  const resolvedProviderTheme = useTweakerTheme()
  const panelOrder = useTweakerSelector((state) => state.panelOrder)
  const providerPanels = useTweakerSelector((state) => state.panels)
  const providerState = useMemo<ProviderSnapshot>(
    () => ({ panelOrder, panels: providerPanels }),
    [panelOrder, providerPanels],
  )
  const scenePanelState = useTweakerPanelStoreSelector(scenePanelStore, (state) => state)
  const customItemPanelState = useTweakerPanelStoreSelector(customItemPanelStore, (state) => state)
  const builtInItemsPanelState = useTweakerPanelStoreSelector(
    builtInItemsPanelStore,
    (state) => state,
  )
  const backgroundGradient = builtInItemsPanelState.values.gradient
  const backgroundRotation = builtInItemsPanelState.values.gradientRotation
  const panelSnapshots = useMemo<PanelSnapshots>(
    () => ({
      [builtInItemsPanelId]: panelSnapshotFromState(builtInItemsPanelState),
      [scenePanelId]: panelSnapshotFromState(scenePanelState),
      [outputPanelId]: panelSnapshotFromState(customItemPanelState),
    }),
    [builtInItemsPanelState, customItemPanelState, scenePanelState],
  )
  const panels = [
    panelSnapshots[scenePanelId],
    panelSnapshots[builtInItemsPanelId],
    panelSnapshots[outputPanelId],
  ].filter((panel): panel is PanelSnapshot => panel !== undefined)
  const totals = useMemo(() => panelTotals(panels), [panels])

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        data-demo-background
        style={{
          backgroundImage: gradientCssValue(
            backgroundGradient as TweakerGradientValue,
            typeof backgroundRotation === 'number' ? backgroundRotation : 135,
          ),
        }}
      />
      <span data-demo-provider-theme={resolvedProviderTheme} hidden />
      {showStateLab ? (
        <div className="min-h-svh px-4 py-5 sm:px-6 lg:pr-208">
          <div className="mx-auto grid max-w-7xl gap-5">
            <header className="border-border flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="grid gap-2">
                <Badge variant="outline" className="w-fit gap-1.5">
                  <Activity className="size-3" />
                  Live store inspector
                </Badge>
                <div>
                  <h1 className="font-heading text-foreground text-3xl font-medium tracking-normal">
                    Tweaker State Lab
                  </h1>
                  <div className="prose prose-invert prose-p:my-0 prose-code:bg-muted prose-code:text-foreground text-muted-foreground prose-code:rounded-md prose-code:px-1.5 prose-code:py-0.5 mt-2 max-w-2xl">
                    <p>
                      Inspect the panel store while trying common, spatial, media, and live-data{' '}
                      <code>TweakerItem</code> compositions.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {providerState.panelOrder.map((panelId, index) => (
                  <Badge key={panelId} variant="secondary" className="gap-1.5">
                    <Layers3 className="size-3" />
                    {panelId} - z{index + 1}
                  </Badge>
                ))}
              </div>
            </header>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                icon={Layers3}
                label="Registered panels"
                value={String(Object.keys(providerState.panels).length)}
                detail={providerState.panelOrder.join(' / ') || 'waiting for portal mount'}
              />
              <SummaryCard
                icon={ListTree}
                label="Registered items"
                value={String(totals.items)}
                detail={`${totals.groups} groups, ${totals.controls} controls`}
              />
              <SummaryCard
                icon={Braces}
                label="Tracked fields"
                value={String(totals.fields)}
                detail={`${totals.dirtyFields} dirty, ${totals.touchedFields} touched`}
              />
              <SummaryCard
                icon={MousePointer2}
                label="Interactions"
                value={String(totals.activeInteractions)}
                detail={totals.draggingPanel ? `dragging ${totals.draggingPanel}` : 'idle'}
              />
            </section>

            <Tabs defaultValue="provider" className="grid gap-4">
              <TabsList className="grid w-full grid-cols-4 lg:w-fit">
                <TabsTrigger value="provider">TweakerState</TabsTrigger>
                <TabsTrigger value={scenePanelId}>Scene</TabsTrigger>
                <TabsTrigger value={builtInItemsPanelId}>Built-in Items</TabsTrigger>
                <TabsTrigger value={outputPanelId}>Custom Items</TabsTrigger>
              </TabsList>

              <TabsContent value="provider">
                <StatePanel
                  title="Provider state"
                  description="The shared provider store tracks registered panels and panel stacking order."
                  sections={[
                    { label: 'panelOrder', value: providerState.panelOrder },
                    { label: 'panels', value: providerState.panels },
                  ]}
                >
                  <div className="grid gap-2 sm:grid-cols-2">
                    <KeyValue
                      label="Top panel"
                      value={lastValue(providerState.panelOrder) ?? 'none'}
                    />
                    <KeyValue
                      label="Known panels"
                      value={String(Object.keys(providerState.panels).length)}
                    />
                  </div>
                </StatePanel>
              </TabsContent>

              <TabsContent value={scenePanelId}>
                <PanelStatePanel snapshot={panelSnapshots[scenePanelId]} title="Scene Controls" />
              </TabsContent>

              <TabsContent value={builtInItemsPanelId}>
                <PanelStatePanel
                  snapshot={panelSnapshots[builtInItemsPanelId]}
                  title="Built-in Items"
                />
              </TabsContent>

              <TabsContent value={outputPanelId}>
                <PanelStatePanel snapshot={panelSnapshots[outputPanelId]} title="Custom Items" />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      ) : null}

      <TweakerPanel
        store={scenePanelStore}
        theme={themes.scene}
        title="Scene Controls"
        collapsible
        defaultPlacement="top-right"
        width={368}
        className="top-4 right-4 lg:top-8 lg:right-120"
      >
        <TweakerGroup id="scene-essentials" label="Essentials" pin="start">
          <TweakerSlider
            field="opacity"
            label={(state) => `Opacity (${stringFromMeta(state, 'unit', '%')})`}
            defaultValue={sceneDefaults.opacity}
            min={(state) => numberFromMeta(state, 'opacityMin', 0)}
            max={(state) => numberFromMeta(state, 'opacityMax', 1)}
            step={0.01}
            marks={(state) => marksFromMeta(state, 'opacityStops', [0, 0.5, 1])}
            disabled={(state) => !state.meta.canEdit}
            states={(state) =>
              Number(state.values.opacity ?? 0) > 0.85
                ? opacityHighlightedStates
                : opacityDefaultStates
            }
            status={(state) => (Number(state.values.opacity ?? 0) > 0.9 ? 'warning' : undefined)}
            formatOptions={{ style: 'percent' }}
          />
          <TweakerSlider
            field="exposure"
            label="Exposure"
            defaultValue={sceneDefaults.exposure}
            min={-2}
            max={2}
            step={0.05}
            marks={1}
            status={(state) =>
              Math.abs(Number(state.values.exposure ?? 0)) > 1.5 ? 'alert' : undefined
            }
          />
          <TweakerSwitch
            field="bloom"
            label="Bloom"
            defaultValue={sceneDefaults.bloom}
            states={(state) => (state.values.bloom ? bloomEnabledStates : bloomDisabledStates)}
          />
        </TweakerGroup>

        <TweakerGroup id="scene-rendering" label="Rendering" reorderable>
          <TweakerSelect
            field="quality"
            label="Quality"
            defaultValue={sceneDefaults.quality}
            options={[
              { label: 'Draft', value: 'draft' },
              { label: 'Balanced', value: 'balanced' },
              { label: 'Final', value: 'final' },
            ]}
          />
          <TweakerNumber
            field="cameraHeight"
            label="Camera height"
            defaultValue={sceneDefaults.cameraHeight}
            min={8}
            max={120}
            step={1}
            formatOptions={{ style: 'unit', unit: 'meter', unitDisplay: 'short' }}
          />
          <TweakerSlider
            field="shadowSoftness"
            label="Shadow softness"
            defaultValue={sceneDefaults.shadowSoftness}
            min={0}
            max={1}
            step={0.01}
            marks={1}
            formatValue={(value) => value.toFixed(2)}
          />
          <TweakerNumber
            field="maxBounces"
            label="Max bounces"
            defaultValue={sceneDefaults.maxBounces}
            min={0}
            max={16}
            step={1}
          />
          <TweakerSwitch
            field="motionBlur"
            label="Motion blur"
            defaultValue={sceneDefaults.motionBlur}
          />
          <TweakerSelect
            field="textureQuality"
            label="Texture quality"
            defaultValue={sceneDefaults.textureQuality}
            options={[
              { label: 'Low', value: 'low' },
              { label: 'Medium', value: 'medium' },
              { label: 'High', value: 'high' },
              { label: 'Ultra', value: 'ultra' },
            ]}
          />
          <TweakerSlider
            field="renderScale"
            label="Render scale"
            defaultValue={sceneDefaults.renderScale}
            min={0.5}
            max={2}
            step={0.05}
            marks
            visible={(state) => state.values.quality !== 'draft'}
            formatValue={(value) => `${value.toFixed(2)}x`}
          />
        </TweakerGroup>

        <TweakerDisplay
          id="scene-summary"
          label="Summary"
          pin="end"
          value={(state) =>
            `${Math.round(numberFromValue(state.values.opacity, 0) * 100)}% opacity / ${stringFromValue(state.values.quality, 'balanced')}`
          }
        />
      </TweakerPanel>

      <BuiltInItemsPanel />

      <TweakerPanel
        store={customItemPanelStore}
        theme={themes.custom}
        title="Custom Items"
        collapsible
        defaultPlacement="bottom-right"
        width="23rem"
        className="top-136 right-4 w-92 max-w-[calc(100dvw-2rem)] lg:top-8 lg:right-8"
      >
        <TweakerGroup id="custom-examples" label="App-local examples">
          <ValidatedPresetNameItem />
          <ShadcnChartItem />
          <MouseVelocitySparklineItem
            target={viewportPointerTarget}
            targetLabel="the full viewport"
          />
          <WaveformSpectrumItem />
        </TweakerGroup>
      </TweakerPanel>
    </>
  )
}

function ValidatedPresetNameItem() {
  return (
    <TweakerItem<string>
      contentLayout="block"
      defaultValue="Studio"
      description="This app-local item passes a Zod schema directly through the Standard Schema contract."
      field="presetName"
      label="Preset name"
      reorderable={false}
      validate={presetNameSchema}
    >
      {(item) => (
        <input
          aria-describedby={item.fieldState?.errors.length ? item.errorId : undefined}
          aria-invalid={Boolean(item.fieldState?.errors.length)}
          className="border-input bg-tweaker-control text-foreground focus-visible:ring-ring col-span-full h-8 w-full rounded-md border px-2 text-sm outline-none focus-visible:ring-2"
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
    </TweakerItem>
  )
}

function SummaryCard({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail: string
  icon: typeof Activity
  label: string
  value: string
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <Icon className="size-4" />
          {label}
        </CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground truncate text-xs">{detail}</p>
      </CardContent>
    </Card>
  )
}

function StatePanel({
  children,
  description,
  sections,
  title,
}: {
  children?: ReactNode
  description: string
  sections: { label: string; value: unknown }[]
  title: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {children ? (
          <>
            {children}
            <Separator />
          </>
        ) : null}
        <div className="grid gap-4 xl:grid-cols-2">
          {sections.map((section) => (
            <StateSection key={section.label} label={section.label} value={section.value} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function PanelStatePanel({
  snapshot,
  title,
}: {
  snapshot: PanelSnapshot | undefined
  title: string
}) {
  if (!snapshot) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>Waiting for the panel portal to mount.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const dirtyFields = Object.entries(snapshot.fields).filter(([, field]) => field.dirty)
  const touchedFields = Object.entries(snapshot.fields).filter(([, field]) => field.touched)
  const activeInteractions = Object.keys(snapshot.interaction.activeIds)
  const groups = Object.values(snapshot.items).filter((item) => item.kind === 'group')
  const controls = Object.values(snapshot.items).filter((item) => item.kind === 'control')

  return (
    <StatePanel
      title={title}
      description="Panel-local store for values, items, order, field metadata, collapsed groups, and interaction state."
      sections={[
        { label: 'values', value: snapshot.values },
        { label: 'meta', value: snapshot.meta },
        { label: 'fields', value: snapshot.fields },
        { label: 'items', value: snapshot.items },
        { label: 'order', value: snapshot.order },
        { label: 'collapsedGroups', value: snapshot.collapsedGroups },
        { label: 'interaction', value: snapshot.interaction },
      ]}
    >
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{snapshot.panelId}</Badge>
        <Badge variant="secondary">{groups.length} groups</Badge>
        <Badge variant="secondary">{controls.length} controls</Badge>
        <Badge variant={dirtyFields.length > 0 ? 'default' : 'outline'}>
          {dirtyFields.length} dirty
        </Badge>
        <Badge variant={touchedFields.length > 0 ? 'default' : 'outline'}>
          {touchedFields.length} touched
        </Badge>
        {snapshot.interaction.focusedId ? (
          <Badge variant="secondary">focused {snapshot.interaction.focusedId}</Badge>
        ) : null}
        {snapshot.interaction.hoveredId ? (
          <Badge variant="secondary">hovered {snapshot.interaction.hoveredId}</Badge>
        ) : null}
        {snapshot.interaction.draggingId ? (
          <Badge variant="destructive">dragging {snapshot.interaction.draggingId}</Badge>
        ) : null}
        {activeInteractions.map((interactionId) => (
          <Badge key={interactionId} variant="outline">
            {interactionId}
          </Badge>
        ))}
      </div>
    </StatePanel>
  )
}

function StateSection({ label, value }: { label: string; value: unknown }) {
  return (
    <section className="grid min-w-0 gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-muted-foreground font-mono text-xs font-medium">{label}</h2>
        <Badge variant="outline">{summaryForValue(value)}</Badge>
      </div>
      <ScrollArea className="bg-muted/30 h-72 rounded-lg border">
        <pre className="text-foreground min-w-max p-3 font-mono text-xs leading-5">
          {JSON.stringify(value, null, 2)}
        </pre>
      </ScrollArea>
    </section>
  )
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded-lg border px-3 py-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 font-mono text-sm">{value}</p>
    </div>
  )
}

function panelSnapshotFromState(state: TweakerPanelState): PanelSnapshot {
  return {
    collapsedGroups: state.collapsedGroups,
    fields: state.fields,
    interaction: state.interaction,
    items: state.items,
    meta: state.meta,
    order: state.order,
    panelId: state.panelId,
    values: state.values,
  }
}

function panelTotals(panels: PanelSnapshot[]) {
  return panels.reduce(
    (totals, panel) => {
      const fields = Object.values(panel.fields)
      const items = Object.values(panel.items)
      return {
        activeInteractions:
          totals.activeInteractions + Object.keys(panel.interaction.activeIds).length,
        controls: totals.controls + items.filter((item) => item.kind === 'control').length,
        dirtyFields: totals.dirtyFields + fields.filter((field) => field.dirty).length,
        draggingPanel: totals.draggingPanel ?? panel.interaction.draggingId,
        fields: totals.fields + fields.length,
        groups: totals.groups + items.filter((item) => item.kind === 'group').length,
        items: totals.items + items.length,
        touchedFields: totals.touchedFields + fields.filter((field) => field.touched).length,
      }
    },
    {
      activeInteractions: 0,
      controls: 0,
      dirtyFields: 0,
      draggingPanel: null as string | null,
      fields: 0,
      groups: 0,
      items: 0,
      touchedFields: 0,
    },
  )
}

function summaryForValue(value: unknown) {
  if (Array.isArray(value)) return `${value.length} items`
  if (value && typeof value === 'object') return `${Object.keys(value).length} keys`
  if (value === null) return 'null'
  return typeof value
}

function lastValue<T>(values: T[]) {
  return values.length > 0 ? values[values.length - 1] : undefined
}

function numberFromMeta(state: TweakerPanelState, key: string, fallback: number) {
  const value = state.meta[key]
  return typeof value === 'number' ? value : fallback
}

function stringFromMeta(state: TweakerPanelState, key: string, fallback: string) {
  return stringFromValue(state.meta[key], fallback)
}

function numberFromValue(value: TweakerValue | undefined, fallback: number) {
  return typeof value === 'number' ? value : fallback
}

function stringFromValue(value: TweakerValue | undefined, fallback: string) {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return fallback
}

function marksFromMeta(
  state: TweakerPanelState,
  key: string,
  fallback: TweakerSliderMark[],
): TweakerSliderMark[] {
  const value = state.meta[key]
  if (!Array.isArray(value)) return fallback

  return value.length > 0 && value.every((mark) => typeof mark === 'number')
    ? (value as TweakerSliderMark[])
    : fallback
}

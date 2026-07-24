'use client'

import { Activity, Braces, Layers3, ListTree, MousePointer2 } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState, type ReactNode } from 'react'
import * as z from 'zod/mini'
import {
  createPicodashPanelStore,
  PicodashDisplay,
  PicodashGroup,
  PicodashItem,
  PicodashNumber,
  PicodashPanel,
  PicodashSelect,
  PicodashSlider,
  PicodashSwitch,
  usePicodashPanel,
  usePicodashPanelStoreSelector,
  type PicodashPanelCloseDetails,
  type PicodashPanelController,
  type PicodashSliderMark,
  type PicodashValue,
} from '@picodash/panel'
import {
  usePicodashProviderSelector,
  type PicodashPanelRegistration,
  type PicodashPanelState,
} from '@picodash/panel/advanced'
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ScrollArea,
  Separator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@picodash/panel/ui'
import {
  builtInItemsPanelId,
  builtInItemsPanelStore,
} from '@/components/items/built-in/built-in-items-panel'
import { MouseVelocitySparklineItem } from '@/components/items/custom/mouse-velocity-sparkline'
import { WaveformSpectrumItem } from '@/components/items/custom/waveform-spectrum'
import { useDemoContext } from '@/components/providers/demo-provider'

const scenePanelId = 'scene-controls'
const outputPanelId = 'custom-items'
const initiallyHiddenPanelId = 'initially-hidden'

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

const scenePanelStore = createPicodashPanelStore({
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

export const customItemPanelStore = createPicodashPanelStore({
  initialValues: customItemDefaults,
  panelId: outputPanelId,
})

const presetNameSchema = z
  .string()
  .check(
    z.trim(),
    z.minLength(3, 'Preset name must contain at least 3 characters.'),
    z.maxLength(24, 'Preset name must contain at most 24 characters.'),
  )

const opacityHighlightedStates = { highlighted: true }
const opacityDefaultStates = { highlighted: false }
const bloomEnabledStates = { enabled: true }
const bloomDisabledStates = { enabled: false }

type PanelSnapshot = Pick<
  PicodashPanelState,
  'collapsedGroups' | 'fields' | 'interaction' | 'items' | 'meta' | 'order' | 'panelId' | 'values'
>

type PanelSnapshots = Record<string, PanelSnapshot | undefined>

type ProviderSnapshot = {
  panelOrder: string[]
  panelRects: Record<string, unknown>
  panels: Record<string, PicodashPanelRegistration>
}

export type StateLabTab = 'built-in-items' | 'custom-items' | 'provider' | 'scene'

function stateLabPanelForTab(tab: StateLabTab) {
  switch (tab) {
    case 'scene':
      return scenePanelId
    case 'built-in-items':
      return builtInItemsPanelId
    case 'custom-items':
      return outputPanelId
    case 'provider':
      return 'provider'
  }
}

function stateLabPathForPanel(panelId: string) {
  switch (panelId) {
    case scenePanelId:
      return '/lab/state/scene'
    case builtInItemsPanelId:
      return '/lab/state/built-in-items'
    case outputPanelId:
      return '/lab/state/custom-items'
    default:
      return '/lab/state/provider'
  }
}

function withSearch(pathname: string, searchParams: ReturnType<typeof useSearchParams>) {
  const search = searchParams.toString()
  return search ? `${pathname}?${search}` : pathname
}

export function StateLabApp({ activeTab }: { activeTab: StateLabTab }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { themes } = useDemoContext()
  const selectedStateLabPanel = stateLabPanelForTab(activeTab)
  const [closeCallbackPortalState, setCloseCallbackPortalState] = useState<
    'none' | 'present' | 'removed'
  >('none')
  const [initiallyHiddenPanelMounted, setInitiallyHiddenPanelMounted] = useState(true)
  const [lastPanelClose, setLastPanelClose] = useState<PicodashPanelCloseDetails | null>(null)
  const scenePanelController = usePicodashPanel(scenePanelId)
  const initiallyHiddenPanelController = usePicodashPanel(initiallyHiddenPanelId)
  const missingPanelController = usePicodashPanel('not-registered')
  const panelOrder = usePicodashProviderSelector((state) => state.panelOrder)
  const panelRects = usePicodashProviderSelector((state) => state.panelRects)
  const providerPanels = usePicodashProviderSelector((state) => state.panels)
  const providerState = useMemo<ProviderSnapshot>(
    () => ({ panelOrder, panelRects, panels: providerPanels }),
    [panelOrder, panelRects, providerPanels],
  )
  const scenePanelState = usePicodashPanelStoreSelector(scenePanelStore, (state) => state)
  const customItemPanelState = usePicodashPanelStoreSelector(customItemPanelStore, (state) => state)
  const builtInItemsPanelState = usePicodashPanelStoreSelector(
    builtInItemsPanelStore,
    (state) => state,
  )
  const panelSnapshots = useMemo<PanelSnapshots>(
    () => ({
      [builtInItemsPanelId]: panelSnapshotFromState(builtInItemsPanelState),
      [scenePanelId]: panelSnapshotFromState(scenePanelState),
      [outputPanelId]: panelSnapshotFromState(customItemPanelState),
    }),
    [builtInItemsPanelState, customItemPanelState, scenePanelState],
  )
  const panels = useMemo(
    () =>
      [
        panelSnapshots[scenePanelId],
        panelSnapshots[builtInItemsPanelId],
        panelSnapshots[outputPanelId],
      ].filter((panel): panel is PanelSnapshot => panel !== undefined),
    [panelSnapshots],
  )
  const totals = useMemo(() => panelTotals(panels), [panels])
  const recordPanelClose = (details: PicodashPanelCloseDetails) => {
    setLastPanelClose(details)
    setCloseCallbackPortalState(document.getElementById(details.panelId) ? 'present' : 'removed')
  }

  return (
    <>
      <div className="relative min-h-svh px-4 py-5 sm:px-6 lg:pr-208" data-state-lab>
        <div className="mx-auto grid max-w-7xl gap-5">
          <header className="border-border flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="grid gap-2">
              <Badge variant="outline" className="w-fit gap-1.5">
                <Activity className="size-3" />
                Live store inspector
              </Badge>
              <div>
                <h1 className="font-heading text-foreground text-3xl font-medium tracking-normal">
                  Picodash State Lab
                </h1>
                <div className="prose prose-invert prose-p:my-0 prose-code:bg-muted prose-code:text-foreground text-muted-foreground prose-code:rounded-md prose-code:px-1.5 prose-code:py-0.5 mt-2 max-w-2xl">
                  <p>
                    Inspect the panel store while trying common, spatial, media, and live-data{' '}
                    <code>PicodashItem</code> compositions.
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

          <section
            aria-label="Panel controller examples"
            className="grid gap-3 sm:grid-cols-2"
            data-panel-controller-examples
          >
            <PanelControllerExample controller={scenePanelController} label="Scene Controls" />
            <PanelControllerExample
              controller={initiallyHiddenPanelController}
              label="Initially Hidden"
            />
            <span
              data-missing-panel-controller={
                missingPanelController === null ? 'null' : 'registered'
              }
              hidden
            />
            <span data-close-callback-portal-state={closeCallbackPortalState} hidden />
            <span
              data-last-panel-close={
                lastPanelClose ? `${lastPanelClose.panelId}:${lastPanelClose.behavior}` : 'none'
              }
              hidden
            />
            <span
              data-scene-panel-rect={providerState.panelRects[scenePanelId] ? 'present' : 'absent'}
              hidden
            />
          </section>

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

          <Tabs
            className="grid gap-4"
            selectedKey={selectedStateLabPanel}
            onSelectionChange={(key) =>
              router.push(withSearch(stateLabPathForPanel(String(key)), searchParams))
            }
          >
            <TabsList className="grid w-full grid-cols-4 lg:w-fit">
              <TabsTrigger id="provider">PicodashState</TabsTrigger>
              <TabsTrigger id={scenePanelId}>Scene</TabsTrigger>
              <TabsTrigger id={builtInItemsPanelId}>Built-in Items</TabsTrigger>
              <TabsTrigger id={outputPanelId}>Custom Items</TabsTrigger>
            </TabsList>

            <TabsContent id="provider">
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

            <TabsContent id={scenePanelId}>
              <PanelStatePanel snapshot={panelSnapshots[scenePanelId]} title="Scene Controls" />
            </TabsContent>

            <TabsContent id={builtInItemsPanelId}>
              <PanelStatePanel
                snapshot={panelSnapshots[builtInItemsPanelId]}
                title="Built-in Items"
              />
            </TabsContent>

            <TabsContent id={outputPanelId}>
              <PanelStatePanel snapshot={panelSnapshots[outputPanelId]} title="Custom Items" />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <PicodashPanel
        close
        store={scenePanelStore}
        theme={themes.scene}
        title="Scene Controls"
        collapsible
        defaultPlacement="top-right"
        width={368}
        className="top-4 right-4 lg:top-8 lg:right-120"
        onClose={recordPanelClose}
      >
        <PicodashGroup id="scene-essentials" label="Essentials" pin="start">
          <PicodashSlider
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
          <PicodashSlider
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
          <PicodashSwitch
            field="bloom"
            label="Bloom"
            defaultValue={sceneDefaults.bloom}
            states={(state) => (state.values.bloom ? bloomEnabledStates : bloomDisabledStates)}
          />
        </PicodashGroup>

        <PicodashGroup id="scene-rendering" label="Rendering" reorderable>
          <PicodashSelect
            field="quality"
            label="Quality"
            defaultValue={sceneDefaults.quality}
            options={[
              { label: 'Draft', value: 'draft' },
              { label: 'Balanced', value: 'balanced' },
              { label: 'Final', value: 'final' },
            ]}
          />
          <PicodashNumber
            field="cameraHeight"
            label="Camera height"
            defaultValue={sceneDefaults.cameraHeight}
            min={8}
            max={120}
            step={1}
            formatOptions={{ style: 'unit', unit: 'meter', unitDisplay: 'short' }}
          />
          <PicodashSlider
            field="shadowSoftness"
            label="Shadow softness"
            defaultValue={sceneDefaults.shadowSoftness}
            min={0}
            max={1}
            step={0.01}
            marks={1}
            formatValue={(value) => value.toFixed(2)}
          />
          <PicodashNumber
            field="maxBounces"
            label="Max bounces"
            defaultValue={sceneDefaults.maxBounces}
            min={0}
            max={16}
            step={1}
          />
          <PicodashSwitch
            field="motionBlur"
            label="Motion blur"
            defaultValue={sceneDefaults.motionBlur}
          />
          <PicodashSelect
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
          <PicodashSlider
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
        </PicodashGroup>

        <PicodashDisplay
          id="scene-summary"
          label="Summary"
          pin="end"
          value={(state) =>
            `${Math.round(numberFromValue(state.values.opacity, 0) * 100)}% opacity / ${stringFromValue(state.values.quality, 'balanced')}`
          }
        />
      </PicodashPanel>

      <PicodashPanel
        store={customItemPanelStore}
        theme={themes.custom}
        title="Custom Items"
        collapsible
        defaultPlacement="bottom-right"
        width="23rem"
        className="top-136 right-4 w-92 max-w-[calc(100dvw-2rem)] lg:top-8 lg:right-auto lg:bottom-auto lg:left-8"
      >
        <PicodashGroup id="custom-examples" label="App-local examples">
          <ValidatedPresetNameItem />
          <MouseVelocitySparklineItem />
          <WaveformSpectrumItem />
        </PicodashGroup>
      </PicodashPanel>

      {initiallyHiddenPanelMounted ? (
        <PicodashPanel
          close={{ behavior: 'deregister' }}
          id={initiallyHiddenPanelId}
          title="Initially Hidden"
          defaultVisible={false}
          defaultPlacement="bottom-left"
          width={240}
          onClose={(details) => {
            recordPanelClose(details)
            setInitiallyHiddenPanelMounted(false)
          }}
        >
          <PicodashDisplay
            id="hidden-panel-status"
            label="Status"
            value="Registered while hidden"
          />
        </PicodashPanel>
      ) : null}
    </>
  )
}

function ValidatedPresetNameItem() {
  return (
    <PicodashItem<string>
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
          className="border-input bg-picodash-control text-foreground focus-visible:ring-ring col-span-full h-8 w-full rounded-md border px-2 text-sm outline-none focus-visible:ring-2"
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

function PanelControllerExample({
  controller,
  label,
}: {
  controller: PicodashPanelController | null
  label: string
}) {
  const buttonClassName =
    'border-border bg-muted/30 hover:bg-muted focus-visible:ring-ring h-8 border px-2.5 text-xs font-medium outline-none focus-visible:ring-2 disabled:opacity-50'

  return (
    <Card size="sm" data-panel-controller={label}>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle data-panel-visibility={label}>
          {controller ? (controller.visible ? 'visible' : 'hidden') : 'waiting'}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <button
          className={buttonClassName}
          disabled={!controller}
          type="button"
          onClick={() => controller?.show()}
        >
          Show
        </button>
        <button
          className={buttonClassName}
          disabled={!controller}
          type="button"
          onClick={() => controller?.hide()}
        >
          Hide
        </button>
        <button
          className={buttonClassName}
          disabled={!controller}
          type="button"
          onClick={() => controller?.toggle()}
        >
          Toggle
        </button>
        <button
          className={buttonClassName}
          disabled={!controller}
          type="button"
          onClick={() => controller?.activate()}
        >
          Activate
        </button>
        <button
          className={buttonClassName}
          disabled={!controller}
          type="button"
          onClick={() => controller?.setVisible(false)}
        >
          Set hidden
        </button>
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

function panelSnapshotFromState(state: PicodashPanelState): PanelSnapshot {
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

function numberFromMeta(state: PicodashPanelState, key: string, fallback: number) {
  const value = state.meta[key]
  return typeof value === 'number' ? value : fallback
}

function stringFromMeta(state: PicodashPanelState, key: string, fallback: string) {
  return stringFromValue(state.meta[key], fallback)
}

function numberFromValue(value: PicodashValue | undefined, fallback: number) {
  return typeof value === 'number' ? value : fallback
}

function stringFromValue(value: PicodashValue | undefined, fallback: string) {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return fallback
}

function marksFromMeta(
  state: PicodashPanelState,
  key: string,
  fallback: PicodashSliderMark[],
): PicodashSliderMark[] {
  const value = state.meta[key]
  if (!Array.isArray(value)) return fallback

  return value.length > 0 && value.every((mark) => typeof mark === 'number')
    ? (value as PicodashSliderMark[])
    : fallback
}

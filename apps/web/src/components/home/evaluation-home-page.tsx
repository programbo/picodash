'use client'

import {
  ActionMenuItem,
  ActionSubmenu,
  CollapseAllItem,
  CopySubmenu,
  Dashlet as PicodashItem,
  DashletGroup as PicodashGroup,
  DashPanel,
  DashPanelProvider,
  DashPanelTrigger,
  Dashlist as PicodashList,
  ExpandAllItem,
  ExportSubmenu,
  ResetItem,
  useDashPanel,
  type DashPanelPlacement,
  type PicodashThemeOption,
} from '@picodash/picodash'
import { PicodashDisplay as PanelDisplay, PicodashPanel } from '@picodash/picodash'
import { createPicodashStore } from '@picodash/store'
import { Check, ChevronDown, GripVertical, Layers, Play, Settings2 } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { PicodashLogo } from '@/components/brand/picodash-logo'

type SiteTheme = 'light' | 'dark' | 'system'
type PanelTheme = PicodashThemeOption<'ocean' | 'plum' | 'tron' | 'contrast'>

const displayStore = createPicodashStore({
  panelId: 'evaluation-display',
  fields: {
    frameRate: { defaultValue: 59.8 },
    renderMode: { defaultValue: 'Realtime' },
    selectedClip: { defaultValue: 'Cut 04 · 00:32' },
    status: { defaultValue: 'Ready' },
  },
})

const viewportDisplayStore = createPicodashStore({
  panelId: 'evaluation-viewport-display',
  fields: {
    frameRate: { defaultValue: 60 },
    renderMode: { defaultValue: 'Viewport' },
    selectedClip: { defaultValue: 'Cut 02 · 00:18' },
    status: { defaultValue: 'Monitoring' },
  },
})

const mediaStores = [
  createPicodashStore({ panelId: 'media-clip', fields: {} }),
  createPicodashStore({ panelId: 'media-notes', fields: {} }),
  createPicodashStore({ panelId: 'media-review', fields: {} }),
] as const

const releaseStore = createPicodashStore({
  panelId: 'release-config',
  fields: {
    build: { defaultValue: '2026.08.02-rc1' },
    channel: { defaultValue: 'Staging' },
    rollout: { defaultValue: 42 },
    smokeTests: { defaultValue: true },
    status: { defaultValue: 'Ready' },
    version: { defaultValue: 'v2.4.0' },
  },
})

const qualityStore = createPicodashStore({
  panelId: 'quality-signals',
  fields: {
    latency: { defaultValue: 86 },
    trace: { defaultValue: 'On' },
    uptime: { defaultValue: '99.98%' },
  },
})

const placements: Record<string, DashPanelPlacement> = {
  floating: { disposition: { kind: 'snapped', position: 'top-right' }, mode: 'floating' },
  hybrid: { disposition: { kind: 'snapped', position: 'bottom' }, mode: 'hybrid' },
  fixed: { disposition: { kind: 'docked', position: 'middle-right' }, mode: 'fixed' },
}

function ThemeSelector({
  value,
  onChange,
}: {
  value: SiteTheme
  onChange: (value: SiteTheme) => void
}) {
  return (
    <label className="inline-flex items-center gap-2 border border-black/15 bg-white/70 px-3 py-2 text-xs font-medium text-black dark:border-white/15 dark:bg-black/20 dark:text-white">
      <span className="sr-only">Site theme</span>
      <span>Site</span>
      <select
        aria-label="Site theme"
        className="bg-transparent font-mono text-[11px] uppercase outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value as SiteTheme)}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
      <ChevronDown aria-hidden="true" className="size-3" />
    </label>
  )
}

function PanelControls({
  panelTheme,
  placement,
  onPanelThemeChange,
  onPlacementChange,
}: {
  panelTheme: PanelTheme
  placement: keyof typeof placements
  onPanelThemeChange: (theme: PanelTheme) => void
  onPlacementChange: (placement: keyof typeof placements) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" data-panel-controls>
      <label className="flex items-center gap-2 text-xs text-current/70">
        <span>Placement</span>
        <select
          aria-label="Panel placement"
          className="border border-current/20 bg-transparent px-2 py-1 font-mono text-[11px] uppercase"
          value={placement}
          onChange={(event) => onPlacementChange(event.target.value as keyof typeof placements)}
        >
          <option value="floating">Floating</option>
          <option value="hybrid">Hybrid</option>
          <option value="fixed">Fixed</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs text-current/70">
        <span>Panel theme</span>
        <select
          aria-label="Panel theme"
          className="border border-current/20 bg-transparent px-2 py-1 font-mono text-[11px] uppercase"
          value={panelTheme}
          onChange={(event) => onPanelThemeChange(event.target.value as PanelTheme)}
        >
          {['inherit', 'ocean', 'plum', 'tron', 'contrast'].map((theme) => (
            <option key={theme} value={theme === 'inherit' ? 'system' : theme}>
              {theme}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

function EvaluationDisplayPanel({
  panelTheme,
  placement,
  store,
  title,
  panelId,
}: {
  panelTheme: PanelTheme
  placement: keyof typeof placements
  store: typeof displayStore
  title: string
  panelId: 'viewport' | 'bounded'
}) {
  const [menuCollapsible, setMenuCollapsible] = useState(true)
  const [menuDraggable, setMenuDraggable] = useState(true)
  const [menuTheme, setMenuTheme] = useState<PanelTheme>(panelTheme)
  const controller = useDashPanel(store.getState().panelId)
  useEffect(() => setMenuTheme(panelTheme), [panelTheme])
  const actionMenu = useMemo(
    () => [
      <ActionSubmenu key="placement" label="Placement mode">
        {Object.entries(placements).map(([key, value]) => (
          <ActionMenuItem key={key} label={key} onAction={() => controller?.setPlacement(value)} />
        ))}
      </ActionSubmenu>,
      <ActionMenuItem
        key="collapsible"
        label={menuCollapsible ? 'Collapsible ✓' : 'Collapsible'}
        onAction={() => setMenuCollapsible((current) => !current)}
      />,
      <ActionMenuItem
        key="draggable"
        disabled={placement === 'fixed'}
        label={menuDraggable ? 'Draggable ✓' : 'Draggable'}
        onAction={() => setMenuDraggable((current) => !current)}
      />,
      <ActionSubmenu key="theme" label="Panel theme">
        {(['inherit', 'system', 'light', 'dark', 'ocean', 'plum', 'tron', 'contrast'] as const).map(
          (theme) => (
            <ActionMenuItem
              key={theme}
              label={theme}
              onAction={() => setMenuTheme(theme === 'inherit' ? 'system' : theme)}
            />
          ),
        )}
      </ActionSubmenu>,
      <ActionMenuItem
        key="toggle"
        label={controller?.visible ? 'Hide panel' : 'Show panel'}
        onAction={() => controller?.toggle()}
      />,
      <CollapseAllItem key="collapse-all" />,
      <ExpandAllItem key="expand-all" />,
      <CopySubmenu key="copy" />,
      <ExportSubmenu key="export" />,
      <ResetItem key="reset" />,
    ],
    [controller, menuCollapsible, menuDraggable, menuTheme, placement],
  )
  return (
    <PicodashPanel
      actionMenu={actionMenu}
      close
      collapsible={menuCollapsible}
      defaultPlacement={placements[placement]}
      drag={menuDraggable && placement !== 'fixed'}
      store={store}
      theme={menuTheme === 'system' ? undefined : menuTheme}
      title={title}
      data-section-one-panel={panelId}
      width={330}
    >
      <PanelDisplay
        field={store.fields.status}
        label="Status"
        data-panel-display-group="render-readout"
      />
      <PanelDisplay field={store.fields.frameRate} label="Frame rate" />
      <PanelDisplay field={store.fields.renderMode} label="Render mode" />
      <PanelDisplay field={store.fields.selectedClip} label="Selected clip" />
    </PicodashPanel>
  )
}

function PlainEvaluationPanel({
  children,
  store,
  title,
}: {
  children: ReactNode
  store: (typeof mediaStores)[number]
  title: string
}) {
  const controller = useDashPanel(store.getState().panelId)
  const [collapsible, setCollapsible] = useState(true)
  const [draggable, setDraggable] = useState(true)
  const [theme, setTheme] = useState<PanelTheme>('system')
  const actionMenu = useMemo(
    () => [
      <ActionSubmenu key="placement" label="Placement mode">
        {Object.entries(placements).map(([key, value]) => (
          <ActionMenuItem key={key} label={key} onAction={() => controller?.setPlacement(value)} />
        ))}
      </ActionSubmenu>,
      <ActionMenuItem
        key="collapsible"
        label={collapsible ? 'Collapsible ✓' : 'Collapsible'}
        onAction={() => setCollapsible((value) => !value)}
      />,
      <ActionMenuItem
        key="draggable"
        disabled={controller?.placement.mode === 'fixed'}
        label={draggable ? 'Draggable ✓' : 'Draggable'}
        onAction={() => setDraggable((value) => !value)}
      />,
      <ActionSubmenu key="theme" label="Panel theme">
        {(['inherit', 'system', 'light', 'dark', 'ocean', 'plum', 'tron', 'contrast'] as const).map(
          (value) => (
            <ActionMenuItem
              key={value}
              label={value}
              onAction={() => setTheme(value === 'inherit' ? 'system' : value)}
            />
          ),
        )}
      </ActionSubmenu>,
      <CollapseAllItem key="collapse-all" />,
      <ExpandAllItem key="expand-all" />,
      <CopySubmenu key="copy" />,
      <ExportSubmenu key="export" />,
      <ResetItem key="reset" />,
    ],
    [collapsible, controller, draggable],
  )
  return (
    <DashPanel
      actionMenu={actionMenu}
      close
      collapsible={collapsible}
      data-section-two-panel
      defaultPlacement={placements.fixed}
      drag={draggable && controller?.placement.mode !== 'fixed'}
      store={store}
      theme={theme === 'system' ? undefined : theme}
      title={title}
      width={300}
    >
      {children}
    </DashPanel>
  )
}

function MediaReviewPanels() {
  return (
    <div className="grid gap-4 md:grid-cols-3" data-section-two-panels>
      <PlainEvaluationPanel store={mediaStores[0]} title="Clip review">
        <div className="grid gap-3 p-4 text-sm">
          <div className="aspect-video bg-black/20 p-4 dark:bg-white/5">
            <div className="flex h-full items-center justify-center border border-current/15">
              <Play aria-hidden="true" className="size-7" />
            </div>
          </div>
          <p className="font-medium">Cut 04 · 00:32–00:47</p>
          <button className="border border-current/20 px-3 py-2 text-left text-xs" type="button">
            Mark for review
          </button>
        </div>
      </PlainEvaluationPanel>
      <PlainEvaluationPanel store={mediaStores[1]} title="Review notes">
        <div className="grid gap-3 p-4 text-sm">
          <p className="border-l-2 border-current/30 pl-3">
            “The opening beat needs one more frame before the title card.”
          </p>
          <textarea
            aria-label="Review note"
            className="min-h-24 border border-current/20 bg-transparent p-2 text-xs"
            defaultValue="Hold on title card timing"
          />
          <button className="border border-current/20 px-3 py-2 text-left text-xs" type="button">
            Save note
          </button>
        </div>
      </PlainEvaluationPanel>
      <PlainEvaluationPanel store={mediaStores[2]} title="Publish gate">
        <div className="grid gap-3 p-4 text-sm">
          <p className="flex items-center gap-2">
            <Check aria-hidden="true" className="size-4" /> 3 of 3 checks passed
          </p>
          <div className="h-2 bg-current/10">
            <div className="h-full w-full bg-current" />
          </div>
          <button className="border border-current/20 px-3 py-2 text-left text-xs" type="button">
            Approve cut
          </button>
        </div>
      </PlainEvaluationPanel>
    </div>
  )
}

function ReleaseDashlists() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]" data-section-three-dashlists>
      <PicodashList className="min-h-80" store={releaseStore}>
        <PicodashGroup
          id="release-settings"
          label="Release settings"
          status="info"
          states={{ app: 'release' }}
        >
          <PicodashItem field={releaseStore.fields.version} label="Version" readOnly>
            {({ value }) => <span className="font-mono text-xs">{value}</span>}
          </PicodashItem>
          <PicodashItem field={releaseStore.fields.channel} label="Channel" pin="start">
            {({ value, setInput }) => (
              <select
                className="border border-current/20 bg-transparent px-2 py-1 text-xs"
                value={String(value ?? '')}
                onChange={(event) => setInput(event.target.value)}
              >
                {['Staging', 'Canary', 'Production'].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            )}
          </PicodashItem>
          <PicodashItem field={releaseStore.fields.rollout} label="Rollout">
            {({ value, setInput }) => (
              <input
                aria-label="Rollout"
                className="w-full"
                type="range"
                min={0}
                max={100}
                step={1}
                value={Number(value ?? 0)}
                onChange={(event) => setInput(Number(event.target.value))}
              />
            )}
          </PicodashItem>
          <PicodashItem field={releaseStore.fields.smokeTests} label="Smoke tests">
            {({ value, setInput }) => (
              <input
                aria-label="Smoke tests"
                checked={Boolean(value)}
                onChange={(event) => setInput(event.target.checked)}
                type="checkbox"
              />
            )}
          </PicodashItem>
          <PicodashItem
            id="deployment-status"
            fields={{
              status: { field: releaseStore.fields.status, mode: 'display' },
              build: { field: releaseStore.fields.build, mode: 'display' },
            }}
            label="Deployment status"
            contentLayout="full"
            pin="end"
            status="info"
          >
            {({ fields }) => (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <span className="text-picodash-muted">Build</span>
                <span>{fields.build.value}</span>
                <span className="text-picodash-muted">State</span>
                <span>{fields.status.value}</span>
              </div>
            )}
          </PicodashItem>
        </PicodashGroup>
      </PicodashList>
      <PicodashList className="min-h-80" store={qualityStore} theme="contrast">
        <PicodashGroup
          id="quality-signals"
          label="Quality signals"
          collapsible
          defaultCollapsed={false}
          reorderable
          states={{ stream: 'live' }}
        >
          <PicodashItem
            field={qualityStore.fields.uptime}
            label="Uptime"
            pin="start"
            valueMode="display"
          >
            {({ value }) => <span>{value}%</span>}
          </PicodashItem>
          <PicodashItem field={qualityStore.fields.latency} label="Latency (ms)" readOnly>
            {({ value }) => <span className="font-mono">{value}</span>}
          </PicodashItem>
          <PicodashItem field={qualityStore.fields.trace} label="Trace mode" valueMode="display">
            {({ value }) => <span>{value}</span>}
          </PicodashItem>
        </PicodashGroup>
        <PicodashGroup
          id="handoff"
          label="Handoff"
          collapsible
          reorderable={false}
          pin="end"
          status="warning"
        >
          <PicodashItem id="handoff-note" valueMode="display" label="Next action" readOnly>
            Confirm canary owners before 14:00 UTC.
          </PicodashItem>
        </PicodashGroup>
      </PicodashList>
    </div>
  )
}

export function EvaluationHomePage() {
  const [siteTheme, setSiteTheme] = useState<SiteTheme>('dark')
  const [panelTheme, setPanelTheme] = useState<PanelTheme>('system')
  const [placement, setPlacement] = useState<keyof typeof placements>('floating')
  const [canvasElement, setCanvasElement] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    const stored = window.localStorage.getItem('picodash-site-theme') as SiteTheme | null
    if (stored === 'light' || stored === 'dark' || stored === 'system') setSiteTheme(stored)
  }, [])

  useEffect(() => {
    window.localStorage.setItem('picodash-site-theme', siteTheme)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () =>
      document.documentElement.classList.toggle(
        'dark',
        siteTheme === 'dark' || (siteTheme === 'system' && media.matches),
      )
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [siteTheme])

  return (
    <DashPanelProvider<PanelTheme | SiteTheme> persistLayout={false} theme={siteTheme}>
      <main
        className="bg-background text-foreground min-h-screen overflow-x-clip"
        data-product-route="evaluation-home"
      >
        <header className="bg-background fixed inset-x-0 top-0 z-1100 flex items-center justify-between gap-4 border-b border-black/10 px-5 py-3 backdrop-blur-xl sm:px-8 dark:border-white/10">
          <a
            className="flex items-center gap-3 text-sm font-semibold tracking-tight"
            href="#section-one"
          >
            <PicodashLogo aria-label="Picodash" className="size-6 text-current" label="Picodash" />
            <span>Picodash evaluation</span>
          </a>
          <ThemeSelector value={siteTheme} onChange={setSiteTheme} />
        </header>

        <section
          className="relative flex h-dvh min-h-0 items-center justify-center overflow-hidden px-5 pt-24 pb-10 sm:px-10"
          data-evaluation-section="one"
          id="section-one"
        >
          <div className="w-[80vw] max-w-6xl">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] tracking-[.22em] uppercase opacity-60">
                  01 / Viewport-fixed panel
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
                  A dashboard you can inspect.
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-6 opacity-70">
                  A bounded host scene keeps the app in charge while a live Picodash panel reports
                  custom state.
                </p>
              </div>
              <PanelControls
                panelTheme={panelTheme}
                placement={placement}
                onPanelThemeChange={setPanelTheme}
                onPlacementChange={setPlacement}
              />
            </div>
            <div
              className="relative flex min-h-[80vh] items-end overflow-hidden border border-black/15 bg-gradient-to-br from-black/5 via-transparent to-black/10 p-5 sm:p-8 dark:border-white/15 dark:from-white/5 dark:to-transparent"
              data-section-one-canvas
              ref={setCanvasElement}
            >
              <div className="grid w-full gap-3 sm:grid-cols-3">
                <div className="bg-background/60 border border-current/15 p-4">
                  <Layers aria-hidden="true" className="mb-10 size-5 opacity-60" />
                  <p className="text-xs uppercase opacity-60">Host canvas</p>
                  <p className="mt-1 text-lg font-medium">80vw × 80vh</p>
                </div>
                <div className="bg-background/60 border border-current/15 p-4">
                  <GripVertical aria-hidden="true" className="mb-10 size-5 opacity-60" />
                  <p className="text-xs uppercase opacity-60">Panel behavior</p>
                  <p className="mt-1 text-lg font-medium">Move, dock, inspect</p>
                </div>
                <div className="bg-background/60 border border-current/15 p-4">
                  <Settings2 aria-hidden="true" className="mb-10 size-5 opacity-60" />
                  <p className="text-xs uppercase opacity-60">Custom state</p>
                  <p className="mt-1 text-lg font-medium">Display Dashlets</p>
                </div>
              </div>
              <div
                className="pointer-events-none absolute inset-0"
                data-section-one-viewport-container
                aria-hidden="true"
              />
              <EvaluationDisplayPanel
                panelTheme={panelTheme}
                placement={placement}
                store={viewportDisplayStore}
                title="Viewport render readout"
                panelId="viewport"
              />
              {canvasElement ? (
                <DashPanelProvider<PanelTheme | SiteTheme>
                  panelBoundary={canvasElement}
                  persistLayout={false}
                  portalContainer={canvasElement}
                  theme={siteTheme}
                >
                  <EvaluationDisplayPanel
                    panelTheme={panelTheme}
                    placement={placement}
                    store={displayStore}
                    title="Bounded render readout"
                    panelId="bounded"
                  />
                </DashPanelProvider>
              ) : null}
            </div>
          </div>
        </section>

        <section
          className="flex h-dvh min-h-0 items-center overflow-hidden bg-black/3 px-5 py-24 sm:px-10 dark:bg-white/3"
          data-evaluation-section="two"
          id="section-two"
        >
          <div className="mx-auto w-full max-w-6xl">
            <p className="font-mono text-[11px] tracking-[.22em] uppercase opacity-60">
              02 / Arbitrary content
            </p>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
                  Panels fit the product you already have.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 opacity-70">
                  Use the panel shell for media, notes, and review actions without adopting a
                  Dashlet layout.
                </p>
              </div>
              <DashPanelTrigger
                action="activate"
                store={mediaStores[2]}
                className="border border-current/20 px-3 py-2 text-xs font-medium"
              >
                Open publish gate
              </DashPanelTrigger>
            </div>
            <MediaReviewPanels />
          </div>
        </section>

        <section
          className="flex h-dvh min-h-0 items-center overflow-hidden px-5 py-24 sm:px-10"
          data-evaluation-section="three"
          id="section-three"
        >
          <div className="mx-auto w-full max-w-6xl">
            <p className="font-mono text-[11px] tracking-[.22em] uppercase opacity-60">
              03 / Configurable release app
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
              Lists, groups, and Dashlets stay legible.
            </h2>
            <p className="mt-3 mb-8 max-w-2xl text-sm leading-6 opacity-70">
              A release surface combines visibility, ordering, pinning, statuses, layouts, compound
              fields, display values, and read-only signals.
            </p>
            <ReleaseDashlists />
          </div>
        </section>
      </main>
    </DashPanelProvider>
  )
}

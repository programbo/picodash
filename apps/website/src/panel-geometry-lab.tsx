import { useRef, useState } from 'react'
import {
  createTweakerPanelStore,
  TweakerDisplay,
  TweakerGroup,
  TweakerPanel,
  TweakerProvider,
  useTweakerPanel,
  type TweakerPanelFixedPosition,
} from 'tweaker'

const storageKey = 'tweaker-geometry-lab:panel-layout:v1'

const tallPanelStore = createTweakerPanelStore({ panelId: 'geometry-tall' })
const peerPanelStore = createTweakerPanelStore({ panelId: 'geometry-peer' })
const expansionPanelStore = createTweakerPanelStore({ panelId: 'geometry-expansion' })
const bottomPanelStore = createTweakerPanelStore({ panelId: 'geometry-bottom' })
const customBottomPanelStore = createTweakerPanelStore({ panelId: 'geometry-custom-bottom' })
const responsivePanelStore = createTweakerPanelStore({ panelId: 'geometry-responsive' })
const changingConstraintPanelStore = createTweakerPanelStore({
  panelId: 'geometry-changing-constraint',
})
export const keyboardUnmountPanelStore = createTweakerPanelStore({
  panelId: 'geometry-keyboard-unmount',
})
const cappedPanelStore = createTweakerPanelStore({ panelId: 'geometry-capped' })
const classCappedPanelStore = createTweakerPanelStore({ panelId: 'geometry-class-capped' })
const bottomCappedPanelStore = createTweakerPanelStore({ panelId: 'geometry-bottom-capped' })
const bottomDragPanelStore = createTweakerPanelStore({ panelId: 'geometry-bottom-drag' })
const fixedBoundaryPanelStore = createTweakerPanelStore({ panelId: 'geometry-fixed-boundary' })
const fixedOverridePanelStore = createTweakerPanelStore({ panelId: 'geometry-fixed-override' })
const reviewRegressionPanelStore = createTweakerPanelStore({
  panelId: 'geometry-review-regression',
})
const relativeConstraintPanelStore = createTweakerPanelStore({
  panelId: 'geometry-relative-constraint',
})

const fixedPositions = [
  'top-left',
  'bottom-left',
  'top-right',
  'bottom-right',
  'left',
  'right',
] as const satisfies readonly TweakerPanelFixedPosition[]

export function PanelGeometryLab() {
  const fixture = new URLSearchParams(window.location.search).get('fixture') ?? 'drag'

  if (fixture === 'fixed-boundaries') {
    return <FixedBoundaryFixture />
  }
  if (fixture === 'review-regressions') {
    return <ReviewRegressionFixture />
  }
  if (fixture === 'relative-constraints') {
    return <RelativeConstraintFixture />
  }

  return (
    <main
      id="main-content"
      className="dark bg-background text-foreground relative min-h-[180dvh]"
      data-panel-geometry-lab
      data-product-route="panel-geometry-lab"
    >
      <div className="pointer-events-none fixed inset-0" data-geometry-viewport />
      <TweakerProvider persistLayout storageKey={storageKey} theme="dark">
        {fixture === 'drag' ? <DragFixture /> : null}
        {fixture === 'peer' ? <PeerFixture /> : null}
        {fixture === 'panel-expansion' ? <PanelExpansionFixture /> : null}
        {fixture === 'groups' ? <GroupExpansionFixture /> : null}
        {fixture === 'bottom' ? <BottomExpansionFixture /> : null}
        {fixture === 'custom-bottom' ? <CustomBottomFixture /> : null}
        {fixture === 'responsive' ? <ResponsiveConstraintFixture /> : null}
        {fixture === 'changing-constraint' ? <ChangingConstraintFixture /> : null}
        {fixture === 'keyboard-unmount' ? <KeyboardUnmountFixture /> : null}
        {fixture === 'caller-max-height' ? <CallerMaxHeightFixture /> : null}
        {fixture === 'class-max-height' ? <ClassMaxHeightFixture /> : null}
        {fixture === 'bottom-max-height' ? <BottomMaxHeightFixture /> : null}
        {fixture === 'bottom-drag' ? <BottomDragFixture /> : null}
      </TweakerProvider>
    </main>
  )
}

function RelativeConstraintFixture() {
  const boundaryRef = useRef<HTMLElement>(null)

  return (
    <main
      id="main-content"
      className="dark bg-background text-foreground relative min-h-svh"
      data-panel-geometry-lab
      data-product-route="panel-geometry-lab"
    >
      <style>{`.review-relative-constraint { max-width: 50%; }`}</style>
      <section
        ref={boundaryRef}
        className="absolute top-20 left-[120px] h-[360px] w-[520px] border border-white/15"
        data-geometry-boundary="relative-constraints"
      >
        <TweakerProvider panelBoundary={boundaryRef} persistLayout={false} theme="dark">
          <TweakerPanel
            store={relativeConstraintPanelStore}
            title="Relative constraints"
            width={480}
            className="review-relative-constraint"
            defaultPlacement={{ mode: 'floating', position: 'bottom-right' }}
            style={{ maxHeight: 'calc(100% - 40px)' }}
            data-geometry-fixture="relative-constraint"
          >
            <TallContent prefix="relative-constraint" count={32} />
          </TweakerPanel>
        </TweakerProvider>
      </section>
    </main>
  )
}

function ReviewRegressionFixture() {
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null)

  return (
    <main
      id="main-content"
      className="dark bg-background text-foreground min-h-svh"
      data-panel-geometry-lab
      data-product-route="panel-geometry-lab"
    >
      <style>{`.review-panel-constraint { max-height: 180px; max-width: 220px; }`}</style>
      <div
        ref={setPortalContainer}
        className="fixed inset-0 overflow-auto"
        data-geometry-scroll-portal
      >
        <div className="h-[1200px] w-px" aria-hidden="true" />
        {portalContainer ? (
          <TweakerProvider persistLayout={false} portalContainer={portalContainer} theme="dark">
            <ReviewRegressionControls />
            <TweakerPanel
              store={reviewRegressionPanelStore}
              title="Review regression"
              width={320}
              className="review-panel-constraint"
              collapsible
              defaultPlacement={{ mode: 'fixed', position: 'left' }}
              data-geometry-fixture="review-regression"
            >
              <TallContent prefix="review-regression" count={24} />
            </TweakerPanel>
          </TweakerProvider>
        ) : null}
      </div>
    </main>
  )
}

function ReviewRegressionControls() {
  const panel = useTweakerPanel('geometry-review-regression')
  return (
    <>
      <button
        type="button"
        className="fixed top-2 left-1/2 z-50 -translate-x-1/2 rounded bg-black px-3 py-2 text-xs"
        onClick={() => panel?.setPlacement({ mode: 'floating', position: 'bottom-right' })}
      >
        Float bottom-right
      </button>
      <output data-review-regression-placement hidden>
        {panel
          ? `${panel.placement.mode}:${'position' in panel.placement ? (panel.placement.position ?? '') : ''}`
          : 'unregistered'}
      </output>
    </>
  )
}

function FixedBoundaryFixture() {
  const mainBoundaryRef = useRef<HTMLElement>(null)
  const canvasBoundaryRef = useRef<HTMLDivElement>(null)

  return (
    <main
      id="main-content"
      className="dark bg-background text-foreground min-h-svh p-12"
      data-panel-geometry-lab
      data-product-route="panel-geometry-lab"
    >
      <section
        ref={mainBoundaryRef}
        className="relative h-[calc(100svh-6rem)] rounded-xl border border-white/15 bg-zinc-950"
        data-geometry-boundary="provider"
      >
        <TweakerProvider
          panelBoundary={mainBoundaryRef}
          persistLayout
          storageKey="tweaker-geometry-lab:fixed-boundaries:v1"
          theme="dark"
        >
          <FixedPlacementControls />
          <div
            ref={canvasBoundaryRef}
            className="absolute top-24 right-24 bottom-16 left-[48%] rounded-lg border border-dashed border-cyan-400/50 bg-cyan-400/5"
            data-geometry-boundary="override"
          >
            <p className="p-4 text-sm text-cyan-200">Panel-level canvas boundary</p>
          </div>

          <TweakerPanel
            store={fixedBoundaryPanelStore}
            title="Provider boundary"
            width={300}
            collapsible
            defaultPlacement={{ mode: 'fixed', position: 'left' }}
            data-geometry-fixture="fixed-boundary"
          >
            <TweakerGroup id="fixed-start" label="Pinned start" pin="start">
              <TweakerDisplay id="fixed-start-value" label="Boundary" value="Provider" />
            </TweakerGroup>
            <TallContent prefix="fixed-auto" count={28} />
            <TweakerGroup id="fixed-end" label="Pinned end" pin="end">
              <TweakerDisplay id="fixed-end-value" label="Placement" value="Runtime" />
            </TweakerGroup>
          </TweakerPanel>

          <TweakerPanel
            store={fixedOverridePanelStore}
            title="Canvas boundary"
            width={240}
            collapsible
            boundary={canvasBoundaryRef}
            defaultPlacement={{ mode: 'fixed', position: 'bottom-right' }}
            data-geometry-fixture="fixed-override"
          >
            <TweakerDisplay id="fixed-override-value" label="Boundary" value="Panel override" />
          </TweakerPanel>
        </TweakerProvider>
      </section>
    </main>
  )
}

function FixedPlacementControls() {
  const panel = useTweakerPanel('geometry-fixed-boundary')
  const fixedPosition =
    panel?.placement.mode === 'fixed' ? panel.placement.position : fixedPositions[0]
  const placementLabel = panel
    ? `${panel.placement.mode}:${'position' in panel.placement ? (panel.placement.position ?? '') : ''}`
    : 'unregistered'

  return (
    <div className="fixed top-1 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-white/15 bg-black/80 p-2 text-xs shadow-xl">
      <label htmlFor="fixed-placement">Fixed placement</label>
      <select
        id="fixed-placement"
        className="rounded border border-white/20 bg-zinc-900 px-2 py-1"
        value={fixedPosition}
        onChange={(event) => {
          panel?.setPlacement({
            mode: 'fixed',
            position: event.currentTarget.value as TweakerPanelFixedPosition,
          })
        }}
      >
        {fixedPositions.map((position) => (
          <option key={position} value={position}>
            {position}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="rounded border border-white/20 px-2 py-1"
        onClick={() => panel?.setPlacement({ mode: 'magnetic', position: 'top-left' })}
      >
        Magnetic
      </button>
      <button
        type="button"
        className="rounded border border-white/20 px-2 py-1"
        onClick={() => panel?.setPlacement({ mode: 'floating' })}
      >
        Floating
      </button>
      <output className="sr-only" data-runtime-placement>
        {placementLabel}
      </output>
    </div>
  )
}

function DragFixture() {
  return (
    <TweakerPanel
      store={tallPanelStore}
      title="Tall geometry panel"
      width={320}
      defaultPlacement="top-left"
      data-geometry-fixture="tall"
    >
      <TallContent prefix="tall" count={24} />
    </TweakerPanel>
  )
}

function PeerFixture() {
  return (
    <>
      <TweakerPanel
        store={tallPanelStore}
        title="Snap source"
        width={280}
        defaultPlacement="top-left"
        data-geometry-fixture="snap-source"
      >
        <TallContent prefix="snap" count={3} />
      </TweakerPanel>
      <TweakerPanel
        store={peerPanelStore}
        title="Snap peer"
        width={280}
        defaultPlacement="top-right"
        data-geometry-fixture="snap-peer"
      >
        <TallContent prefix="peer" count={3} />
      </TweakerPanel>
    </>
  )
}

function PanelExpansionFixture() {
  return (
    <TweakerPanel
      store={expansionPanelStore}
      title="Panel disclosure fixture"
      width={320}
      collapsible
      defaultCollapsed
      defaultPlacement="top-left"
      className="top-20 left-24"
      data-geometry-fixture="panel-expansion"
    >
      <TallContent prefix="panel-expansion" count={20} />
    </TweakerPanel>
  )
}

function GroupExpansionFixture() {
  return (
    <TweakerPanel
      store={expansionPanelStore}
      title="Group expansion fixture"
      width={320}
      defaultPlacement="top-left"
      className="top-20 left-24"
      data-geometry-fixture="groups"
    >
      <TweakerGroup id="outer-group" label="Outer group" defaultCollapsed>
        <TallContent prefix="outer" count={5} />
        <TweakerGroup id="nested-group" label="Nested group" defaultCollapsed>
          <TallContent prefix="nested" count={12} />
        </TweakerGroup>
      </TweakerGroup>
      <TweakerGroup id="second-group" label="Second group" defaultCollapsed>
        <TallContent prefix="second" count={8} />
      </TweakerGroup>
    </TweakerPanel>
  )
}

function BottomExpansionFixture() {
  return (
    <TweakerPanel
      store={bottomPanelStore}
      title="Bottom docked fixture"
      width={320}
      defaultPlacement="bottom-left"
      data-geometry-fixture="bottom"
    >
      <TweakerGroup id="bottom-group" label="Bottom group" defaultCollapsed>
        <TallContent prefix="bottom" count={18} />
      </TweakerGroup>
    </TweakerPanel>
  )
}

function CustomBottomFixture() {
  return (
    <TweakerPanel
      store={customBottomPanelStore}
      title="Custom bottom inset fixture"
      width={320}
      defaultPlacement="bottom-right"
      className="right-4 bottom-20"
      data-geometry-fixture="custom-bottom"
    >
      <TallContent prefix="custom-bottom" count={3} />
    </TweakerPanel>
  )
}

function ResponsiveConstraintFixture() {
  return (
    <TweakerPanel
      store={responsivePanelStore}
      title="Responsive constraint fixture"
      width={320}
      defaultPlacement="top-right"
      className="top-4 right-4 bottom-auto lg:top-auto lg:bottom-20 xl:bottom-4"
      data-geometry-fixture="responsive"
    >
      <TallContent prefix="responsive" count={3} />
    </TweakerPanel>
  )
}

function ChangingConstraintFixture() {
  const [placement, setPlacement] = useState<'bottom-large' | 'bottom-small' | 'top'>(
    'bottom-large',
  )
  const className =
    placement === 'bottom-large'
      ? 'right-4 bottom-20'
      : placement === 'bottom-small'
        ? 'right-4 bottom-4'
        : 'top-4 right-4 bottom-auto'

  return (
    <>
      <div className="fixed top-2 left-2 z-50 flex gap-2">
        <button type="button" onClick={() => setPlacement('bottom-small')}>
          Use small bottom inset
        </button>
        <button type="button" onClick={() => setPlacement('top')}>
          Use top constraint
        </button>
      </div>
      <TweakerPanel
        store={changingConstraintPanelStore}
        title="Changing constraint fixture"
        width={320}
        defaultPlacement="bottom-right"
        className={className}
        data-geometry-fixture="changing-constraint"
      >
        <TallContent prefix="changing-constraint" count={3} />
      </TweakerPanel>
    </>
  )
}

function KeyboardUnmountFixture() {
  const [mounted, setMounted] = useState(true)

  return (
    <>
      <button className="fixed top-2 left-2 z-50" type="button" onClick={() => setMounted(false)}>
        Unmount keyboard fixture
      </button>
      {mounted ? (
        <TweakerPanel
          store={keyboardUnmountPanelStore}
          title="Keyboard unmount fixture"
          width={320}
          defaultPlacement="top-right"
          data-geometry-fixture="keyboard-unmount"
        >
          <TweakerGroup id="first-group" label="First group">
            <TallContent prefix="first-group" count={1} />
          </TweakerGroup>
          <TweakerGroup id="second-group" label="Second group">
            <TallContent prefix="second-group" count={1} />
          </TweakerGroup>
        </TweakerPanel>
      ) : null}
    </>
  )
}

function CallerMaxHeightFixture() {
  return (
    <TweakerPanel
      store={cappedPanelStore}
      title="Caller max-height fixture"
      width={320}
      defaultPlacement="top-left"
      data-geometry-fixture="caller-max-height"
      style={{ maxHeight: 200 }}
    >
      <TallContent prefix="caller-max-height" count={24} />
    </TweakerPanel>
  )
}

function ClassMaxHeightFixture() {
  return (
    <TweakerPanel
      store={classCappedPanelStore}
      title="Class max-height fixture"
      width={320}
      defaultPlacement="top-left"
      className="max-h-48"
      data-geometry-fixture="class-max-height"
    >
      <TallContent prefix="class-max-height" count={24} />
    </TweakerPanel>
  )
}

function BottomMaxHeightFixture() {
  return (
    <TweakerPanel
      store={bottomCappedPanelStore}
      title="Bottom max-height fixture"
      width={320}
      defaultPlacement="bottom-left"
      data-geometry-fixture="bottom-max-height"
      style={{ maxHeight: 200 }}
    >
      <TallContent prefix="bottom-max-height" count={24} />
    </TweakerPanel>
  )
}

function BottomDragFixture() {
  return (
    <TweakerPanel
      store={bottomDragPanelStore}
      title="Bottom drag fixture"
      width={320}
      defaultPlacement="bottom-left"
      data-geometry-fixture="bottom-drag"
    >
      <TallContent prefix="bottom-drag" count={24} />
    </TweakerPanel>
  )
}

function TallContent({ count, prefix }: { count: number; prefix: string }) {
  return Array.from({ length: count }, (_, index) => (
    <TweakerDisplay
      id={`${prefix}-${index + 1}`}
      key={`${prefix}-${index + 1}`}
      label={`Geometry row ${index + 1}`}
      value={`Value ${index + 1}`}
    />
  ))
}

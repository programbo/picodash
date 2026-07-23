'use client'

import { useRef, useState } from 'react'
import {
  createPicodashPanelStore,
  PicodashDisplay,
  PicodashGroup,
  PicodashPanel,
  PicodashProvider,
  usePicodashPanel,
  usePicodashPanelStoreSelector,
  type PicodashPanelFixedPosition,
} from '@picodash/panel'

const storageKey = 'picodash-geometry-lab:panel-layout:v1'

const tallPanelStore = createPicodashPanelStore({ panelId: 'geometry-tall' })
const peerPanelStore = createPicodashPanelStore({ panelId: 'geometry-peer' })
const expansionPanelStore = createPicodashPanelStore({ panelId: 'geometry-expansion' })
const bottomPanelStore = createPicodashPanelStore({ panelId: 'geometry-bottom' })
const customBottomPanelStore = createPicodashPanelStore({ panelId: 'geometry-custom-bottom' })
const responsivePanelStore = createPicodashPanelStore({ panelId: 'geometry-responsive' })
const changingConstraintPanelStore = createPicodashPanelStore({
  panelId: 'geometry-changing-constraint',
})
export const keyboardUnmountPanelStore = createPicodashPanelStore({
  panelId: 'geometry-keyboard-unmount',
})
const cappedPanelStore = createPicodashPanelStore({ panelId: 'geometry-capped' })
const classCappedPanelStore = createPicodashPanelStore({ panelId: 'geometry-class-capped' })
const bottomCappedPanelStore = createPicodashPanelStore({ panelId: 'geometry-bottom-capped' })
const bottomDragPanelStore = createPicodashPanelStore({ panelId: 'geometry-bottom-drag' })
const fixedBoundaryPanelStore = createPicodashPanelStore({ panelId: 'geometry-fixed-boundary' })
const fixedOverridePanelStore = createPicodashPanelStore({ panelId: 'geometry-fixed-override' })
const reviewRegressionPanelStore = createPicodashPanelStore({
  panelId: 'geometry-review-regression',
})
const relativeConstraintPanelStore = createPicodashPanelStore({
  panelId: 'geometry-relative-constraint',
})

const fixedPositions = [
  'top-left',
  'bottom-left',
  'top-right',
  'bottom-right',
  'left',
  'right',
] as const satisfies readonly PicodashPanelFixedPosition[]

export function PanelGeometryLab({ fixture = 'drag' }: { fixture?: string }) {
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
      <PicodashProvider persistLayout storageKey={storageKey} theme="dark">
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
      </PicodashProvider>
    </main>
  )
}

function RelativeConstraintFixture() {
  const [boundaryElement, setBoundaryElement] = useState<HTMLElement | null>(null)

  return (
    <main
      id="main-content"
      className="dark bg-background text-foreground relative min-h-svh"
      data-panel-geometry-lab
      data-product-route="panel-geometry-lab"
    >
      <style>{`
        .review-probe-context {
          --review-panel-max-height: calc(100% - 40px);
        }
        .review-probe-context .review-relative-constraint {
          max-width: 50%;
          max-height: var(--review-panel-max-height);
        }
      `}</style>
      <section
        ref={setBoundaryElement}
        className="review-probe-context absolute top-20 left-[120px] h-[360px] w-[520px] border border-white/15"
        data-geometry-boundary="relative-constraints"
      >
        {boundaryElement ? (
          <PicodashProvider
            panelBoundary={boundaryElement}
            persistLayout={false}
            portalContainer={boundaryElement}
            theme="dark"
          >
            <PicodashPanel
              store={relativeConstraintPanelStore}
              title="Relative constraints"
              width={480}
              className="review-relative-constraint"
              defaultPlacement={{ mode: 'floating', position: 'bottom-right' }}
              data-geometry-fixture="relative-constraint"
            >
              <TallContent prefix="relative-constraint" count={32} />
            </PicodashPanel>
          </PicodashProvider>
        ) : null}
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
          <PicodashProvider persistLayout={false} portalContainer={portalContainer} theme="dark">
            <ReviewRegressionControls />
            <PicodashPanel
              store={reviewRegressionPanelStore}
              title="Review regression"
              width={320}
              className="review-panel-constraint"
              collapsible
              defaultPlacement={{ mode: 'fixed', position: 'left' }}
              data-geometry-fixture="review-regression"
            >
              <TallContent prefix="review-regression" count={24} />
            </PicodashPanel>
          </PicodashProvider>
        ) : null}
      </div>
    </main>
  )
}

function ReviewRegressionControls() {
  const panel = usePicodashPanel('geometry-review-regression')
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
        <PicodashProvider
          panelBoundary={mainBoundaryRef}
          persistLayout
          storageKey="picodash-geometry-lab:fixed-boundaries:v1"
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

          <PicodashPanel
            store={fixedBoundaryPanelStore}
            title="Provider boundary"
            width={300}
            collapsible
            defaultPlacement={{ mode: 'fixed', position: 'left' }}
            data-geometry-fixture="fixed-boundary"
          >
            <PicodashGroup id="fixed-start" label="Pinned start" pin="start">
              <PicodashDisplay id="fixed-start-value" label="Boundary" value="Provider" />
            </PicodashGroup>
            <TallContent prefix="fixed-auto" count={28} />
            <PicodashGroup id="fixed-end" label="Pinned end" pin="end">
              <PicodashDisplay id="fixed-end-value" label="Placement" value="Runtime" />
            </PicodashGroup>
          </PicodashPanel>

          <PicodashPanel
            store={fixedOverridePanelStore}
            title="Canvas boundary"
            width={240}
            collapsible
            boundary={canvasBoundaryRef}
            defaultPlacement={{ mode: 'fixed', position: 'bottom-right' }}
            data-geometry-fixture="fixed-override"
          >
            <PicodashDisplay id="fixed-override-value" label="Boundary" value="Panel override" />
          </PicodashPanel>
        </PicodashProvider>
      </section>
    </main>
  )
}

function FixedPlacementControls() {
  const panel = usePicodashPanel('geometry-fixed-boundary')
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
            position: event.currentTarget.value as PicodashPanelFixedPosition,
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
    <PicodashPanel
      store={tallPanelStore}
      title="Tall geometry panel"
      width={320}
      defaultPlacement="top-left"
      data-geometry-fixture="tall"
    >
      <TallContent prefix="tall" count={24} />
    </PicodashPanel>
  )
}

function PeerFixture() {
  return (
    <>
      <PicodashPanel
        store={tallPanelStore}
        title="Snap source"
        width={280}
        defaultPlacement="top-left"
        data-geometry-fixture="snap-source"
      >
        <TallContent prefix="snap" count={3} />
      </PicodashPanel>
      <PicodashPanel
        store={peerPanelStore}
        title="Snap peer"
        width={280}
        defaultPlacement="top-right"
        data-geometry-fixture="snap-peer"
      >
        <TallContent prefix="peer" count={3} />
      </PicodashPanel>
    </>
  )
}

function PanelExpansionFixture() {
  return (
    <PicodashPanel
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
    </PicodashPanel>
  )
}

function GroupExpansionFixture() {
  return (
    <PicodashPanel
      store={expansionPanelStore}
      title="Group expansion fixture"
      width={320}
      defaultPlacement="top-left"
      className="top-20 left-24"
      data-geometry-fixture="groups"
    >
      <PicodashGroup id="outer-group" label="Outer group" defaultCollapsed>
        <TallContent prefix="outer" count={5} />
        <PicodashGroup id="nested-group" label="Nested group" defaultCollapsed>
          <TallContent prefix="nested" count={12} />
        </PicodashGroup>
      </PicodashGroup>
      <PicodashGroup id="second-group" label="Second group" defaultCollapsed>
        <TallContent prefix="second" count={8} />
      </PicodashGroup>
    </PicodashPanel>
  )
}

function BottomExpansionFixture() {
  return (
    <PicodashPanel
      store={bottomPanelStore}
      title="Bottom docked fixture"
      width={320}
      defaultPlacement="bottom-left"
      data-geometry-fixture="bottom"
    >
      <PicodashGroup id="bottom-group" label="Bottom group" defaultCollapsed>
        <TallContent prefix="bottom" count={18} />
      </PicodashGroup>
    </PicodashPanel>
  )
}

function CustomBottomFixture() {
  return (
    <PicodashPanel
      store={customBottomPanelStore}
      title="Custom bottom inset fixture"
      width={320}
      defaultPlacement="bottom-right"
      className="right-4 bottom-20"
      data-geometry-fixture="custom-bottom"
    >
      <TallContent prefix="custom-bottom" count={3} />
    </PicodashPanel>
  )
}

function ResponsiveConstraintFixture() {
  return (
    <PicodashPanel
      store={responsivePanelStore}
      title="Responsive constraint fixture"
      width={320}
      defaultPlacement="top-right"
      className="top-4 right-4 bottom-auto lg:top-auto lg:bottom-20 xl:bottom-4"
      data-geometry-fixture="responsive"
    >
      <TallContent prefix="responsive" count={3} />
    </PicodashPanel>
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
      <PicodashPanel
        store={changingConstraintPanelStore}
        title="Changing constraint fixture"
        width={320}
        defaultPlacement="bottom-right"
        className={className}
        data-geometry-fixture="changing-constraint"
      >
        <TallContent prefix="changing-constraint" count={3} />
      </PicodashPanel>
    </>
  )
}

function KeyboardUnmountFixture() {
  const [mounted, setMounted] = useState(true)
  const rootOrder = usePicodashPanelStoreSelector(
    keyboardUnmountPanelStore,
    (state) => state.order.root,
  )

  return (
    <>
      <output data-keyboard-unmount-root-order hidden>
        {rootOrder.join(',')}
      </output>
      <button className="fixed top-2 left-2 z-50" type="button" onClick={() => setMounted(false)}>
        Unmount keyboard fixture
      </button>
      {mounted ? (
        <PicodashPanel
          store={keyboardUnmountPanelStore}
          title="Keyboard unmount fixture"
          width={320}
          defaultPlacement="top-right"
          data-geometry-fixture="keyboard-unmount"
        >
          <PicodashGroup id="first-group" label="First group">
            <TallContent prefix="first-group" count={1} />
          </PicodashGroup>
          <PicodashGroup id="second-group" label="Second group">
            <TallContent prefix="second-group" count={1} />
          </PicodashGroup>
        </PicodashPanel>
      ) : null}
    </>
  )
}

function CallerMaxHeightFixture() {
  return (
    <PicodashPanel
      store={cappedPanelStore}
      title="Caller max-height fixture"
      width={320}
      defaultPlacement="top-left"
      data-geometry-fixture="caller-max-height"
      style={{ maxHeight: 200 }}
    >
      <TallContent prefix="caller-max-height" count={24} />
    </PicodashPanel>
  )
}

function ClassMaxHeightFixture() {
  return (
    <PicodashPanel
      store={classCappedPanelStore}
      title="Class max-height fixture"
      width={320}
      defaultPlacement="top-left"
      className="max-h-48"
      data-geometry-fixture="class-max-height"
    >
      <TallContent prefix="class-max-height" count={24} />
    </PicodashPanel>
  )
}

function BottomMaxHeightFixture() {
  return (
    <PicodashPanel
      store={bottomCappedPanelStore}
      title="Bottom max-height fixture"
      width={320}
      defaultPlacement="bottom-left"
      data-geometry-fixture="bottom-max-height"
      style={{ maxHeight: 200 }}
    >
      <TallContent prefix="bottom-max-height" count={24} />
    </PicodashPanel>
  )
}

function BottomDragFixture() {
  return (
    <PicodashPanel
      store={bottomDragPanelStore}
      title="Bottom drag fixture"
      width={320}
      defaultPlacement="bottom-left"
      data-geometry-fixture="bottom-drag"
    >
      <TallContent prefix="bottom-drag" count={24} />
    </PicodashPanel>
  )
}

function TallContent({ count, prefix }: { count: number; prefix: string }) {
  return Array.from({ length: count }, (_, index) => (
    <PicodashDisplay
      id={`${prefix}-${index + 1}`}
      key={`${prefix}-${index + 1}`}
      label={`Geometry row ${index + 1}`}
      value={`Value ${index + 1}`}
    />
  ))
}

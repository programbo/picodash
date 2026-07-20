import {
  createTweakerPanelStore,
  TweakerDisplay,
  TweakerGroup,
  TweakerPanel,
  TweakerProvider,
} from 'tweaker'

const storageKey = 'tweaker-geometry-lab:panel-layout:v1'

const tallPanelStore = createTweakerPanelStore({ panelId: 'geometry-tall' })
const peerPanelStore = createTweakerPanelStore({ panelId: 'geometry-peer' })
const expansionPanelStore = createTweakerPanelStore({ panelId: 'geometry-expansion' })
const bottomPanelStore = createTweakerPanelStore({ panelId: 'geometry-bottom' })
const cappedPanelStore = createTweakerPanelStore({ panelId: 'geometry-capped' })

export function PanelGeometryLab() {
  const fixture = new URLSearchParams(window.location.search).get('fixture') ?? 'drag'

  return (
    <main
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
        {fixture === 'caller-max-height' ? <CallerMaxHeightFixture /> : null}
      </TweakerProvider>
    </main>
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

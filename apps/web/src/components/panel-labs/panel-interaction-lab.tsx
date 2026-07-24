'use client'

import { useState } from 'react'
import {
  ActionMenuItem,
  ActionMenuSeparator,
  ActionSubmenu,
  CollapseAllItem,
  CopySubmenu,
  createPicodashPanelStore,
  ExpandAllItem,
  ExportSubmenu,
  ImportItem,
  PicodashDisplay,
  PicodashGroup,
  PicodashPanel,
  PicodashProvider,
  PicodashText,
  usePicodashPanel,
  usePicodashPanelStoreSelector,
  ResetItem,
  type PicodashPanelPlacement,
} from '@picodash/panel'
import { usePicodashProviderSelector } from '@picodash/panel/advanced'

const storageKey = 'picodash-panel-interaction-lab:layout:v1'

const interactionStore = createPicodashPanelStore({
  initialValues: { label: 'Baseline' },
  panelId: 'interaction-dashlets',
})
const floatingStore = createPicodashPanelStore({ panelId: 'interaction-floating' })
const peerStore = createPicodashPanelStore({ panelId: 'interaction-peer' })
const fixedStore = createPicodashPanelStore({ panelId: 'interaction-fixed' })
const lifecycleStore = createPicodashPanelStore({
  initialValues: { note: 'Initial lifecycle note' },
  panelId: 'interaction-lifecycle',
})
const deregisterStore = createPicodashPanelStore({ panelId: 'interaction-deregister' })
const quietStore = createPicodashPanelStore({ panelId: 'interaction-no-actions' })

export function PanelInteractionLab({ fixture = 'all' }: { fixture?: string }) {
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null)
  const [deregisterMounted, setDeregisterMounted] = useState(true)
  const [lastClose, setLastClose] = useState('none')
  const [actionMarker, setActionMarker] = useState('ready')
  const shows = (name: string) => fixture === 'all' || fixture === name

  return (
    <main
      id="main-content"
      className="dark bg-background text-foreground relative min-h-[130dvh] overflow-hidden"
      data-interaction-fixture={fixture}
      data-panel-interaction-lab
      data-product-route="panel-interaction-lab"
    >
      <section className="relative z-10 max-w-xl p-6" data-interaction-fixture="overview">
        <p className="text-muted-foreground text-sm">Debugging-only panel interaction fixture</p>
        <h1 className="text-2xl font-medium">Panel interaction lab</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Placement, lifecycle, Dashlet order, disclosure, actions, themes, stacking, and persisted
          layout share one small, deterministic canvas.
        </p>
      </section>

      <div
        ref={setPortalContainer}
        className="absolute inset-0"
        data-interaction-portal-container
      />

      {portalContainer ? (
        <PicodashProvider
          persistLayout
          portalContainer={portalContainer}
          storageKey={storageKey}
          theme="dark"
        >
          {shows('all') ? (
            <InteractionControls
              deregisterMounted={deregisterMounted}
              lastClose={lastClose}
              onRegisterDeregister={() => setDeregisterMounted(true)}
            />
          ) : null}
          {shows('dashlets') ? (
            <InteractionDashletPanel
              actionMarker={actionMarker}
              onClear={() => setActionMarker('cleared')}
            />
          ) : null}
          {shows('floating') ? <FloatingPanel /> : null}
          {shows('peer') ? <PeerPanel /> : null}
          {shows('fixed') ? <FixedPanel /> : null}
          {shows('no-actions') ? <QuietPanel /> : null}
          {shows('lifecycle') ? (
            <LifecyclePanel onClose={() => setLastClose('interaction-lifecycle:hide')} />
          ) : null}
          {shows('deregister') && deregisterMounted ? (
            <DeregisterPanel
              onClose={() => {
                setLastClose('interaction-deregister:deregister')
                setDeregisterMounted(false)
              }}
            />
          ) : null}
        </PicodashProvider>
      ) : null}
    </main>
  )
}

function InteractionControls({
  deregisterMounted,
  lastClose,
  onRegisterDeregister,
}: {
  deregisterMounted: boolean
  lastClose: string
  onRegisterDeregister: () => void
}) {
  const deregister = usePicodashPanel('interaction-deregister')
  const floating = usePicodashPanel('interaction-floating')
  const lifecycle = usePicodashPanel('interaction-lifecycle')
  const interaction = usePicodashPanel('interaction-dashlets')
  const peer = usePicodashPanel('interaction-peer')

  return (
    <section
      className="fixed bottom-3 left-1/2 z-1100 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-wrap justify-center gap-2 rounded-lg border border-white/15 bg-zinc-950/90 p-2 text-xs shadow-xl"
      data-interaction-fixture="controllers"
    >
      <PlacementButton
        controller={floating}
        label="Make floating"
        placement={{ mode: 'floating', position: 'top-right' }}
      />
      <PlacementButton
        controller={floating}
        label="Make magnetic"
        placement={{ mode: 'magnetic', position: 'top' }}
      />
      <PlacementButton
        controller={floating}
        label="Dock floating panel"
        placement={{ mode: 'fixed', position: 'right' }}
      />
      <PanelLifecycleButtons controller={lifecycle} label="Lifecycle" />
      <PanelLifecycleButtons controller={deregister} label="Deregistration" />
      <button type="button" onClick={onRegisterDeregister} disabled={deregisterMounted}>
        Register deregistration panel
      </button>
      <button type="button" onClick={() => interaction?.activate()}>
        Activate Dashlets
      </button>
      <button type="button" onClick={() => peer?.activate()}>
        Activate peer
      </button>
      <PanelStateReadout label="Lifecycle panel registration" panel={lifecycle} />
      <PanelStateReadout label="Deregistration panel registration" panel={deregister} />
      <PanelGeometryReadout label="Snap peer geometry" panelId="interaction-peer" />
      <PanelLayoutReadout label="Floating saved layout" panelId="interaction-floating" />
      <output aria-label="Last panel close" className="sr-only">
        {lastClose}
      </output>
    </section>
  )
}

function PanelStateReadout({
  label,
  panel,
}: {
  label: string
  panel: ReturnType<typeof usePicodashPanel>
}) {
  return (
    <output aria-label={label} className="sr-only">
      {panel ? (panel.visible ? 'visible' : 'hidden') : 'unregistered'}
    </output>
  )
}

function PanelLayoutReadout({ label, panelId }: { label: string; panelId: string }) {
  const layout = usePicodashProviderSelector((state) => state.panelLayouts[panelId])

  return (
    <output aria-label={label} className="sr-only">
      {layout ? JSON.stringify(layout) : 'default'}
    </output>
  )
}

function PanelGeometryReadout({ label, panelId }: { label: string; panelId: string }) {
  const rect = usePicodashProviderSelector((state) => state.panelRects[panelId])

  return (
    <output aria-label={label} className="sr-only">
      {rect ? JSON.stringify(rect) : 'unmeasured'}
    </output>
  )
}

function PlacementButton({
  controller,
  label,
  placement,
}: {
  controller: ReturnType<typeof usePicodashPanel>
  label: string
  placement: PicodashPanelPlacement
}) {
  return (
    <button type="button" onClick={() => controller?.setPlacement(placement)}>
      {label}
    </button>
  )
}

function PanelLifecycleButtons({
  controller,
  label,
}: {
  controller: ReturnType<typeof usePicodashPanel>
  label: string
}) {
  return (
    <span className="flex gap-1" data-interaction-controller={label.toLowerCase()}>
      <button type="button" onClick={() => controller?.show()}>
        Show {label}
      </button>
      <button type="button" onClick={() => controller?.hide()}>
        Hide {label}
      </button>
      <button type="button" onClick={() => controller?.toggle()}>
        Toggle {label}
      </button>
      <button type="button" onClick={() => controller?.setVisible(false)}>
        Set {label} hidden
      </button>
      <button type="button" onClick={() => controller?.activate()}>
        Activate {label}
      </button>
    </span>
  )
}

function InteractionDashletPanel({
  actionMarker,
  onClear,
}: {
  actionMarker: string
  onClear: () => void
}) {
  return (
    <PicodashPanel
      store={interactionStore}
      title="Interaction Dashlets"
      width={330}
      defaultPlacement="top-left"
      theme="light"
      data-interaction-fixture="dashlets"
      actionMenu={
        <ActionSubmenu label="Lab actions" triggerLabel="Open lab actions">
          <ExpandAllItem />
          <CollapseAllItem />
          <ActionMenuSeparator />
          <CopySubmenu />
          <ExportSubmenu />
          <ImportItem />
          <ResetItem />
          <ActionMenuSeparator />
          <ActionMenuItem
            destructive={[
              'This changes only the lab marker.',
              'Clear interaction marker?',
              'Clear marker',
            ]}
            label="Clear marker…"
            onAction={onClear}
          />
        </ActionSubmenu>
      }
    >
      <PicodashGroup id="interaction-core" label="Core Dashlets" collapsible>
        <PicodashText field="label" label="Label" defaultValue="Baseline" />
        <PicodashDisplay id="interaction-alpha" label="Alpha" value="First nested Dashlet" />
        <PicodashDisplay id="interaction-beta" label="Beta" value="Second nested Dashlet" />
      </PicodashGroup>
      <PicodashGroup id="interaction-layout" label="Layout Dashlets" collapsible>
        <PicodashDisplay id="interaction-gamma" label="Gamma" value="Third nested Dashlet" />
        <PicodashDisplay id="interaction-delta" label="Delta" value="Fourth nested Dashlet" />
      </PicodashGroup>
      <PicodashDisplay id="interaction-root-status" label="Root status" value={actionMarker} />
      <DashletStateReadouts />
    </PicodashPanel>
  )
}

function DashletStateReadouts() {
  const rootOrder = usePicodashPanelStoreSelector(
    interactionStore,
    (state) => state.order.root?.join(',') ?? '',
  )
  const coreOrder = usePicodashPanelStoreSelector(
    interactionStore,
    (state) => state.order['interaction-core']?.join(',') ?? '',
  )
  const activePointerReorder = usePicodashPanelStoreSelector(
    interactionStore,
    (state) => state.interaction.draggingId ?? 'none',
  )

  return (
    <div className="sr-only">
      <output aria-label="Root Dashlet order">{rootOrder}</output>
      <output aria-label="Core Dashlet order">{coreOrder}</output>
      <output aria-label="Active pointer reorder">{activePointerReorder}</output>
    </div>
  )
}

function FloatingPanel() {
  const panel = usePicodashPanel('interaction-floating')
  const placement = panel
    ? `${panel.placement.mode}:${panel.placement.position ?? ''}`
    : 'unregistered'

  return (
    <PicodashPanel
      store={floatingStore}
      title="Floating interaction panel"
      width={250}
      defaultPlacement="top-right"
      data-interaction-fixture="floating"
    >
      <PicodashDisplay id="floating-status" label="Placement" value={placement} />
    </PicodashPanel>
  )
}

function PeerPanel() {
  return (
    <PicodashPanel
      store={peerStore}
      title="Snap peer"
      width={250}
      defaultPlacement={{ mode: 'magnetic', position: 'top' }}
      data-interaction-fixture="peer"
      actionMenu={[<ActionMenuItem key="ping-peer" label="Ping peer" />]}
    >
      <PicodashDisplay id="peer-status" label="Role" value="Peer snapping target" />
    </PicodashPanel>
  )
}

function FixedPanel() {
  return (
    <PicodashPanel
      store={fixedStore}
      title="Fixed interaction panel"
      width={250}
      collapsible
      defaultPlacement={{ mode: 'fixed', position: 'bottom-left' }}
      data-interaction-fixture="fixed"
    >
      <PicodashDisplay id="fixed-status" label="Dock" value="Retract and reopen" />
    </PicodashPanel>
  )
}

function LifecyclePanel({ onClose }: { onClose: () => void }) {
  return (
    <PicodashPanel
      store={lifecycleStore}
      title="Lifecycle panel"
      width={240}
      close
      defaultVisible={false}
      defaultPlacement="bottom-left"
      onClose={onClose}
      data-interaction-fixture="lifecycle"
    >
      <PicodashText field="note" label="Lifecycle note" defaultValue="Initial lifecycle note" />
    </PicodashPanel>
  )
}

function DeregisterPanel({ onClose }: { onClose: () => void }) {
  return (
    <PicodashPanel
      store={deregisterStore}
      title="Deregistration panel"
      width={240}
      close={{ behavior: 'deregister' }}
      defaultVisible={false}
      defaultPlacement="bottom-right"
      onClose={onClose}
      data-interaction-fixture="deregister"
    >
      <PicodashDisplay id="deregister-status" label="Registration" value="Transient" />
    </PicodashPanel>
  )
}

function QuietPanel() {
  return (
    <PicodashPanel
      store={quietStore}
      title="No actions panel"
      width={220}
      actionMenu={false}
      defaultPlacement="bottom-right"
      data-interaction-fixture="no-actions"
    >
      <PicodashDisplay id="quiet-status" label="Menu" value="Hidden" />
    </PicodashPanel>
  )
}

'use client'

import { createPicodashStore, type PicodashStore } from '@picodash/store'
import {
  PicodashDisplay,
  PicodashPanel,
  PicodashSegmented,
  usePicodashPanel,
  type PicodashPanelPlacement,
} from '@picodash/panel'

type PlacementValues = {
  mode: 'floating' | 'fixed' | 'hybrid'
  boundary: string
}

export function createPlacementStore() {
  return createPicodashStore<PlacementValues>({
    fields: {
      mode: { defaultValue: 'hybrid' },
      boundary: { defaultValue: 'Specimen host element' },
    },
    panelId: 'contract-placement-primary',
  })
}

export function PlacementSpecimen({ store }: { readonly store: PicodashStore<PlacementValues> }) {
  const panel = usePicodashPanel(store.getState().panelId)

  function updatePlacement(mode: string) {
    const placement: PicodashPanelPlacement =
      mode === 'fixed'
        ? { disposition: { kind: 'docked', position: 'bottom-right' }, mode: 'fixed' }
        : mode === 'floating'
          ? { disposition: { kind: 'snapped', position: 'bottom-right' }, mode: 'floating' }
          : { disposition: { kind: 'docked', position: 'bottom-right' }, mode: 'hybrid' }
    panel?.setPlacement(placement)
  }

  return (
    <PicodashPanel
      close
      collapsible
      data-contract-lab-primary-panel
      defaultPlacement={{
        disposition: { kind: 'docked', position: 'bottom-right' },
        mode: 'hybrid',
      }}
      store={store}
      title="Placement Contract"
      width={310}
    >
      <PicodashSegmented
        field={store.fields.mode}
        label="Placement mode"
        options={['floating', 'fixed', 'hybrid']}
        onValueChange={(value) => updatePlacement(value)}
      />
      <PicodashDisplay field={store.fields.boundary} label="Boundary" />
    </PicodashPanel>
  )
}

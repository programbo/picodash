'use client'

import { createPicodashStore, type PicodashStore } from '@picodash/store'
import {
  PicodashDisplay,
  PicodashNumber,
  PicodashPanel,
  PicodashSwitch,
  PicodashText,
} from '@picodash/picodash'

type InteractionValues = {
  enabled: boolean
  exposure: number
  frameHealth: string
  note: string
}

export function createInteractionStore() {
  return createPicodashStore<InteractionValues>({
    fields: {
      enabled: { defaultValue: true },
      exposure: { defaultValue: 1.2 },
      frameHealth: { defaultValue: '59.8 FPS · stable' },
      note: { defaultValue: 'Keyboard and pointer parity' },
    },
    panelId: 'contract-interaction-primary',
  })
}

export function InteractionSpecimen({
  onDeregister,
  store,
}: {
  readonly onDeregister: () => void
  readonly store: PicodashStore<InteractionValues>
}) {
  return (
    <PicodashPanel
      close={{ behavior: 'deregister' }}
      collapsible
      data-contract-lab-primary-panel
      defaultPlacement={{
        disposition: { kind: 'snapped', position: 'top-right' },
        mode: 'floating',
      }}
      store={store}
      title="Interaction Contract"
      width={320}
      onClose={({ behavior }) => {
        if (behavior === 'deregister') onDeregister()
      }}
    >
      <PicodashSwitch field={store.fields.enabled} label="Pinned input" pin="start" />
      <PicodashNumber field={store.fields.exposure} label="Exposure" min={0} max={4} step={0.1} />
      <PicodashDisplay field={store.fields.frameHealth} label="Frame health" />
      <PicodashText field={store.fields.note} label="Recovery action" />
    </PicodashPanel>
  )
}

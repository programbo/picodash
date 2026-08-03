'use client'

import type { ReactNode } from 'react'
import type { PicodashDiagnosticChannel } from '@picodash/store'
import type { PicodashPanelIdentity } from '@picodash/picodash'
import type { ContractLabPresetId } from '@lab/lib/contract-lab'
import { CompositionSpecimen, createCompositionStore } from './specimens/composition'
import { createDocumentStore, DocumentSpecimen } from './specimens/documents'
import { createInteractionStore, InteractionSpecimen } from './specimens/interaction'
import { createOverlayStore, OverlaySpecimen } from './specimens/overlays'
import { createPlacementStore, PlacementSpecimen } from './specimens/placement'
import { createThemeStore, ThemeSpecimen } from './specimens/themes'

export interface ContractLabSpecimenStore extends PicodashPanelIdentity {
  readonly diagnostics: PicodashDiagnosticChannel
}

export interface ContractLabSpecimenBundle {
  readonly primaryStore: ContractLabSpecimenStore
  readonly peerStore?: ContractLabSpecimenStore
  render(options: { readonly onDeregister: () => void }): ReactNode
}

export function createContractLabSpecimenBundle(
  preset: ContractLabPresetId,
): ContractLabSpecimenBundle {
  switch (preset) {
    case 'placement': {
      const store = createPlacementStore()
      return {
        primaryStore: store,
        render: () => <PlacementSpecimen store={store} />,
      }
    }
    case 'interaction': {
      const store = createInteractionStore()
      return {
        primaryStore: store,
        render: ({ onDeregister }) => (
          <InteractionSpecimen store={store} onDeregister={onDeregister} />
        ),
      }
    }
    case 'composition': {
      const store = createCompositionStore()
      return {
        primaryStore: store,
        render: () => <CompositionSpecimen store={store} />,
      }
    }
    case 'overlays': {
      const store = createOverlayStore()
      return {
        primaryStore: store,
        render: () => <OverlaySpecimen store={store} />,
      }
    }
    case 'documents': {
      const store = createDocumentStore()
      const peerStore = createDocumentStore('contract-documents-peer')
      return {
        primaryStore: store,
        peerStore,
        render: () => <DocumentSpecimen peerStore={peerStore} store={store} />,
      }
    }
    case 'themes': {
      const store = createThemeStore()
      return {
        primaryStore: store,
        render: () => <ThemeSpecimen store={store} />,
      }
    }
  }
}

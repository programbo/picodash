'use client'

import { useState } from 'react'
import {
  createPicodashStore,
  parsePicodashPanelDocument,
  serializePicodashPanelValues,
  type PicodashPanelImportAnalysis,
  type PicodashStore,
} from '@picodash/store'
import { PicodashItem, PicodashPanel } from '@picodash/panel'
import * as Dashlet from '@picodash/panel/dashlet'
import { Button, Textarea } from '@picodash/panel/ui'

type DocumentValues = {
  exposure: number
  quality: 'draft' | 'balanced' | 'final'
  summary: string
}

function createDocumentFields() {
  return {
    exposure: {
      defaultValue: 1.2,
      parse: (input: unknown) =>
        typeof input === 'number' && input >= 0 && input <= 4
          ? ({ output: { value: input }, success: true } as const)
          : typeof input === 'number' && Number.isFinite(input)
            ? ({
                errors: ['Exposure must be between 0 and 4.'],
                repair: { value: Math.min(4, Math.max(0, input)) },
                success: false,
              } as const)
            : ({ errors: ['Exposure must be between 0 and 4.'], success: false } as const),
    },
    quality: {
      defaultValue: 'balanced' as const,
      validate: (value: DocumentValues['quality']) =>
        ['draft', 'balanced', 'final'].includes(value)
          ? ({ success: true } as const)
          : ({ errors: ['Unknown render quality.'], success: false } as const),
    },
    summary: { defaultValue: 'Primary specimen' },
  }
}

export function createDocumentStore(panelId = 'contract-documents-primary') {
  return createPicodashStore<DocumentValues>({
    fields: createDocumentFields(),
    panelId,
  })
}

export function DocumentSpecimen({
  peerStore,
  store,
}: {
  readonly peerStore: PicodashStore<DocumentValues>
  readonly store: PicodashStore<DocumentValues>
}) {
  return (
    <>
      <PicodashPanel
        close
        collapsible
        data-contract-lab-primary-panel
        defaultPlacement={{
          disposition: { kind: 'snapped', position: 'top-right' },
          mode: 'floating',
        }}
        store={store}
        title="Document Contract"
        width={350}
      >
        <DocumentDashlet store={store} />
      </PicodashPanel>
      <PicodashPanel
        close
        data-contract-lab-peer-panel
        defaultPlacement={{
          disposition: { kind: 'snapped', position: 'bottom-left' },
          mode: 'floating',
        }}
        store={peerStore}
        title="Isolation Peer"
        width={260}
      >
        <PicodashItem
          fields={{
            exposure: { field: peerStore.fields.exposure, mode: 'display' },
            summary: { field: peerStore.fields.summary, mode: 'display' },
          }}
          id="peer-values"
          label="Independent values"
          contentLayout="full"
        >
          {({ fields }) => (
            <Dashlet.DataList>
              <Dashlet.DataRow>
                <Dashlet.DataLabel>Exposure</Dashlet.DataLabel>
                <Dashlet.DataValue>{(fields.exposure.value ?? 0).toFixed(1)}</Dashlet.DataValue>
              </Dashlet.DataRow>
              <Dashlet.DataRow>
                <Dashlet.DataLabel>Owner</Dashlet.DataLabel>
                <Dashlet.DataValue>{fields.summary.value}</Dashlet.DataValue>
              </Dashlet.DataRow>
            </Dashlet.DataList>
          )}
        </PicodashItem>
      </PicodashPanel>
    </>
  )
}

function DocumentDashlet({ store }: { readonly store: PicodashStore<DocumentValues> }) {
  const validDocument = '{\n  "exposure": 1.2,\n  "quality": "balanced"\n}'
  const [draft, setDraft] = useState(validDocument)
  const [message, setMessage] = useState('Awaiting operation')
  const [repair, setRepair] = useState<
    Extract<PicodashPanelImportAnalysis<DocumentValues>, { status: 'repair' }> | undefined
  >()
  const invalid = message.startsWith('PICODASH_')

  function applyDraft() {
    let parsed: unknown
    try {
      parsed = parsePicodashPanelDocument(draft, 'json')
    } catch {
      setMessage('PICODASH_DOCUMENT_INVALID · host preserved')
      return
    }
    const analysis = store.getState().analyzePanelDocument(parsed)
    if (analysis.status === 'invalid') {
      setRepair(undefined)
      setMessage('PICODASH_DOCUMENT_INVALID · host preserved')
      return
    }
    if (analysis.status === 'repair') {
      setRepair(analysis)
      setMessage('PICODASH_REPAIR_REQUIRED · review before apply')
      return
    }
    setRepair(undefined)
    const result = store.getState().applyPanelImport(analysis)
    setMessage(result.success ? 'Applied atomically' : 'PICODASH_DOCUMENT_INVALID · host preserved')
  }

  return (
    <PicodashItem
      fields={{
        exposure: store.fields.exposure,
        quality: store.fields.quality,
        summary: { field: store.fields.summary, mode: 'display' },
      }}
      id="panel-document"
      label="Panel document"
      contentLayout="full"
    >
      <Dashlet.Frame>
        <Dashlet.Body>
          <Textarea
            aria-label="Panel document"
            className="min-h-40 font-mono"
            spellCheck={false}
            value={draft}
            onChange={(event) => {
              setDraft(event.currentTarget.value)
              setRepair(undefined)
              setMessage('Awaiting operation')
            }}
          />
        </Dashlet.Body>
        <Dashlet.Toolbar>
          <Button size="sm" variant="outline" onPress={applyDraft}>
            Validate + apply
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onPress={() => {
              setDraft('{ "exposure": "invalid"')
              setRepair(undefined)
              setMessage('Awaiting operation')
            }}
          >
            Load invalid draft
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onPress={() => {
              setDraft('{ "exposure": 4.5, "quality": "final" }')
              setRepair(undefined)
              setMessage('Awaiting operation')
            }}
          >
            Load repair draft
          </Button>
          {repair ? (
            <Button
              size="sm"
              variant="outline"
              onPress={() => {
                const result = store.getState().applyPanelImport(repair)
                setRepair(undefined)
                setMessage(result.success ? 'Applied reviewed repair' : 'PICODASH_REPAIR_STALE')
              }}
            >
              Apply reviewed repair
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            onPress={() => {
              store.getState().resetRegisteredFields()
              setDraft(serializePicodashPanelValues(store.getState(), 'json'))
              setRepair(undefined)
              setMessage('Reset registered values')
            }}
          >
            Reset document
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onPress={() => {
              setDraft(serializePicodashPanelValues(store.getState(), 'json'))
              setRepair(undefined)
              setMessage('Exported canonical JSON')
            }}
          >
            Export document
          </Button>
        </Dashlet.Toolbar>
        <Dashlet.Status tone={invalid ? 'danger' : 'neutral'}>{message}</Dashlet.Status>
      </Dashlet.Frame>
    </PicodashItem>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'

import { DocsCodeBlock, DocsShell } from '@/components/docs/docs-shell'

export const metadata: Metadata = {
  title: 'Compound dashlets',
  description: 'Compose multiple fields into one reusable, observable dashlet component.',
  alternates: {
    canonical: '/docs/guides/compound-dashlets',
  },
}

const anatomyGuidance = [
  'Choose one <code>id</code> for one registration boundary.',
  "Map each alias to a typed source with <code>field</code> and optional <code>mode: 'display'</code>.",
  'Drive all related actions from one child render and expose one reset path.',
] as const

const compoundDashletSource = `import { createPicodashStore } from '@picodash/store'
import { PicodashItem, PicodashPanel } from '@picodash/panel'
import * as Dashlet from '@picodash/panel/dashlet'
import { Button, Meter, MeterFill, MeterTrack } from '@picodash/panel/ui'
import { serializePicodashPanelValues } from '@picodash/store'
import '@picodash/panel/style.css'

const mediaStore = createPicodashStore({
  panelId: 'media-transport-compound',
  fields: {
    currentTime: { defaultValue: 0 },
    duration: { defaultValue: 120 },
    loop: { defaultValue: false },
    mode: { defaultValue: 'preview' },
  },
})

export function MediaTransportCompound() {
  return (
    <PicodashPanel store={mediaStore} title="Media transport" width={360} close collapsible>
      <PicodashItem
        contentLayout="full"
        fields={{
          currentTime: mediaStore.fields.currentTime,
          duration: { field: mediaStore.fields.duration, mode: 'display' },
          loop: mediaStore.fields.loop,
          mode: { field: mediaStore.fields.mode, mode: 'display' },
        }}
        id="media-transport-compound"
        label="Media transport"
      >
        {({ fields, reset }) => {
          const currentTime = fields.currentTime.value ?? 0
          const duration = fields.duration.value ?? 1
          const loop = fields.loop.value ?? false
          const mode = fields.mode.value ?? 'preview'
          const ratio = (currentTime / duration) * 100

          return (
            <Dashlet.Frame>
              <Dashlet.Header>
                <Dashlet.Heading>Interview walk-through</Dashlet.Heading>
                <Dashlet.Description>{mode} mode • {loop ? 'Loop on end' : 'One pass'}</Dashlet.Description>
              </Dashlet.Header>
              <Dashlet.Body className="grid gap-(--picodash-space-3)">
                <Meter value={ratio} maxValue={100} aria-label="Playback position">
                  <div className="flex justify-between">
                    <span>{currentTime}</span>
                    <span>{duration}</span>
                  </div>
                  <MeterTrack>
                    <MeterFill />
                  </MeterTrack>
                </Meter>
                <Dashlet.Status tone={currentTime >= duration ? 'warning' : 'neutral'}>
                  <Dashlet.StatusIndicator tone={currentTime >= duration ? 'warning' : 'neutral'} />
                  {currentTime >= duration ? 'Buffer complete' : 'Live transport'}
                </Dashlet.Status>
              </Dashlet.Body>
              <Dashlet.Footer>
                <Button size="sm" variant="outline" onPress={reset}>
                  Reset transport
                </Button>
              </Dashlet.Footer>
            </Dashlet.Frame>
          )
        }}
      </PicodashItem>
    </PicodashPanel>
  )
}

export function exportMediaState(store: typeof mediaStore) {
  return serializePicodashPanelValues(store.getState(), 'json')
}`

const validationSource = `import { PicodashErrorCode } from '@picodash/store'
import { PICODASH_ERROR_CODES } from '@picodash/store'

const expectedCodes = new Set<PicodashErrorCode>([
  PICODASH_ERROR_CODES.INVALID_COMPOUND_MAP,
  PICODASH_ERROR_CODES.CONFLICTING_BINDING,
  PICODASH_ERROR_CODES.INCOMPATIBLE_FIELD_DASHLET,
])`

export default function CompoundDashletsPage() {
  return (
    <DocsShell title="Guide: compound dashlets" withProductRoute={false}>
      <p>
        Use compound Dashlets when one semantic surface owns several related fields and should share
        one boundary for reset, visibility, status, and ordering.
      </p>

      <h2>Anatomy and state variants</h2>
      <ul>
        {anatomyGuidance.map((line) => (
          <li key={line}>
            <span dangerouslySetInnerHTML={{ __html: line }} />
          </li>
        ))}
      </ul>

      <h2>State-binding contract</h2>
      <p>
        In compound maps, every entry can be writable or display-only. Display-only aliases cannot
        call
        <code> setInput</code>; they remain read-only and still participate in the same frame.
      </p>
      <p>Reset is atomic at the item boundary and includes writable aliases from the same map.</p>

      <DocsCodeBlock label="Compound Dashlet" source={compoundDashletSource} />

      <h2>Import/export and repair flow</h2>
      <p>
        Keep import/export on the store adapter layer. Use panel document helpers for validation and
        apply steps so field-level repairs stay deterministic and host snapshots remain
        authoritative.
      </p>

      <DocsCodeBlock label="Compound diagnostics focus" source={validationSource} />

      <h2>When to use a compound Dashlet</h2>
      <ul>
        <li>Several typed fields belong to one semantic unit and should move together.</li>
        <li>Status, trend, and progress need one readout boundary and one reorder node.</li>
        <li>You need one reset button that affects all writable bindings consistently.</li>
      </ul>

      <h2>Escalate to grouping when</h2>
      <ul>
        <li>
          <Link href="/docs/guides/custom-dashlets">single custom</Link> is not enough, but sibling
          controls do need independent reset order, focus, or visibility.
        </li>
        <li>
          The UI is better represented as separate Dashlets with distinct streaming or action
          patterns.
        </li>
      </ul>
    </DocsShell>
  )
}

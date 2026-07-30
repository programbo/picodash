import type { Metadata } from 'next'
import Link from 'next/link'

import { DocsCodeBlock, DocsShell } from '@/components/docs/docs-shell'

export const metadata: Metadata = {
  title: 'Custom dashlets',
  description: 'Create custom dashlets with semantic wrappers and accessible labels.',
  alternates: {
    canonical: '/docs/guides/custom-dashlets',
  },
}

const singleDashletDecision = [
  'Pick a built-in Dashlet when labels, input shape, and status states are already covered.',
  'Use one custom single-value Dashlet when presentation needs one extra shape or status summary.',
  'Prefer compound Dashlets only when the control requires more than one value in one ordering boundary.',
  'Use a Group when controls must be reordered, hidden, or reset independently.',
] as const

const customDashletSource = `import { createPicodashStore } from '@picodash/store'
import { PicodashItem, PicodashPanel } from '@picodash/panel'
import * as Dashlet from '@picodash/panel/dashlet'
import { Button } from '@picodash/panel/ui'
import '@picodash/panel/style.css'

const qualityStore = createPicodashStore({
  panelId: 'signal-quality',
  fields: {
    quality: { defaultValue: 75 },
  },
})

export function SignalQualityDashlet() {
  return (
    <PicodashPanel store={qualityStore} title="Signal quality">
      <PicodashItem
        contentLayout="full"
        field={qualityStore.fields.quality}
        id="signal-quality-readout"
        label="Signal quality"
      >
        {(item) => {
          const value = item.value ?? 0
          const status = value > 85 ? 'good' : value > 60 ? 'ok' : 'warn'

          return (
            <Dashlet.Frame>
              <Dashlet.Header>
                <Dashlet.Heading>Signal quality</Dashlet.Heading>
                <Dashlet.Description>Single source of truth, single registration boundary.</Dashlet.Description>
              </Dashlet.Header>
              <Dashlet.Body className="grid gap-(--picodash-space-2)">
                <Dashlet.Metric align="stretch">
                  <Dashlet.MetricLabel>Current score</Dashlet.MetricLabel>
                  <Dashlet.MetricValue>{value}</Dashlet.MetricValue>
                </Dashlet.Metric>
                <Dashlet.Status tone={status === 'good' ? 'success' : status === 'ok' ? 'warning' : 'danger'}>
                  <Dashlet.StatusIndicator
                    tone={status === 'good' ? 'success' : status === 'ok' ? 'warning' : 'danger'}
                  />
                  {status === 'good' ? 'Good signal' : status === 'ok' ? 'Borderline' : 'Degraded'}
                </Dashlet.Status>
              </Dashlet.Body>
              <Dashlet.Footer>
                <Button size="sm" variant="ghost" onPress={() => item.setInput(100)}>
                  Reset sample quality
                </Button>
              </Dashlet.Footer>
            </Dashlet.Frame>
          )
        }}
      </PicodashItem>
    </PicodashPanel>
  )
}`

const anatomySource = `import * as Dashlet from '@picodash/panel/dashlet'
import { PicodashItem } from '@picodash/panel'

<PicodashItem
  id="render-quality"
  label="Render quality"
  field={qualityStore.fields.quality}
>
  {(item) => (
    <Dashlet.Frame>
      <Dashlet.Header>
        <Dashlet.Heading>Render quality</Dashlet.Heading>
      </Dashlet.Header>
      <Dashlet.Body>
        <Dashlet.MetricValue>{item.value}</Dashlet.MetricValue>
      </Dashlet.Body>
    </Dashlet.Frame>
  )}
</PicodashItem>`

export default function CustomDashletsPage() {
  return (
    <DocsShell title="Guide: custom dashlets" withProductRoute={false}>
      <p>
        A custom Dashlet can stay lightweight: keep all values in store, then render your own
        semantic structure inside the item body.
      </p>

      <h2>Decision sequence</h2>
      <ul>
        {singleDashletDecision.map((decision) => (
          <li key={decision}>{decision}</li>
        ))}
      </ul>

      <h2>Anatomy baseline</h2>
      <DocsCodeBlock label="Single-value Dashlet anatomy" source={anatomySource} />
      <p>
        A custom single-value Dashlet uses{' '}
        <code>
          {'{'}fields.xyz{'}'}
        </code>{' '}
        and inherits the same accessibility contract as built-in controls when labels and live
        values are explicit.
      </p>

      <h2>Canonical single-dashlet implementation</h2>
      <DocsCodeBlock label="Single custom dashlet" source={customDashletSource} />

      <h2>State shape</h2>
      <p>
        Use one <code>createPicodashStore</code> field record per panel. A single custom Dashlet
        does not require <code>fields</code>; the <code>field</code> prop is the binding route.
      </p>

      <h2>When to escalate</h2>
      <ul>
        <li>
          Use <Link href="/docs/guides/compound-dashlets">compound Dashlets</Link> when one unit
          needs multiple fields with one reset, visibility, and ordering boundary.
        </li>
        <li>
          Use <Link href="/docs/concepts/dashlet-anatomy">grouped Dashlets</Link> when control items
          need independent visibility, reset, and status.
        </li>
      </ul>

      <h2>Use /dashlet and /ui explicitly</h2>
      <ul>
        <li>
          Use <code>@picodash/panel/dashlet</code> for structural regions, labels, status, and
          states.
        </li>
        <li>
          Use <code>@picodash/panel/ui</code> for lower-level interactive primitives and form
          controls.
        </li>
        <li>
          Do not couple custom visuals to host framework styles; inherit <code>--picodash-*</code>{' '}
          tokens.
        </li>
      </ul>
    </DocsShell>
  )
}

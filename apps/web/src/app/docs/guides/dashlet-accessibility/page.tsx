import type { Metadata } from 'next'

import { DocsCodeBlock, DocsShell } from '@/components/docs/docs-shell'

export const metadata: Metadata = {
  title: 'Dashlet accessibility',
  description: 'Accessibility and contrast guidance for Picodash panels and dashlets.',
  alternates: {
    canonical: '/docs/guides/dashlet-accessibility',
  },
}

const labelSnippet = `import { createPicodashStore } from '@picodash/store'
import { PicodashItem } from '@picodash/panel'
import { Label, Switch, Textarea, ToggleGroup, ToggleGroupItem } from '@picodash/panel/ui'
import * as Dashlet from '@picodash/panel/dashlet'

const modeStore = createPicodashStore({
  panelId: 'accessibility-mode',
  fields: {
    mode: { defaultValue: 'preview' },
    enabled: { defaultValue: false },
    notes: { defaultValue: '' },
  },
})

function AccessibilityModeDashlet() {
  return (
    <PicodashItem
      contentLayout="full"
      fields={{
        enabled: modeStore.fields.enabled,
        mode: { field: modeStore.fields.mode, mode: 'display' },
        notes: { field: modeStore.fields.notes, mode: 'display' },
      }}
      id="accessibility-mode"
      label="Debug mode"
    >
      {({ fields }) => {
        const mode = fields.mode.value ?? 'preview'
        return (
          <Dashlet.Frame>
            <Dashlet.Header>
              <Dashlet.Heading>Mode and notes</Dashlet.Heading>
            </Dashlet.Header>
            <Dashlet.Body className="grid gap-(--picodash-space-3)">
              <div className="grid gap-(--picodash-space-1)">
                <Label id={fields.enabled.labelId} htmlFor={fields.enabled.inputId}>
                  Enable diagnostics
                </Label>
                <Switch
                  aria-labelledby={fields.enabled.labelId}
                  id={fields.enabled.inputId}
                  isSelected={fields.enabled.value ?? false}
                  onChange={fields.enabled.setInput}
                />
              </div>

              <ToggleGroup
                aria-label="Output mode"
                disallowEmptySelection
                selectedKeys={[mode]}
                onSelectionChange={(keys) => {
                  const value = keys.values().next().value
                  if (value === 'preview' || value === 'review') {
                    // setField for mode lives on the item context map, not shown in this focused a11y snippet.
                  }
                }}
              >
                <ToggleGroupItem id="preview" size="sm">
                  Preview
                </ToggleGroupItem>
                <ToggleGroupItem id="review" size="sm">
                  Review
                </ToggleGroupItem>
              </ToggleGroup>

              <Textarea
                aria-label={'Debug notes: ' + (fields.notes.value ?? '')}
                value={fields.notes.value ?? ''}
                readOnly
              />
            </Dashlet.Body>
          </Dashlet.Frame>
        )
      }}
    </PicodashItem>
  )
}`

const validationSource = `import { PICODASH_ERROR_CODES } from '@picodash/store'

const requiredChecks = [
  PICODASH_ERROR_CODES.MISSING_ACCESSIBLE_LABEL,
]

// 1) Tab into launch point
// 2) Enter panel, confirm labelled controls are announced
// 3) Escape close, assert focus returns to launcher
// 4) Resize 390px and 1280px and repeat keyboard-only flow
// 5) If diagnostics emit, fix labels and IDs at source controls`

export default function DashletAccessibilityPage() {
  return (
    <DocsShell title="Guide: dashlet accessibility" withProductRoute={false}>
      <h2>Minimum requirements</h2>
      <ul>
        <li>
          Every item needs readable labels. For custom controls, provide explicit <code>label</code>{' '}
          and stable
          <code> aria-labelledby</code>/<code>aria-label</code> relationships.
        </li>
        <li>
          Use field metadata IDs (<code>labelId</code>, <code>inputId</code>) when integrating{' '}
          <code>/ui</code>
          inputs inside custom Dashlet bodies.
        </li>
        <li>
          Do not rely on color alone. Use explicit tone state with <code>Dashlet.Status</code> for
          warnings, errors, and neutral states.
        </li>
      </ul>

      <h2>Keyboard, focus, and close/reopen parity</h2>
      <ul>
        <li>Panel trigger and actions must be keyboard reachable by default.</li>
        <li>Keep focus order stable from trigger to first interactive control inside the panel.</li>
        <li>After close/reopen cycles, restore focus to a prior trigger or launcher entry.</li>
        <li>
          Keep pointer and keyboard behavior aligned for list reordering and action execution.
        </li>
      </ul>

      <h2>Errors and diagnostics</h2>
      <p>
        The diagnostics system is the canonical signal for semantic gaps. Prioritize
        <code> PICODASH_MISSING_ACCESSIBLE_LABEL</code> and close/reopen related errors before
        shipping.
      </p>
      <DocsCodeBlock label="Accessible custom item" source={labelSnippet} />

      <h2>Verification script</h2>
      <DocsCodeBlock label="Accessibility checks" source={validationSource} />

      <h2>Portable QA matrix</h2>
      <ul>
        <li>Desktop keyboard walk-through: open, move, edit, reset, close, reopen.</li>
        <li>
          Mobile touch walk-through: touch launcher, verify focus-visible fallback and action
          response.
        </li>
        <li>
          Contrast check for high/low emphasis variants and status indicators in both theme modes.
        </li>
      </ul>
    </DocsShell>
  )
}

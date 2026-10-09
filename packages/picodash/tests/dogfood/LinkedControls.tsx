'use client'
import { createPicodashNexus } from '@picodash/nexus'
import {
  DashStack,
  DashGroup,
  TargetSliderDashlet,
  NumberDashlet,
  useDashStackGroupOrder,
  useDashStackStructure,
  getDashStackStructure,
  subscribeDashStackStructure,
  revealDashlet,
  type TargetSliderResult,
} from '@picodash/dashstack'
import { TargetSlider } from '@picodash/dashstack/ui'
import { DashPanel, DashPanelProvider, type DashPanelDefaultLayout } from '@picodash/dashpanel'

export function createTargets() {
  return createPicodashNexus({
    valueOwner: 'nexus',
    fields: {
      bore: {
        defaultValue: 2.37,
        validate: (value: number) =>
          typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10
            ? []
            : [{ message: 'Enter a target from 0 to 10.' }],
      },
      title: { defaultValue: 'Targets' },
    },
  })
}
export function LinkedControls({
  nexus,
  result,
}: {
  nexus: ReturnType<typeof createTargets>
  result: TargetSliderResult
}) {
  return (
    <DashStack id="designer" nexus={nexus}>
      <DashGroup id="preview" aria-label="Preview" pin="start" />
      <DashGroup id="geometry" label="Geometry" glow>
        <DashGroup id="targets" label="Targets">
          <TargetSliderDashlet
            id="bore"
            label="Bore"
            field={nexus.fields.bore}
            min={0}
            max={10}
            step={0.01}
            result={result}
            marks={[
              { value: 0, label: 'Solid' },
              { value: 2, label: 'Minimum bore' },
            ]}
            formatValue={(value) => `${value} mm`}
          />
          <NumberDashlet id="linked" label="Linked target" field={nexus.fields.bore} step={0.01} />
        </DashGroup>
      </DashGroup>
    </DashStack>
  )
}
export function Priority({ nexus }: { nexus: ReturnType<typeof createTargets> }) {
  const scope = nexus.scope('designer')
  const structure = useDashStackStructure(scope)
  const order = useDashStackGroupOrder(scope, 'targets')
  return (
    <output>
      {structure.nodes.length}: {order.join(', ')}
    </output>
  )
}
export function connectProfile(nexus: ReturnType<typeof createTargets>) {
  const scope = nexus.scope('designer')
  const attention = scope.createItemInteractionSource('profile:bore')
  const gesture = scope.createNumericGesture(nexus.fields.bore, {
    onEnd: (event) => void event.finalValue,
  })
  const off = subscribeDashStackStructure(scope, () => void getDashStackStructure(scope))
  return {
    gesture,
    attention,
    reveal: () => revealDashlet(scope, 'bore'),
    release() {
      gesture.release()
      attention.release()
      off()
    },
  }
}
// Public type exclusions are checked in an isolated installed consumer, without running this function.
export function negativeTypes(nexus: ReturnType<typeof createTargets>) {
  // @ts-expect-error numeric gestures require numeric fields
  nexus.createNumericGesture(nexus.fields.title)
  const bad = (
    <TargetSliderDashlet
      id="bad"
      label="Bad"
      // @ts-expect-error target cannot bind a string field
      field={nexus.fields.title}
      result={{ status: 'ready', value: 0 }}
    />
  )
  // @ts-expect-error ready state requires a value
  const missing: TargetSliderResult = { status: 'ready' }
  void [bad, missing, TargetSlider]
}

// A Panel and its primary Stack share the existing designer scope.
export function ResponsiveDesigner({
  nexus,
  narrow,
}: {
  nexus: ReturnType<typeof createTargets>
  narrow: boolean
}) {
  const defaultLayout: DashPanelDefaultLayout = narrow
    ? {
        placement: { mode: 'floating', disposition: { kind: 'free' } },
        preferredPosition: { x: 8, y: 8 },
      }
    : { placement: { mode: 'fixed', disposition: { kind: 'docked', position: 'full-left' } } }
  return (
    <DashPanelProvider nexus={nexus}>
      <DashPanel
        id="designer"
        title="Configuration"
        defaultLayout={defaultLayout}
        dockPositions={narrow ? [] : ['full-left']}
      >
        <DashStack aria-label="Configuration controls">
          <NumberDashlet id="bore" label="Bore" field={nexus.fields.bore} step={0.01} />
        </DashStack>
      </DashPanel>
    </DashPanelProvider>
  )
}

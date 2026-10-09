'use client'
import { createPicodashNexus } from '@picodash/nexus'
import {
  DashStack,
  DashGroup,
  TargetSliderDashlet,
  SliderDashlet,
  TargetNumberDashlet,
  Dashlet,
  NumberDashlet,
  useDashStackGroupOrder,
  useDashStackStructure,
  getDashStackStructure,
  subscribeDashStackStructure,
  revealDashlet,
  type TargetSliderResult,
  type SingleFieldDashletRenderContext,
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
            unit="mm"
            marks={[
              { value: 0, label: 'Solid' },
              { value: 2, label: 'Minimum bore' },
            ]}
            formatValue={(value) => `${value} mm`}
          />
          <TargetNumberDashlet
            id="comparison"
            label="Bore comparison"
            field={nexus.fields.bore}
            step={0.01}
            unit="mm"
            result={result}
            targetLabel="Requested"
            actualLabel="Result"
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
  const badNumber = (
    <TargetNumberDashlet
      id="bad-number"
      label="Bad"
      // @ts-expect-error number targets cannot bind string fields
      field={nexus.fields.title}
      result={{ status: 'ready', value: 0 }}
    />
  )
  void [bad, badNumber, missing, TargetSlider]
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

// Preserve old numeric intent when a new geometry has a smaller available bore.
export function CapacityTarget({
  id,
  nexus,
  capacity,
  result,
}: {
  id: string
  nexus: ReturnType<typeof createTargets>
  capacity: number
  result: TargetSliderResult
}) {
  return (
    <Dashlet id={id} label="Available bore" field={nexus.fields.bore}>
      {({ binding, labelId, disabled, readOnly }: SingleFieldDashletRenderContext<number>) => (
        <TargetSlider
          id={binding.controlId}
          aria-labelledby={labelId}
          value={Math.max(0, Math.min(capacity, binding.value))}
          inputValue={
            binding.dirty
              ? typeof binding.draftValue === 'number'
                ? binding.draftValue
                : null
              : binding.value
          }
          onChange={(next) =>
            binding.setInput(next === null ? null : Math.max(0, Math.min(capacity, next)))
          }
          createGesture={(options) => binding.createNumericGesture(options)}
          min={0}
          max={capacity}
          step={0.001}
          unit="mm"
          result={result}
          disabled={disabled}
          readOnly={readOnly}
        />
      )}
    </Dashlet>
  )
}

// One numeric field stores either Off or a regular, stepped size.
export function createDetentSizes() {
  return createPicodashNexus({
    valueOwner: 'nexus',
    fields: {
      bore: {
        defaultValue: 0,
        validate: (value: number) =>
          value === 0 ||
          (Number.isFinite(value) &&
            value >= 2 &&
            value <= 10 &&
            Math.abs(value * 10 - Math.round(value * 10)) < 1e-8)
            ? []
            : [{ message: 'Choose Off or a size from 2 to 10 in 0.1 steps.' }],
      },
    },
  })
}
export function DetentSizeControls({
  nexus,
  capacity,
}: {
  nexus: ReturnType<typeof createDetentSizes>
  capacity: number
}) {
  return (
    <DashStack id="sizes" nexus={nexus}>
      <SliderDashlet
        id="bore"
        label="Bore"
        field={nexus.fields.bore}
        min={2}
        max={Math.max(2, capacity)}
        step={0.1}
        startDetent={{ value: 0, label: 'Off' }}
        disabled={capacity < 2}
        formatValue={(value: number) => (value === 0 ? 'Off' : `${value} mm`)}
      />
    </DashStack>
  )
}

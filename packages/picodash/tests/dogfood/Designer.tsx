'use client'
import {
  DashGroup,
  DashStack,
  Dashlet,
  useDashStackOrder,
  type SingleFieldDashletRenderContext,
} from '@picodash/dashstack'
import { usePicodashNexusSelector } from '@picodash/nexus/react'
import {
  designKeys,
  draftMember,
  scopeId,
  selectDesign,
  priorityFromOrder,
  targetsId,
  type Design,
  type Designer,
  type Solver,
} from './designer-model.js'

export function SelectedProfile({
  id,
  nexus,
  solve,
}: {
  id: string
  nexus: Designer
  solve: Solver
}) {
  const snapshot = usePicodashNexusSelector(nexus, (state) => state)
  const { solution } = selectDesign(snapshot, solve)
  return (
    <Dashlet id={id} label="Selected gear profile" layout="block" pin="start">
      {solution ? (
        <>
          <svg
            width="100%"
            viewBox={`${-solution.halfExtent} ${-solution.halfExtent} ${2 * solution.halfExtent} ${2 * solution.halfExtent}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={solution.summary}
          >
            <path d={solution.profilePath} fill="none" stroke="currentColor" />
          </svg>
          <p>{solution.summary}</p>
        </>
      ) : (
        <p role="status">No solution is available.</p>
      )}
    </Dashlet>
  )
}

export function DesignRecordEditor({ id, nexus }: { id: string; nexus: Designer }) {
  return (
    <Dashlet id={id} label="Requested design" field={nexus.fields.design} layout="block">
      {({ binding, disabled, readOnly }: SingleFieldDashletRenderContext<Design>) => (
        <>
          {designKeys.map((key, index) => {
            const id = index === 0 ? binding.controlId : `${binding.controlId}-${key}`
            const invalid = binding.issues.some(
              (issue) =>
                issue.path[0] === 'values' && issue.path[1] === 'design' && issue.path[2] === key,
            )
            return (
              <label key={key} htmlFor={id}>
                {key}
                <input
                  id={id}
                  inputMode="decimal"
                  disabled={disabled}
                  readOnly={readOnly}
                  value={draftMember(binding.draftValue, binding.value, key)}
                  aria-invalid={invalid || undefined}
                  aria-errormessage={invalid ? binding.issuesId : undefined}
                  onChange={(event) =>
                    binding.setInput({
                      ratio: draftMember(binding.draftValue, binding.value, 'ratio'),
                      module: draftMember(binding.draftValue, binding.value, 'module'),
                      diameter: draftMember(binding.draftValue, binding.value, 'diameter'),
                      [key]: event.currentTarget.value,
                    })
                  }
                />
              </label>
            )
          })}
        </>
      )}
    </Dashlet>
  )
}

// The display targets make the fixed priority group explicit. An application may put its
// corresponding inputs inside these same nodes without changing their IDs or group policy.
function EffectivePriority() {
  return <output aria-label="Committed priority">{priorityFromOrder(useDashStackOrder())}</output>
}

export function DesignerRecipe({ nexus, solve }: { nexus: Designer; solve: Solver }) {
  return (
    <DashStack id={scopeId} nexus={nexus}>
      <SelectedProfile id="profile" nexus={nexus} solve={solve} />
      <DashGroup id={targetsId} label="Priority targets">
        <Dashlet id="reduction" label="Reduction" field={nexus.fields.design} mode="display">
          {({ binding }: SingleFieldDashletRenderContext<Design, 'display'>) => (
            <>
              <output>{binding.value.ratio}:1</output>
              <EffectivePriority />
            </>
          )}
        </Dashlet>
        <Dashlet id="tooth-size" label="Tooth size" field={nexus.fields.design} mode="display">
          {({ binding }: SingleFieldDashletRenderContext<Design, 'display'>) => (
            <output>{binding.value.module} mm</output>
          )}
        </Dashlet>
      </DashGroup>
      <DesignRecordEditor id="request" nexus={nexus} />
    </DashStack>
  )
}

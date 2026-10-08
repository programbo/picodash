'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  DashStack,
  DashGroup,
  Dashlet,
  useDashStackOrder,
  type SingleFieldDashletRenderContext,
} from '@picodash/dashstack'
import { NumberField, RangeSlider } from '@picodash/dashstack/ui'
import { usePicodashNexusSelector } from '@picodash/nexus/react'
import {
  Button,
  PicodashThemeProvider,
  type PicodashTheme,
  type PicodashDensity,
} from '@picodash/ui'
import { ContractLabDevBridgeConnector } from './dev-bridge-connector'
import {
  createPlanetaryNexus,
  designPriority,
  designSchema,
  solveDesign,
  type Design,
  type PlanetaryNexus,
} from './planetary/model'

const millimeters: Intl.NumberFormatOptions = {
  style: 'unit',
  unit: 'millimeter',
  maximumFractionDigits: 2,
}
const number = (value: number) =>
  new Intl.NumberFormat('en-AU', { maximumFractionDigits: 3 }).format(value)

type InputProps = {
  id: string
  label: string
  nexus: PlanetaryNexus
  fieldKey: 'ratio' | 'module' | 'diameter' | 'wall' | 'bore'
  min: number
  max: number
  step: number
  help: string
}
function DesignInput({ nexus, fieldKey, min, max, step, ...props }: InputProps) {
  return (
    <Dashlet {...props} field={nexus.fields.design}>
      {(context: SingleFieldDashletRenderContext<Design>) => {
        const { binding } = context
        const draft = designSchema.safeParse(binding.draftValue)
        const value = draft.success ? draft.data : binding.value
        return (
          <div className="min-w-0">
            <NumberField
              id={binding.controlId}
              aria-labelledby={context.labelId}
              aria-describedby={binding.issuesId}
              aria-invalid={binding.invalid || undefined}
              aria-errormessage={binding.issuesId}
              value={value[fieldKey]}
              min={min}
              max={max}
              step={step}
              formatOptions={fieldKey === 'ratio' ? { maximumFractionDigits: 2 } : millimeters}
              onChange={(candidate) => {
                if (candidate !== null)
                  binding.setInput({ ...binding.value, [fieldKey]: candidate })
              }}
            />
          </div>
        )
      }}
    </Dashlet>
  )
}

function PlanetCount({ nexus }: { id: string; nexus: PlanetaryNexus }) {
  return (
    <Dashlet
      id="planet-count"
      label="Planets"
      field={nexus.fields.design}
      help="The solver chooses an equally spaced planet count within these inclusive limits. Some counts cannot assemble with a particular tooth combination."
    >
      {(context: SingleFieldDashletRenderContext<Design>) => {
        const { binding } = context
        return (
          <>
            <RangeSlider
              id={binding.controlId}
              aria-labelledby={context.labelId}
              aria-describedby={binding.issuesId}
              aria-invalid={binding.invalid || undefined}
              aria-errormessage={binding.issuesId}
              value={{ start: binding.value.minPlanets, end: binding.value.maxPlanets }}
              min={2}
              max={8}
              step={1}
              onChange={({ start, end }) =>
                binding.setInput({ ...binding.value, minPlanets: start, maxPlanets: end })
              }
            />
            <output data-picodash-dashstack-range-value>
              {binding.value.minPlanets}–{binding.value.maxPlanets}
            </output>
          </>
        )
      }}
    </Dashlet>
  )
}

function InferredDesign({ nexus }: { id: string; nexus: PlanetaryNexus }) {
  const design = usePicodashNexusSelector(nexus, (state) => state.values.design)
  const priority = designPriority(useDashStackOrder('root'))
  const solution = useMemo(() => solveDesign(design, priority), [design, priority])
  if (!solution) throw new Error('Accepted planetary design must have a solution.')
  const exactRatio = Math.abs(solution.ratio - design.ratio) < 1e-8
  const exactModule = Math.abs(solution.module - design.module) < 1e-8
  const rows = [
    [
      'Reduction',
      `${number(solution.ratio)}:1`,
      exactRatio ? 'Target matched' : `Target ${number(design.ratio)}:1`,
    ],
    [
      'Tooth size',
      `${number(solution.module)} mm`,
      exactModule ? 'Target matched' : `Target ${number(design.module)} mm`,
    ],
    ['Sun / planet / ring', `${solution.sun} / ${solution.planet} / ${solution.ring}`, 'Teeth'],
    ['Planet count', String(solution.planets), 'Equally spaced'],
    ['Outer diameter', `${number(solution.diameter)} mm`, `Maximum ${number(design.diameter)} mm`],
    ['Pressure angle', `${number(solution.pressureAngle)}°`, 'Inferred'],
    ['Planet clearance', `${number(solution.planetGap)} mm`, 'Minimum 0.25 mm'],
    ['Sun hub wall', `${number(solution.hubWall)} mm`, 'Minimum 2 mm'],
  ]
  return (
    <Dashlet
      id="gear-set"
      label="Gear set"
      field={nexus.fields.design}
      mode="display"
      layout="block"
    >
      <p className="mb-3 text-sm text-(--picodash-color-text-muted)" role="status">
        {priority === 'ratio'
          ? 'Reduction first, then tooth size.'
          : 'Tooth size first, then reduction.'}{' '}
        {exactRatio && exactModule
          ? 'Both targets match.'
          : 'Closest feasible match in this priority order.'}
      </p>
      <dl className="grid gap-3" data-planetary-results>
        {rows.map(([label, value, note]) => (
          <div key={label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5">
            <dt className="text-sm text-(--picodash-color-text-muted)">{label}</dt>
            <dd className="text-right text-sm font-medium tabular-nums">{value}</dd>
            <dd className="col-span-2 text-right text-xs text-(--picodash-color-text-muted)">
              {note}
            </dd>
          </div>
        ))}
      </dl>
    </Dashlet>
  )
}

export function PlanetaryLab() {
  const [model, setModel] = useState(() => ({ nexus: createPlanetaryNexus(), generation: 0 }))
  const { nexus } = model
  const [theme, setTheme] = useState<PicodashTheme>('dark')
  const [density, setDensity] = useState<PicodashDensity>('regular')
  return (
    <PicodashThemeProvider theme={theme} density={density}>
      <ContractLabDevBridgeConnector
        nexus={nexus}
        registrationId="planetary-lab"
        label="Planetary Lab"
        disclosure={{
          valueFields: ['design'],
          scopeIds: ['planetary-controls'],
          diagnostics: true,
        }}
        permissions={{ writableFields: ['design'] }}
      />
      <main className="min-h-svh bg-(--picodash-color-canvas) px-3 py-6 text-(--picodash-color-text) sm:py-10">
        <div className="mx-auto max-w-md">
          <header className="mb-5">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-xl font-semibold tracking-tight">Planetary Lab</h1>
              <Link href="/lab" className="text-sm underline underline-offset-4">
                Dashlet Lab
              </Link>
            </div>
            <p className="mt-2 text-sm text-(--picodash-color-text-muted)">
              Fixed ring · sun input · carrier output
            </p>
            <p className="mt-3 text-sm text-(--picodash-color-text-muted)">
              Move a target above the other to give it priority. Physical limits always apply.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="outline"
                onPress={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? 'Light theme' : 'Dark theme'}
              </Button>
              <Button
                variant="outline"
                aria-pressed={density === 'compact'}
                onPress={() => setDensity(density === 'compact' ? 'regular' : 'compact')}
              >
                Compact
              </Button>
              <Button
                variant="outline"
                onPress={() =>
                  setModel((previous) => ({
                    nexus: createPlanetaryNexus(),
                    generation: previous.generation + 1,
                  }))
                }
              >
                Reset
              </Button>
            </div>
          </header>
          <div className="rounded-xl bg-(--picodash-color-surface) py-2">
            <DashStack
              key={model.generation}
              nexus={nexus}
              id="planetary-controls"
              aria-label="Planetary calculator"
            >
              <DesignInput
                id="reduction"
                label="Reduction target"
                nexus={nexus}
                fieldKey="ratio"
                min={2.5}
                max={8}
                step={0.1}
                help="Target input-to-output reduction, from 2.5:1 to 8:1. Integer teeth may give an approximate match. Move this above tooth size to match reduction first."
              />
              <DesignInput
                id="tooth-size"
                label="Tooth size target"
                nexus={nexus}
                fieldKey="module"
                min={0.6}
                max={3}
                step={0.05}
                help="Transverse module in millimetres. The solver searches 0.60–3.00 mm in 0.05 mm steps. Move this above reduction to favour tooth size first."
              />
              <DashGroup
                id="limits"
                label="Physical limits"
                pin="end"
                reorderable={false}
                labelColor={theme === 'dark' ? '#e9b95b' : '#886000'}
              >
                <DesignInput
                  id="diameter"
                  label="Max. diameter"
                  nexus={nexus}
                  fieldKey="diameter"
                  min={30}
                  max={250}
                  step={1}
                  help="Maximum ring outside diameter, from 30 to 250 mm. The inferred gear set can be smaller."
                />
                <DesignInput
                  id="wall"
                  label="Min. ring wall"
                  nexus={nexus}
                  fieldKey="wall"
                  min={1.5}
                  max={15}
                  step={0.5}
                  help="Minimum material outside the ring root circle, from 1.5 to 15 mm."
                />
                <DesignInput
                  id="bore"
                  label="Sun bore"
                  nexus={nexus}
                  fieldKey="bore"
                  min={0}
                  max={30}
                  step={1}
                  help="Sun bore diameter, from 0 to 30 mm. At least 2 mm of root material must remain around it."
                />
                <PlanetCount id="planet-count" nexus={nexus} />
              </DashGroup>
              <DashGroup id="inferred" label="Inferred solution" pin="end" reorderable={false}>
                <InferredDesign id="gear-set" nexus={nexus} />
              </DashGroup>
            </DashStack>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-(--picodash-color-text-muted)">
            Geometry prototype, not a strength or manufacturing check. Tooth profile checks use
            automatic pressure angle, 0.20 mm backlash and a 0.15 mm root fillet.
          </p>
        </div>
      </main>
    </PicodashThemeProvider>
  )
}

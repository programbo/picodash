import { createPicodashNexus } from '@picodash/nexus'
import { z } from 'zod'
import { DEFAULT_INPUTS, solve, type Preference } from './solver'

export const designSchema = z
  .object({
    ratio: z.number().min(2.5).max(8),
    module: z.number().min(0.6).max(3),
    diameter: z.number().min(30).max(250),
    wall: z.number().min(1.5).max(15),
    bore: z.number().min(0).max(30),
    minPlanets: z.number().int().min(2).max(8),
    maxPlanets: z.number().int().min(2).max(8),
  })
  .refine((value) => value.minPlanets <= value.maxPlanets, {
    message: 'Keep the planet limits in order.',
  })
export type Design = z.infer<typeof designSchema>
export type Priority = Preference['first']
export const defaultDesign: Design = {
  ratio: 5,
  module: 1.5,
  diameter: 90,
  wall: 3,
  bore: 6,
  minPlanets: 3,
  maxPlanets: 8,
}

export function designPriority(order: readonly string[]): Priority {
  return order.indexOf('tooth-size') >= 0 &&
    order.indexOf('tooth-size') < order.indexOf('reduction')
    ? 'module'
    : 'ratio'
}

export function solveDesign(design: Design, first: Priority) {
  return (
    solve(
      {
        ...DEFAULT_INPUTS,
        diameter: design.diameter,
        wall: design.wall,
        bore: design.bore,
        minPlanets: design.minPlanets,
        maxPlanets: design.maxPlanets,
        module: null,
        intent: { kind: 'target', ratio: design.ratio },
      },
      { first, module: design.module },
    )?.best ?? null
  )
}

export function createPlanetaryNexus() {
  return createPicodashNexus({
    valueOwner: 'nexus',
    nexusId: 'planetary-lab',
    schemaVersion: 1,
    fields: {
      design: {
        defaultValue: defaultDesign,
        validate: (candidate: Design) => {
          const parsed = designSchema.safeParse(candidate)
          if (!parsed.success)
            return [
              {
                message:
                  'Use values within the shown limits, with minimum planets no greater than maximum.',
              },
            ]
          // Ranking only chooses among feasible solutions; it cannot change feasibility.
          return solveDesign(parsed.data, 'ratio')
            ? []
            : [
                {
                  message:
                    'No gear set fits these limits. The previous solution is unchanged. Increase the diameter or relax the constraints.',
                },
              ]
        },
      },
    },
  })
}
export type PlanetaryNexus = ReturnType<typeof createPlanetaryNexus>

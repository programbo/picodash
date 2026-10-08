// Adapted from John’s planetary calculator; see README.md for provenance and scope.
import { z } from 'zod'
import {
  DEFAULT_PROFILE,
  minimumExternalTeeth,
  validToothProfile,
  type ToothProfile,
} from './tooth-profile'

import { meshContact, passesContactScreen } from './mesh-contact'

export const AUTO_PRESSURE_ANGLES = Array.from({ length: 11 }, (_, i) => 20 + i / 2)
export const MODULES = Array.from({ length: 49 }, (_, index) => (12 + index) / 20)
export const LIMITS = {
  diameter: [30, 250],
  wall: [1.5, 15],
  bore: [0, 30],
  ratio: [2.5, 8],
  planets: [2, 8],
} as const
export const PROFILE = {
  ...DEFAULT_PROFILE,
  radialClearance: 0.25,
  minHubWall: 2,
  minSunTeeth: 12,
  minPlanetTeeth: 22,
  maxRingTeeth: 180,
} as const
const intentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('maximum') }),
  z.object({ kind: z.literal('target'), ratio: z.number().min(2.5).max(8) }),
])
export const inputsSchema = z
  .object({
    pressureAngle: z.number().min(14.5).max(30).nullable(),
    backlash: z.number().min(0.05).max(0.6),
    rootFillet: z.number().min(0).max(0.75),
    diameter: z.number().min(30).max(250),
    wall: z.number().min(1.5).max(15),
    bore: z.number().min(0).max(30),
    minPlanets: z.number().int().min(2).max(8),
    maxPlanets: z.number().int().min(2).max(8).nullable(),
    module: z
      .number()
      .refine((value) => MODULES.includes(value))
      .nullable(),
    intent: intentSchema,
  })
  .refine((input) => input.maxPlanets === null || input.maxPlanets >= input.minPlanets, {
    message: 'The maximum must be at least the minimum.',
    path: ['maxPlanets'],
  })
export type Inputs = z.infer<typeof inputsSchema>
export type Solution = {
  pressureAngle: number
  sun: number
  planet: number
  ring: number
  planets: number
  module: number
  ratio: number
  diameter: number
  planetGap: number
  hubWall: number
}
export type CandidateSet = { best: Solution; modules: number[] } | null
export const DEFAULT_INPUTS: Inputs = {
  ...DEFAULT_PROFILE,
  pressureAngle: null,
  diameter: 90,
  wall: 3,
  bore: 6,
  minPlanets: 3,
  maxPlanets: null,
  module: null,
  intent: { kind: 'target', ratio: 5 },
}

export type Preference = { first: 'ratio' | 'module'; module: number }
function better(
  candidate: Solution,
  best: Solution,
  intent: Inputs['intent'],
  preference?: Preference,
): boolean {
  if (preference) {
    const ratioError =
      intent.kind === 'target'
        ? Math.abs(candidate.ratio - intent.ratio) - Math.abs(best.ratio - intent.ratio)
        : best.ratio - candidate.ratio
    const moduleError =
      Math.abs(candidate.module - preference.module) - Math.abs(best.module - preference.module)
    for (const difference of preference.first === 'ratio'
      ? [ratioError, moduleError]
      : [moduleError, ratioError]) {
      if (Math.abs(difference) > 1e-8) return difference < 0
    }
  }
  const error =
    intent.kind === 'target'
      ? Math.abs(candidate.ratio - intent.ratio) - Math.abs(best.ratio - intent.ratio)
      : best.ratio - candidate.ratio
  if (Math.abs(error) > 1e-8) return error < 0
  if (candidate.pressureAngle !== best.pressureAngle)
    return candidate.pressureAngle < best.pressureAngle
  if (candidate.module !== best.module) return candidate.module > best.module
  if (Math.abs(candidate.planets - 3) !== Math.abs(best.planets - 3))
    return Math.abs(candidate.planets - 3) < Math.abs(best.planets - 3)
  return candidate.diameter < best.diameter
}

export function resolvedProfile(input: Inputs, solution: Solution): ToothProfile {
  return {
    pressureAngle: solution.pressureAngle,
    backlash: input.backlash,
    rootFillet: input.rootFillet,
  }
}

// Finite enumeration: integer tooth counts, a calibrated-size module grid, and 2–8 planets.
// Undercut limits follow the selected transverse pressure angle; print-friendly
// floors remain in place when the theoretical minimum is lower.
export function solve(input: Inputs, preference?: Preference): CandidateSet {
  let best: Solution | null = null
  const feasibleModules = new Set<number>()
  for (const pressureAngle of input.pressureAngle === null
    ? AUTO_PRESSURE_ANGLES
    : [input.pressureAngle]) {
    const profile = { ...input, pressureAngle }
    const minimum = minimumExternalTeeth(pressureAngle)
    const sunMinimum = Math.max(PROFILE.minSunTeeth, minimum)
    const planetMinimum = Math.max(PROFILE.minPlanetTeeth, minimum)
    const profileCache = new Map<string, boolean>()
    function profileFits(teeth: number, module: number, kind: 'external' | 'internal') {
      const key = `${teeth}:${module}:${kind}`
      const cached = profileCache.get(key)
      if (cached !== undefined) return cached
      const valid = validToothProfile({ ...profile, teeth, module, kind })
      profileCache.set(key, valid)
      return valid
    }
    for (let sun = sunMinimum; sun <= PROFILE.maxRingTeeth - 2 * planetMinimum; sun++) {
      for (let planet = planetMinimum; sun + 2 * planet <= PROFILE.maxRingTeeth; planet++) {
        const ring = sun + 2 * planet
        const ratio = 1 + ring / sun
        const maxModule = (input.diameter - 2 * input.wall) / (ring + 2.5)
        const minModule = (input.bore + 2 * PROFILE.minHubWall) / (sun - 2.5)
        for (
          let planets = input.minPlanets;
          planets <= (input.maxPlanets ?? LIMITS.planets[1]);
          planets++
        ) {
          if ((sun + ring) % planets !== 0) continue
          const gapPerModule = (sun + planet) * Math.sin(Math.PI / planets) - (planet + 2)
          if (gapPerModule <= 0) continue
          for (const module of MODULES) {
            if (
              module > maxModule + 1e-9 ||
              module < minModule - 1e-9 ||
              module * gapPerModule < PROFILE.radialClearance
            )
              continue
            const candidate: Solution = {
              pressureAngle,
              sun,
              planet,
              ring,
              planets,
              module,
              ratio,
              diameter: module * (ring + 2.5) + 2 * input.wall,
              planetGap: module * gapPerModule,
              hubWall: (module * (sun - 2.5) - input.bore) / 2,
            }
            const improvesBest =
              (input.module === null || module === input.module) &&
              (best === null || better(candidate, best, input.intent, preference))
            // Geometry cannot affect the answer once this module is already feasible
            // and this candidate cannot improve the selected design.
            if (!improvesBest && feasibleModules.has(module)) continue
            if (
              !profileFits(sun, module, 'external') ||
              !profileFits(planet, module, 'external') ||
              !profileFits(ring, module, 'internal') ||
              !passesContactScreen(meshContact(candidate, profile))
            )
              continue
            feasibleModules.add(module)
            if (improvesBest) best = candidate
          }
        }
      }
    }
  }
  return best === null ? null : { best, modules: [...feasibleModules].sort((a, b) => a - b) }
}

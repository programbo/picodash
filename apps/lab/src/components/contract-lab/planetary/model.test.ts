import { describe, expect, it } from 'vite-plus/test'
import { createPlanetaryNexus, defaultDesign, designPriority, solveDesign } from './model'
import { meshContact, passesContactScreen } from './mesh-contact'
import { DEFAULT_INPUTS, resolvedProfile, solve } from './solver'

describe('planetary lab', () => {
  it('preserves the source calculator default when targets agree', () => {
    const original = solve(DEFAULT_INPUTS)?.best
    expect(original).toMatchObject({
      sun: 18,
      planet: 27,
      ring: 72,
      module: 1.1,
      ratio: 5,
      pressureAngle: 20,
    })
    expect(solveDesign({ ...defaultDesign, module: 1.1 }, 'ratio')).toEqual(original)
    expect(solveDesign({ ...defaultDesign, module: 1.1 }, 'module')).toEqual(original)
  })

  it('uses committed target order for lexicographic preference without changing source values', () => {
    const ratioFirst = designPriority(['reduction', 'tooth-size', 'limits', 'inferred'])
    const moduleFirst = designPriority(['tooth-size', 'reduction', 'limits', 'inferred'])
    expect(ratioFirst).toBe('ratio')
    expect(moduleFirst).toBe('module')
    const reduction = solveDesign(defaultDesign, ratioFirst)!
    const toothSize = solveDesign(defaultDesign, moduleFirst)!
    expect(reduction.ratio).toBe(5)
    expect(toothSize.module).toBeGreaterThan(reduction.module)
    expect(Math.abs(toothSize.ratio - 5)).toBeGreaterThan(0)
    expect(solveDesign(defaultDesign, ratioFirst)).toEqual(reduction)
    expect(defaultDesign.module).toBe(1.5)
  })

  it.each([
    defaultDesign,
    { ...defaultDesign, diameter: 120, bore: 10, wall: 4 },
    { ...defaultDesign, minPlanets: 4, maxPlanets: 4 },
    { ...defaultDesign, ratio: 7, module: 0.8 },
  ])('enforces geometry and physical limits under either priority: %j', (design) => {
    for (const priority of ['ratio', 'module'] as const) {
      const result = solveDesign(design, priority)!
      expect(result).not.toBeNull()
      expect(result.ring).toBe(result.sun + 2 * result.planet)
      expect((result.sun + result.ring) % result.planets).toBe(0)
      expect(result.planets).toBeGreaterThanOrEqual(design.minPlanets)
      expect(result.planets).toBeLessThanOrEqual(design.maxPlanets)
      expect(result.diameter).toBeLessThanOrEqual(design.diameter + 1e-8)
      expect(result.hubWall).toBeGreaterThanOrEqual(2 - 1e-8)
      expect(result.planetGap).toBeGreaterThanOrEqual(0.25 - 1e-8)
      expect(
        passesContactScreen(meshContact(result, resolvedProfile(DEFAULT_INPUTS, result))),
      ).toBe(true)
    }
  })

  it('rejects impossible or malformed proposals without changing accepted inputs', () => {
    const nexus = createPlanetaryNexus()
    const accepted = nexus.getState()
    for (const design of [
      { ...defaultDesign, diameter: 30, wall: 15 },
      { ...defaultDesign, bore: 31 },
      { ...defaultDesign, ratio: Number.NaN },
      { ...defaultDesign, minPlanets: 5, maxPlanets: 3 },
    ]) {
      expect(nexus.setValues({ design }).ok).toBe(false)
      expect(nexus.getState()).toBe(accepted)
    }
    expect(nexus.setValues({ design: { ...defaultDesign, diameter: 120 } }).ok).toBe(true)
    nexus.destroy()
  })
})

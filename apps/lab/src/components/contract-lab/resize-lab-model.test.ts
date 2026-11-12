import { describe, expect, it } from 'vite-plus/test'
import {
  defaultResizeConfiguration,
  parseResizeConfiguration,
  resizePlacement,
  resizeRecipes,
} from './resize-lab-model'

describe('Resize Lab configuration', () => {
  it('admits every visible recipe and distinguishes automatic height from finite dimensions', () => {
    for (const recipe of Object.values(resizeRecipes))
      expect(parseResizeConfiguration(recipe.configuration).ok).toBe(true)
    expect(parseResizeConfiguration(defaultResizeConfiguration)).toMatchObject({
      ok: true,
      props: { width: 360, height: 'auto' },
    })
    expect(
      parseResizeConfiguration({
        ...defaultResizeConfiguration,
        minWidth: '12rem',
        maxWidth: '90%',
      }),
    ).toMatchObject({ ok: true, props: { minWidth: '12rem', maxWidth: '90%' } })
  })

  it('rejects invalid numeric limits before replacing the current example', () => {
    expect(
      parseResizeConfiguration({ ...defaultResizeConfiguration, minWidth: '720', maxWidth: '200' }),
    ).toMatchObject({ ok: false, message: 'Minimum width must not exceed maximum width.' })
    expect(
      parseResizeConfiguration({ ...defaultResizeConfiguration, minHeight: 'Infinity' }).ok,
    ).toBe(false)
    expect(
      parseResizeConfiguration({
        ...defaultResizeConfiguration,
        explicitMetrics: true,
        metricMinWidth: '-1',
      }).ok,
    ).toBe(false)
  })

  it('uses public canonical placement objects for the visible choices', () => {
    expect(resizePlacement('free')).toEqual({ mode: 'floating', disposition: { kind: 'free' } })
    expect(resizePlacement('dock-right')).toEqual({
      mode: 'fixed',
      disposition: { kind: 'docked', position: 'full-right' },
    })
  })
})

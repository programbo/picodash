// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import {
  defaultResizeConfiguration,
  RESIZE_LAB_CONFIGURATION,
  readResizeConfiguration,
  parseResizeConfiguration,
  resizePlacement,
  resizeRecipes,
} from './resize-lab-model'

afterEach(() => window.sessionStorage.clear())

describe('Resize Lab configuration', () => {
  it('restores handle appearance from session storage and rejects unsupported styles', () => {
    const configuration = {
      ...defaultResizeConfiguration,
      edgeHandles: 'parallel',
      cornerHandles: 'external',
    }
    for (const edgeHandles of ['single', 'parallel', 'external-single', 'external-parallel']) {
      const appearance = { ...configuration, edgeHandles }
      window.sessionStorage.setItem(RESIZE_LAB_CONFIGURATION, JSON.stringify(appearance))
      expect(readResizeConfiguration()).toEqual(appearance)
    }
    for (const unsupported of [{ edgeHandles: 'triple' }, { cornerHandles: 'round' }]) {
      window.sessionStorage.setItem(
        RESIZE_LAB_CONFIGURATION,
        JSON.stringify({ ...configuration, ...unsupported }),
      )
      expect(readResizeConfiguration()).toBe(defaultResizeConfiguration)
    }
  })

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

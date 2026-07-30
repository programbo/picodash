import { describe, expect, test } from 'vite-plus/test'

import {
  filterPicodashCatalog,
  getPicodashCatalogEntriesByExportName,
  getPicodashCatalogEntry,
  picodashCatalog,
  picodashCatalogRecipeIds,
} from '../src/catalog.js'
import * as Dashlet from '../src/dashlet.js'

describe('Picodash component catalog', () => {
  test('is deterministic, deeply frozen, and JSON-compatible', () => {
    const serialized = JSON.stringify(picodashCatalog)

    expect(JSON.parse(serialized)).toEqual(picodashCatalog)
    expect(JSON.stringify(picodashCatalog)).toBe(serialized)
    expect(Object.isFrozen(picodashCatalog)).toBe(true)
    expect(
      picodashCatalog.every(
        (entry) =>
          Object.isFrozen(entry) &&
          Object.isFrozen(entry.capabilities) &&
          Object.isFrozen(entry.nesting) &&
          Object.isFrozen(entry.nesting.allowedParents) &&
          Object.isFrozen(entry.accessibility) &&
          Object.isFrozen(entry.importantProps) &&
          Object.isFrozen(entry.variants) &&
          Object.isFrozen(entry.theme) &&
          Object.isFrozen(entry.theme.semanticTokens) &&
          Object.isFrozen(entry.recipeIds),
      ),
    ).toBe(true)
  })

  test('uses unique stable IDs and unique export names within each entrypoint', () => {
    const ids = picodashCatalog.map((entry) => entry.id)
    const scopedExports = picodashCatalog.map((entry) => `${entry.entrypoint}:${entry.exportName}`)

    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(scopedExports).size).toBe(scopedExports.length)
  })

  test('covers every final dashlet composition export', () => {
    const runtimeExports = Object.keys(Dashlet).sort()
    const catalogExports = filterPicodashCatalog({
      entrypoint: '@picodash/panel/dashlet',
    })
      .map((entry) => entry.exportName)
      .sort()

    expect(catalogExports).toEqual(runtimeExports)
  })

  test('covers every built-in Dashlet', () => {
    const expectedBuiltIns = [
      'PicodashAlignment',
      'PicodashChart',
      'PicodashDisplay',
      'PicodashDropzone',
      'PicodashGradient',
      'PicodashMatrix2D',
      'PicodashMediaPreview',
      'PicodashNumber',
      'PicodashRange',
      'PicodashSegmented',
      'PicodashSelect',
      'PicodashSlider',
      'PicodashSparkline',
      'PicodashSwitch',
      'PicodashText',
      'PicodashVector3',
      'PicodashXYPad',
    ]

    expect(
      filterPicodashCatalog({ entrypoint: '@picodash/panel' })
        .map((entry) => entry.exportName)
        .sort(),
    ).toEqual(expectedBuiltIns)
  })

  test('does not retain retired Item composition names', () => {
    expect(picodashCatalog.some((entry) => /^Item[A-Z]/.test(entry.exportName))).toBe(false)
  })

  test('uses valid reference anchors, recipe IDs, and semantic theme tokens', () => {
    const recipeIds = new Set(picodashCatalogRecipeIds)
    const referencePaths = {
      '@picodash/panel': '/docs/reference/dashlets',
      '@picodash/panel/dashlet': '/docs/reference/dashlet-components',
      '@picodash/panel/ui': '/docs/reference/ui',
    }
    const semanticTokens = new Set([
      '--picodash-color-accent',
      '--picodash-color-border',
      '--picodash-color-control',
      '--picodash-color-data-1',
      '--picodash-color-data-2',
      '--picodash-color-data-3',
      '--picodash-color-data-4',
      '--picodash-color-data-5',
      '--picodash-color-focus',
      '--picodash-color-surface-muted',
      '--picodash-color-text',
      '--picodash-color-text-muted',
      '--picodash-color-well',
      '--picodash-radius-surface',
    ])

    for (const entry of picodashCatalog) {
      expect(entry.referenceAnchor).toMatch(
        /^\/docs\/reference\/(?:dashlets|dashlet-components|ui)#[a-z0-9]+(?:-[a-z0-9]+)*$/,
      )
      expect(entry.referenceAnchor.startsWith(`${referencePaths[entry.entrypoint]}#`)).toBe(true)
      expect(entry.recipeIds.length).toBeGreaterThan(0)
      expect(entry.recipeIds.every((recipeId) => recipeIds.has(recipeId))).toBe(true)
      expect(entry.theme.requirements).toContain('inherits-provider-theme')
      expect(entry.theme.semanticTokens.length).toBeGreaterThan(0)
      expect(entry.theme.semanticTokens.every((token) => semanticTokens.has(token))).toBe(true)
    }
  })

  test('provides stable lookup and composable filters', () => {
    expect(getPicodashCatalogEntry('built-in.slider')?.exportName).toBe('PicodashSlider')
    expect(getPicodashCatalogEntry('missing')).toBeUndefined()
    expect(getPicodashCatalogEntriesByExportName('Toolbar')).toHaveLength(2)
    expect(
      filterPicodashCatalog({
        entrypoint: '@picodash/panel',
        capability: 'streaming',
      }).map((entry) => entry.exportName),
    ).toEqual(['PicodashSparkline'])
    expect(
      filterPicodashCatalog({
        category: 'display',
        valueKind: 'number',
        recipeId: 'application-health',
      }).map((entry) => entry.exportName),
    ).toEqual(['Meter', 'MeterTrack', 'MeterFill', 'ProgressBar', 'ProgressTrack', 'ProgressFill'])
  })
})

import { describe, expect, it } from 'vite-plus/test'
import { createPicodashNexus, type DashPanelLayoutRecord } from '../src/index.ts'
import { decodeDurableScopeMetadata, normalizeDashPanelLayoutRecord } from '../src/metadata.ts'
import { createMemoryPersistence } from './support/memory-persistence.ts'

describe('version-two sparse Panel layout', () => {
  it('accepts independent overrides and rejects empty, obsolete, invalid or transient records', () => {
    const records: DashPanelLayoutRecord[] = [
      { version: 2, manualSize: { width: 320 } },
      { version: 2, manualSize: { height: 240 } },
      { version: 2, manualSize: { width: 320, height: 240 } },
      { version: 2, preferredPosition: { x: -2, y: 3 } },
      { version: 2, placement: { mode: 'floating', disposition: { kind: 'free' } } },
    ]
    for (const record of records) {
      const normalized = normalizeDashPanelLayoutRecord(record)
      expect(normalized).toEqual(record)
      expect(Object.isFrozen(normalized)).toBe(true)
      expect(
        decodeDurableScopeMetadata(JSON.parse(JSON.stringify({ dashPanel: record })))?.dashPanel,
      ).toEqual(record)
    }
    for (const record of [
      { version: 2 },
      { version: 2, manualSize: {} },
      { version: 2, manualSize: { width: 0 } },
      { version: 2, manualSize: { width: -1 } },
      { version: 2, manualSize: { height: NaN } },
      { version: 2, manualSize: { width: 10, height: undefined } },
      { version: 2, manualSize: { width: Infinity } },
      { version: 2, manualSize: { width: 300 }, resolvedSize: { width: 300, height: 400 } },
      {
        placement: { mode: 'floating', disposition: { kind: 'free' } },
        preferredPosition: { x: 1, y: 2 },
      },
    ])
      expect(() => normalizeDashPanelLayoutRecord(record)).toThrow()
  })

  it('closes sparse size writes through persistence, cold restore, documents and targeted removal', () => {
    const driver = createMemoryPersistence()
    const config = {
      valueOwner: 'nexus' as const,
      nexusId: 'panel-v2',
      schemaVersion: 1,
      fields: { value: { defaultValue: 1 } },
      persistence: {
        driver,
        storageKey: 'panel-v2',
        values: { defaultFieldPolicy: 'include' as const },
      },
      export: { documents: { defaultFieldPolicy: 'include' as const } },
    }
    const first = createPicodashNexus(config)
    const layout = { version: 2, manualSize: { width: 600 } } as const
    expect(first.scope('panel').setDashPanelLayout(layout)).toMatchObject({
      ok: true,
      persistence: 'saved',
      changedScopeIds: ['panel'],
    })
    first.setDashStackCollapseOverride('panel', 'group', true)
    const exported = first.documents.executeExport(first.documents.createExportPlan())
    expect(exported.ok).toBe(true)
    if (!exported.ok) return
    expect(JSON.stringify(exported.document)).toContain('"manualSize":{"width":600}')
    first.destroy()
    const cold = createPicodashNexus(config)
    expect(cold.scope('panel').getState().scope?.dashPanel).toEqual(layout)
    expect(cold.scope('panel').getState().scope?.dashPanel?.placement).toBeUndefined()
    expect(cold.scope('panel').getState().scope?.dashPanel?.preferredPosition).toBeUndefined()
    expect(cold.scope('panel').resetDashPanelLayout()).toMatchObject({
      ok: true,
      persistence: 'saved',
    })
    expect(cold.scope('panel').getState().scope?.dashStack?.collapseOverrides.get('group')).toBe(
      true,
    )
    const analysis = cold.documents.analyzeImport(exported.document)
    expect(analysis.ok).toBe(true)
    if (!analysis.ok) return
    expect(cold.documents.executeImport(analysis.plan)).toMatchObject({
      ok: true,
      persistence: 'saved',
    })
    expect(cold.scope('panel').getState().scope?.dashPanel).toEqual(layout)
    cold.destroy()
    const restored = createPicodashNexus(config)
    expect(restored.scope('panel').getState().scope?.dashPanel).toEqual(layout)
    restored.destroy()
  })

  it('discards exact obsolete Panel preferences during hydration while preserving valid List and values', () => {
    const obsolete = {
      placement: { mode: 'floating', disposition: { kind: 'free' } },
      preferredPosition: { x: 12, y: 34 },
    }
    const raw = {
      kind: 'picodash-nexus-envelope',
      formatVersion: 1,
      nexusId: 'panel-cutover',
      schemaVersion: 1,
      revision: 1,
      writerId: 'old-writer',
      valueOwner: 'nexus',
      values: { value: 7 },
      scopes: [
        [
          'panel',
          {
            dashPanel: obsolete,
            dashStack: { groupOrders: [], collapseOverrides: [['group', true]] },
            dashPanelHotkey: 'Alt+P',
            dashGroupHotkeys: [['group', 'Alt+G']],
          },
        ],
      ],
    } as const
    const driver = createMemoryPersistence({ state: JSON.stringify(raw) })
    const config = {
      valueOwner: 'nexus' as const,
      nexusId: 'panel-cutover',
      schemaVersion: 1,
      fields: { value: { defaultValue: 0 } },
      persistence: {
        driver,
        storageKey: 'state',
        values: { defaultFieldPolicy: 'include' as const },
      },
    }
    const nexus = createPicodashNexus(config)
    expect(nexus.getState().values.value).toBe(7)
    expect(nexus.scope('panel').getState().scope?.dashPanel).toBeUndefined()
    expect(nexus.scope('panel').getState().scope?.dashStack?.collapseOverrides.get('group')).toBe(
      true,
    )
    expect(nexus.metadataRecovery.getState().quarantinedScopes.size).toBe(0)
    expect(nexus.scope('panel').getState().scope?.dashPanelHotkey).toBe('Alt+P')
    expect(nexus.scope('panel').getState().scope?.dashGroupHotkeys?.get('group')).toBe('Alt+G')
    expect([...nexus.diagnostics.getState().current.values()]).toContainEqual(
      expect.objectContaining({
        code: 'panel_layout_obsolete',
        identity: { kind: 'scope-metadata', scopeId: 'panel' },
      }),
    )
    expect(
      nexus.scope('panel').setDashPanelLayout({ version: 2, manualSize: { height: 400 } }),
    ).toMatchObject({ ok: true, persistence: 'saved' })
    expect(JSON.parse(driver.inspect('state') as string).scopes[0][1]).toEqual({
      dashPanel: { version: 2, manualSize: { height: 400 } },
      dashStack: { groupOrders: [], collapseOverrides: [['group', true]] },
      dashPanelHotkey: 'Alt+P',
      dashGroupHotkeys: [['group', 'Alt+G']],
    })
    nexus.destroy()
    const cold = createPicodashNexus(config)
    expect(cold.scope('panel').getState().scope?.dashPanel?.manualSize).toEqual({ height: 400 })
    expect(
      [...cold.diagnostics.getState().current.values()].some(
        (item) => item.code === 'panel_layout_obsolete',
      ),
    ).toBe(false)
    cold.destroy()
    const initial = createPicodashNexus({
      valueOwner: 'nexus',
      nexusId: 'panel-cutover',
      schemaVersion: 1,
      fields: { value: { defaultValue: 0 } },
      // @ts-expect-error Intentional obsolete wire payload exercises runtime hydration recovery.
      initialEnvelope: raw,
    })
    expect(initial.scope('panel').getState().scope?.dashPanel).toBeUndefined()
    expect(initial.scope('panel').getState().scope?.dashStack?.collapseOverrides.get('group')).toBe(
      true,
    )
    initial.destroy()
  })
})

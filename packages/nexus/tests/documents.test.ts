import { describe, expect, it } from 'vite-plus/test'
import {
  PicodashDocumentError,
  PicodashDocumentOptionsError,
  buildPicodashDocumentOverlay,
  decodePicodashDocument,
  documentToSchemaMigrationPayload,
  encodePicodashDocument,
  migratePicodashDocument,
  normalizePicodashExportExecutionOptions,
  normalizePicodashExportOptions,
  normalizePicodashExportPolicy,
  normalizePicodashFieldMap,
  normalizePicodashImportOptions,
  normalizePicodashImportPlanReview,
  normalizePicodashScopeMap,
  stripRedactedPicodashDocumentFields,
} from '../src/documents.ts'
import type { SerializedDurableScopeMetadata } from '../src/metadata.ts'

const metadata = {
  dashPanel: {
    placement: { mode: 'floating', disposition: { kind: 'free' } },
    preferredPosition: { x: 10, y: 20 },
  },
} as const

const rootDocument = () =>
  ({
    formatVersion: 1,
    kind: 'root',
    nexusId: 'documents-test',
    schemaVersion: 1,
    fields: [
      ['alpha', { status: 'included', value: { nested: ['value'] } }],
      ['secret', { status: 'redacted' }],
    ],
    scopes: [['settings', metadata]],
  }) as const

describe('version-one Nexus document codec', () => {
  it('detaches, freezes, and preserves strict deterministic JSON', () => {
    const source = rootDocument()
    const document = decodePicodashDocument(source)

    expect(document).not.toBe(source)
    expect(Object.isFrozen(document)).toBe(true)
    expect(Object.isFrozen(document.fields)).toBe(true)
    expect(Object.isFrozen(document.fields[0]![1])).toBe(true)
    expect(
      Object.isFrozen(
        document.fields[0]![1].status === 'included' ? document.fields[0]![1].value : null,
      ),
    ).toBe(true)
    expect(document.fields.map(([key]) => key)).toEqual(['alpha', 'secret'])
    expect(document.scopes.map(([key]) => key)).toEqual(['settings'])

    ;(source.fields[0]![1] as unknown as { value: { nested: string[] } }).value.nested[0] =
      'changed'
    expect(
      (document.fields[0]![1] as unknown as { value: { nested: readonly string[] } }).value
        .nested[0],
    ).toBe('value')
  })

  it('decodes top-level document values from one descriptor snapshot', () => {
    let reads = 0
    const source = new Proxy(rootDocument(), {
      get(target, key, receiver) {
        if (key === 'nexusId') {
          reads += 1
          return reads === 1 ? 'documents-test' : { private: true }
        }
        return Reflect.get(target, key, receiver)
      },
    })

    const decoded = decodePicodashDocument(source)
    const encoded = encodePicodashDocument(source as never)
    expect(decoded.nexusId).toBe('documents-test')
    expect(encoded.nexusId).toBe('documents-test')
    expect(reads).toBe(0)
  })

  it.each([
    [
      'legacy Store identity key',
      { ...rootDocument(), nexusId: undefined, storeId: 'documents-test' },
    ],
    ['unsorted fields', { ...rootDocument(), fields: [...rootDocument().fields].reverse() }],
    [
      'duplicate fields',
      { ...rootDocument(), fields: [rootDocument().fields[0], rootDocument().fields[0]] },
    ],
    [
      'unsorted scopes',
      {
        ...rootDocument(),
        scopes: [
          ['z', metadata],
          ['a', metadata],
        ],
      },
    ],
    [
      'accessor document key',
      Object.defineProperty({ ...rootDocument() }, 'nexusId', {
        get: () => 'private',
        enumerable: true,
      }),
    ],
    ['symbol document key', Object.assign({ ...rootDocument() }, { [Symbol('private')]: true })],
  ])('rejects malformed strict input: %s', (_label, value) => {
    expect(() => decodePicodashDocument(value)).toThrow(PicodashDocumentError)
  })

  it('canonicalizes generated output ordering while retaining duplicate checks', () => {
    const source = rootDocument()
    const encoded = encodePicodashDocument({
      ...source,
      fields: [...source.fields].reverse(),
      scopes: [...source.scopes].reverse(),
    } as never)
    expect(encoded.fields.map(([key]) => key)).toEqual(['alpha', 'secret'])
    expect(encoded.scopes.map(([key]) => key)).toEqual(['settings'])
    expect(() =>
      encodePicodashDocument({ ...source, fields: [source.fields[0], source.fields[0]] } as never),
    ).toThrow(PicodashDocumentError)
  })
})

describe('document policy, options, and mappings', () => {
  it('normalizes immutable disclosure policy and rejects invalid promotion', () => {
    const policy = normalizePicodashExportPolicy(
      {
        documents: { defaultFieldPolicy: 'redact' },
        fields: {
          secret: { default: 'redact', allowPromotion: 'with-confirmation' },
          alpha: 'include',
        },
      },
      ['alpha', 'secret'],
    )
    expect(policy.documents.defaultFieldPolicy).toBe('redact')
    expect(policy.fields.secret?.allowPromotion).toBe('with-confirmation')
    expect(Object.isFrozen(policy)).toBe(true)
    expect(() =>
      normalizePicodashExportPolicy(
        { documents: { defaultFieldPolicy: 'include' }, fields: { secret: 'omit' } },
        ['alpha'],
      ),
    ).toThrow()
    expect(() =>
      normalizePicodashExportPolicy(
        {
          documents: { defaultFieldPolicy: 'include' },
          fields: { secret: { default: 'include', allowPromotion: 'with-confirmation' } },
        },
        ['secret'],
      ),
    ).toThrow()
  })

  it('validates exact options, promotion confirmation, and map collisions', () => {
    const alpha = { key: 'alpha' }
    const beta = { key: 'beta' }
    const options = normalizePicodashExportOptions({
      includeDescendants: true,
      fields: [beta, alpha],
      promoteFields: [alpha],
    })
    expect(options.fields?.map((field) => field.key)).toEqual(['alpha', 'beta'])
    expect(options.promoteFields?.map((field) => field.key)).toEqual(['alpha'])
    expect(
      normalizePicodashExportOptions({ includeDescendants: true, promoteFields: [alpha] }),
    ).toMatchObject({ includeDescendants: true })
    expect(normalizePicodashExportExecutionOptions(undefined, false)).toBeUndefined()
    expect(() => normalizePicodashExportExecutionOptions(undefined, true)).toThrow(
      PicodashDocumentOptionsError,
    )
    expect(
      normalizePicodashExportExecutionOptions({ confirmRedactedPromotion: true }, true),
    ).toEqual({
      confirmRedactedPromotion: true,
    })
    const nonEnumerable = Object.defineProperty({ includeDescendants: true }, 'extra', {
      value: true,
    })
    expect(() => normalizePicodashExportOptions(nonEnumerable)).toThrowError(
      expect.objectContaining({ operation: 'export', reason: 'unknown-key' }),
    )
    const accessor = Object.defineProperty({}, 'confirmRedactedPromotion', {
      enumerable: true,
      get: () => true,
    })
    expect(() => normalizePicodashExportExecutionOptions(accessor, true)).toThrowError(
      expect.objectContaining({ operation: 'export-execution', reason: 'accessor-property' }),
    )
    expect(() =>
      normalizePicodashImportOptions(
        new Proxy(
          {},
          {
            ownKeys() {
              throw new Error('private reflection failure')
            },
          },
        ),
      ),
    ).toThrowError(expect.objectContaining({ operation: 'import-analysis', reason: 'not-object' }))
    expect(() => normalizePicodashFieldMap({ first: alpha, second: alpha })).toThrow(
      PicodashDocumentOptionsError,
    )
    expect(() => normalizePicodashScopeMap({ first: 'target', second: 'target' })).toThrow(
      PicodashDocumentOptionsError,
    )
    expect(
      normalizePicodashImportOptions({ allowForeignNexus: true, fieldMap: { retired: 'ignore' } }),
    ).toMatchObject({
      allowForeignNexus: true,
      fieldMap: [['retired', 'ignore']],
    })
  })
})

describe('redaction, migration, and overlay helpers', () => {
  it('strips redacted fields before migration and rebuilds a current document', () => {
    const document = decodePicodashDocument(rootDocument())
    const payload = documentToSchemaMigrationPayload(document)
    expect(Object.keys(payload.values)).toEqual(['alpha'])
    const migrated = migratePicodashDocument(document, 2, {
      1: (input) => ({
        schemaVersion: 2,
        values: { ...input.values, added: 2 },
        scopes: input.scopes,
      }),
    })
    expect(migrated.schemaVersion).toBe(2)
    expect(migrated.fields.map(([key]) => key)).toEqual(['added', 'alpha'])
    expect(stripRedactedPicodashDocumentFields(document).fields.map(([key]) => key)).toEqual([
      'alpha',
    ])
  })

  it('applies overlay-only field and metadata replacement with explicit creation', () => {
    const document = decodePicodashDocument(rootDocument())
    const overlay = buildPicodashDocumentOverlay({
      document,
      targetValues: { alpha: 'old', untouched: true },
      targetScopes: [],
      targetFieldKeys: ['alpha', 'untouched'],
      options: normalizePicodashImportOptions({ createMissingScopes: true }),
    })
    expect(overlay.values).toMatchObject({ alpha: { nested: ['value'] }, untouched: true })
    expect(overlay.changedFields).toEqual(['alpha'])
    expect(overlay.createdScopes).toEqual(['settings'])
    expect(overlay.scopes.map(([scopeId]) => scopeId)).toEqual(['settings'])
  })

  it('supports explicit remaps and ignores without leaking redacted values', () => {
    const document = decodePicodashDocument(rootDocument())
    const overlay = buildPicodashDocumentOverlay({
      document,
      targetValues: { renamed: 0 },
      targetScopes: [['settings', metadata]],
      targetFieldKeys: ['renamed'],
      options: normalizePicodashImportOptions({
        fieldMap: { alpha: { key: 'renamed' }, secret: 'ignore' },
      }),
    })
    expect(overlay.values.renamed).toEqual({ nested: ['value'] })
    expect(overlay.fieldRemaps).toEqual([['alpha', 'renamed']])
    expect(overlay.ignoredFields).toEqual([])
  })

  it('rejects collisions between explicit remaps and implicit same-key targets', () => {
    const document = decodePicodashDocument({
      ...rootDocument(),
      fields: [
        ['currentName', { status: 'included', value: 1 }],
        ['oldName', { status: 'included', value: 2 }],
      ],
    })
    expect(() =>
      buildPicodashDocumentOverlay({
        document,
        targetValues: { currentName: 0 },
        targetScopes: [],
        targetFieldKeys: ['currentName'],
        options: normalizePicodashImportOptions({
          fieldMap: { oldName: { key: 'currentName' } },
        }),
      }),
    ).toThrowError(
      expect.objectContaining({
        code: 'invalid-document-options',
        reason: 'duplicate-target',
      }),
    )
  })

  it('rejects scope collisions between explicit remaps and implicit same-ID targets', () => {
    const document = decodePicodashDocument({
      ...rootDocument(),
      scopes: [
        ['advanced', metadata],
        ['oldAdvanced', metadata],
      ],
    })
    expect(() =>
      buildPicodashDocumentOverlay({
        document,
        targetValues: { alpha: 'old' },
        targetScopes: [['advanced', metadata]],
        targetFieldKeys: ['alpha'],
        options: normalizePicodashImportOptions({
          scopeMap: { oldAdvanced: 'advanced' },
        }),
      }),
    ).toThrowError(
      expect.objectContaining({
        code: 'invalid-document-options',
        reason: 'duplicate-target',
      }),
    )
  })

  it('detaches unchanged target scopes in pure overlays', () => {
    const mutableMetadata: SerializedDurableScopeMetadata = {
      dashPanel: {
        placement: { mode: 'floating', disposition: { kind: 'free' } },
        preferredPosition: { x: 1, y: 2 },
      },
    }
    const overlay = buildPicodashDocumentOverlay({
      document: decodePicodashDocument({ ...rootDocument(), scopes: [] }),
      targetValues: { alpha: 'old' },
      targetScopes: [['unchanged', mutableMetadata]],
      targetFieldKeys: ['alpha'],
    })
    ;(mutableMetadata.dashPanel!.preferredPosition as { x: number; y: number }).x = 99
    expect(overlay.scopes).toEqual([
      [
        'unchanged',
        {
          dashPanel: {
            placement: { mode: 'floating', disposition: { kind: 'free' } },
            preferredPosition: { x: 1, y: 2 },
          },
        },
      ],
    ])
    expect(Object.isFrozen(overlay.scopes[0]![1])).toBe(true)
  })

  it('rejects a descendant remap onto the scoped root target', () => {
    const document = decodePicodashDocument({
      ...rootDocument(),
      kind: 'scope',
      scopeId: 'root',
      scopes: [['child', metadata]],
    })
    expect(() =>
      buildPicodashDocumentOverlay({
        document,
        targetValues: { alpha: 'old' },
        targetScopes: [['target', metadata]],
        targetFieldKeys: ['alpha'],
        options: normalizePicodashImportOptions({
          targetScopeId: 'target',
          scopeMap: { child: 'target' },
        }),
      }),
    ).toThrowError(
      expect.objectContaining({
        code: 'invalid-document-options',
        reason: 'duplicate-target',
      }),
    )
  })

  it('rejects an empty scope document targeting a missing scope', () => {
    const document = decodePicodashDocument({
      ...rootDocument(),
      kind: 'scope',
      scopeId: 'missing',
      scopes: [],
    })
    for (const options of [
      undefined,
      normalizePicodashImportOptions({ createMissingScopes: true }),
    ])
      expect(() =>
        buildPicodashDocumentOverlay({
          document,
          targetValues: { alpha: 'old' },
          targetScopes: [],
          targetFieldKeys: ['alpha'],
          ...(options === undefined ? {} : { options }),
        }),
      ).toThrowError(expect.objectContaining({ reason: 'missing_scope' }))
  })
})

describe('value-free review normalization', () => {
  it('sorts identities and rejects duplicate review effects', () => {
    const review = normalizePicodashImportPlanReview({
      kind: 'import-plan',
      documentKind: 'root',
      changedFields: ['beta', 'alpha'],
      changedScopeIds: ['scope'],
      ignoredFields: [],
      createdScopes: [],
      fieldRemaps: [['old', 'new']],
      scopeRemaps: [],
      foreignNexus: false,
    })
    expect(review.changedFields).toEqual(['alpha', 'beta'])
    expect(Object.isFrozen(review)).toBe(true)
  })
})

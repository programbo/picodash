import { describe, expect, it } from 'vite-plus/test'
import { fc, test as property } from '@fast-check/vitest'
import {
  decodeDashStackMetadataRecord,
  decodeDurableScopeMetadata,
  encodeDashStackMetadataRecord,
  encodeDurableScopeMetadata,
  normalizeDashStackMetadataRecord,
  normalizeDashPanelLayoutRecord,
  normalizeDurableScopeMetadata,
} from '../src/metadata.ts'

const snapPositions = [
  'top-left',
  'top',
  'top-right',
  'right',
  'bottom-right',
  'bottom',
  'bottom-left',
  'left',
] as const
const dockPositions = [
  'top-left',
  'top-right',
  'bottom-right',
  'bottom-left',
  'full-left',
  'center-left',
  'full-right',
  'center-right',
  'full-top',
  'center-top',
  'full-bottom',
  'center-bottom',
] as const
const placements = [
  { mode: 'floating', disposition: { kind: 'free' } },
  ...snapPositions.map((position) => ({
    mode: 'floating',
    disposition: { kind: 'snapped', position },
  })),
  ...dockPositions.map((position) => ({
    mode: 'fixed',
    disposition: { kind: 'docked', position },
  })),
  { mode: 'hybrid', disposition: { kind: 'free' } },
  { mode: 'hybrid', disposition: { kind: 'snapped', position: 'top' } },
  { mode: 'hybrid', disposition: { kind: 'snapped', position: 'bottom' } },
  ...dockPositions.map((position) => ({
    mode: 'hybrid',
    disposition: { kind: 'docked', position },
  })),
] as const

const listRecord = (rootOrder?: readonly string[]) => ({
  ...(rootOrder === undefined ? {} : { rootOrder }),
  groupOrders: new Map([
    ['group-b', ['b', 'a']],
    ['group-a', ['c']],
  ]),
  collapseOverrides: new Map([
    ['group-b', true],
    ['group-a', false],
  ]),
})

describe('Nexus built-in metadata codec', () => {
  it.each(placements)('accepts the %s placement family', (placement) => {
    const record = normalizeDashPanelLayoutRecord({ placement, preferredPosition: { x: 4, y: -2 } })
    expect(record.placement).toEqual(placement)
    expect(Object.isFrozen(record)).toBe(true)
    expect(Object.isFrozen(record.preferredPosition)).toBe(true)
  })

  it('covers every accepted snap and dock position', () => {
    expect(snapPositions).toHaveLength(8)
    expect(dockPositions).toHaveLength(12)
    for (const position of snapPositions)
      expect(() =>
        normalizeDashPanelLayoutRecord({
          placement: { mode: 'floating', disposition: { kind: 'snapped', position } },
          preferredPosition: { x: 0, y: 0 },
        }),
      ).not.toThrow()
    for (const position of dockPositions)
      for (const mode of ['fixed', 'hybrid'] as const)
        expect(() =>
          normalizeDashPanelLayoutRecord({
            placement: { mode, disposition: { kind: 'docked', position } },
            preferredPosition: { x: 0, y: 0 },
          }),
        ).not.toThrow()
  })

  it.each([
    { mode: 'floating', disposition: { kind: 'docked', position: 'top-left' } },
    { mode: 'fixed', disposition: { kind: 'free' } },
    { mode: 'fixed', disposition: { kind: 'snapped', position: 'top' } },
    { mode: 'hybrid', disposition: { kind: 'snapped', position: 'left' } },
    { mode: 'floating', disposition: { kind: 'snapped', position: 'center-left' } },
  ])('rejects invalid mode/disposition combinations', (placement) => {
    expect(() =>
      normalizeDashPanelLayoutRecord({ placement, preferredPosition: { x: 0, y: 0 } }),
    ).toThrow()
  })

  it.each([NaN, Infinity, -Infinity])('rejects non-finite coordinate %s', (coordinate) => {
    expect(() =>
      normalizeDashPanelLayoutRecord({
        placement: placements[0],
        preferredPosition: { x: coordinate, y: 0 },
      }),
    ).toThrow()
    expect(() =>
      normalizeDashPanelLayoutRecord({
        placement: placements[0],
        preferredPosition: { x: 0, y: coordinate },
      }),
    ).toThrow()
  })

  it('round-trips maps through duplicate-checked entry arrays and sorts deterministically', () => {
    const normalized = normalizeDashStackMetadataRecord(listRecord(['a', 'b']))
    const encoded = encodeDashStackMetadataRecord(normalized)
    expect(encoded.groupOrders).toEqual([
      ['group-a', ['c']],
      ['group-b', ['b', 'a']],
    ])
    expect(encoded.collapseOverrides).toEqual([
      ['group-a', false],
      ['group-b', true],
    ])
    expect(Object.isFrozen(encoded)).toBe(true)
    expect(Object.isFrozen(encoded.groupOrders)).toBe(true)
    expect(Object.isFrozen(encoded.groupOrders[0])).toBe(true)
    expect(Object.isFrozen(encoded.groupOrders[0]![1])).toBe(true)
    const decoded = decodeDashStackMetadataRecord(encoded)
    expect([...decoded.groupOrders.entries()]).toEqual([...normalized.groupOrders.entries()])
    expect([...decoded.collapseOverrides.entries()]).toEqual([
      ...normalized.collapseOverrides.entries(),
    ])
    expect(JSON.stringify(encodeDashStackMetadataRecord(decoded))).toBe(JSON.stringify(encoded))
  })

  it('rejects duplicate serialized keys and malformed identifiers', () => {
    const encoded = encodeDashStackMetadataRecord(normalizeDashStackMetadataRecord(listRecord()))
    expect(() =>
      decodeDashStackMetadataRecord({
        ...encoded,
        groupOrders: [...encoded.groupOrders, ['group-a', ['x']]],
      }),
    ).toThrow()
    expect(() =>
      normalizeDashStackMetadataRecord({
        ...listRecord(),
        groupOrders: new Map([[' ', ['x']]]),
      }),
    ).toThrow()
    expect(() =>
      decodeDashStackMetadataRecord({
        ...encoded,
        collapseOverrides: [['\u0000', true]],
      }),
    ).toThrow()
  })

  it('detaches mutable caller references and exposes immutable maps', () => {
    const rootOrder = ['one', 'two']
    const groupOrder = ['child']
    const groups = new Map([['group', groupOrder]])
    const collapses = new Map([['group', true]])
    const normalized = normalizeDashStackMetadataRecord({
      rootOrder,
      groupOrders: groups,
      collapseOverrides: collapses,
    })
    rootOrder.push('three')
    groupOrder[0] = 'changed'
    groups.set('other', ['x'])
    collapses.set('other', false)
    expect(normalized.rootOrder).toEqual(['one', 'two'])
    expect([...normalized.groupOrders.entries()]).toEqual([['group', ['child']]])
    expect(() => (normalized.groupOrders as Map<string, readonly string[]>).set('x', [])).toThrow()
    expect(() => Map.prototype.set.call(normalized.groupOrders, 'x', [])).toThrow()
    expect(normalized.groupOrders.size).toBe(1)
    expect([...normalized.groupOrders.keys()]).toEqual(['group'])
    expect([...normalized.groupOrders.values()]).toEqual([['child']])
    const seen: string[] = []
    normalized.groupOrders.forEach((_value, key, map) => {
      seen.push(key)
      expect(map).toBe(normalized.groupOrders)
    })
    expect(seen).toEqual(['group'])
  })

  it.each([
    '',
    ' ',
    '\t',
    '\n',
    ' leading',
    'trailing ',
    '\u0000',
    '\u001f',
    '\u007f',
    '\u0085',
    '\u009f',
  ])('rejects invalid identifier %j', (id) => {
    expect(() =>
      normalizeDashStackMetadataRecord({
        ...listRecord(),
        groupOrders: new Map([[id, ['child']]]),
      }),
    ).toThrow()
  })

  it.each(['group/name', 'group.name', 'group:name', 'group__name'])(
    'allows punctuation identifier %s',
    (id) => {
      expect(() =>
        normalizeDashStackMetadataRecord({
          ...listRecord(),
          groupOrders: new Map([[id, ['child']]]),
        }),
      ).not.toThrow()
    },
  )

  it('rejects hostile object descriptors and sparse arrays at the JSON boundary', () => {
    const accessor: Record<string, unknown> = {}
    Object.defineProperty(accessor, 'groupOrders', { enumerable: true, get: () => new Map() })
    expect(() => normalizeDashStackMetadataRecord(accessor)).toThrow()
    expect(() =>
      normalizeDashStackMetadataRecord({
        ...listRecord(),
        rootOrder: Object.assign([], { extra: true }),
      }),
    ).toThrow()
    expect(() =>
      normalizeDashStackMetadataRecord({
        ...listRecord(),
        rootOrder: Object.assign([], { [Symbol('private')]: 'x' }),
      }),
    ).toThrow()
    const hidden = ['child']
    Object.defineProperty(hidden, '0', { enumerable: false, value: 'child' })
    expect(() =>
      normalizeDashStackMetadataRecord({
        ...listRecord(),
        rootOrder: hidden,
      }),
    ).toThrow()
  })

  it('requires own metadata members and ignores inherited optional members', () => {
    const previousGroupOrders = Object.getOwnPropertyDescriptor(Object.prototype, 'groupOrders')
    const previousRootOrder = Object.getOwnPropertyDescriptor(Object.prototype, 'rootOrder')
    const previousDashStack = Object.getOwnPropertyDescriptor(Object.prototype, 'dashStack')
    try {
      Object.defineProperty(Object.prototype, 'groupOrders', {
        configurable: true,
        enumerable: false,
        value: new Map(),
      })
      Object.defineProperty(Object.prototype, 'rootOrder', {
        configurable: true,
        enumerable: false,
        value: ['inherited'],
      })
      expect(() => normalizeDashStackMetadataRecord({ collapseOverrides: new Map() })).toThrow()
      const normalized = normalizeDashStackMetadataRecord({
        groupOrders: new Map(),
        collapseOverrides: new Map(),
      })
      expect(normalized.rootOrder).toBeUndefined()

      Object.defineProperty(Object.prototype, 'dashStack', {
        configurable: true,
        enumerable: false,
        value: { groupOrders: new Map(), collapseOverrides: new Map() },
      })
      expect(normalizeDurableScopeMetadata({})).toBeUndefined()
      expect(decodeDurableScopeMetadata({})).toBeUndefined()
    } finally {
      if (previousGroupOrders)
        Object.defineProperty(Object.prototype, 'groupOrders', previousGroupOrders)
      else delete (Object.prototype as Record<string, unknown>).groupOrders
      if (previousRootOrder) Object.defineProperty(Object.prototype, 'rootOrder', previousRootOrder)
      else delete (Object.prototype as Record<string, unknown>).rootOrder
      if (previousDashStack) Object.defineProperty(Object.prototype, 'dashStack', previousDashStack)
      else delete (Object.prototype as Record<string, unknown>).dashStack
    }
  })

  it('converts hostile map and reflection failures to the stable private error', () => {
    class HostileMap extends Map<string, readonly string[]> {
      override entries(): MapIterator<[string, readonly string[]]> {
        throw new TypeError('PRIVATE_MAP_FAILURE')
      }
    }
    expect(() =>
      normalizeDashStackMetadataRecord({
        groupOrders: new HostileMap(),
        collapseOverrides: new Map(),
      }),
    ).toThrow('Invalid Nexus metadata record.')
    const encoded = encodeDashStackMetadataRecord(normalizeDashStackMetadataRecord(listRecord()))
    const hostileTuple = new Proxy(encoded.groupOrders[0]!, {
      get(target, property, receiver) {
        if (property === 'length') throw new Error('PRIVATE_TUPLE_LENGTH_FAILURE')
        return Reflect.get(target, property, receiver)
      },
    })
    expect(() =>
      decodeDashStackMetadataRecord({
        ...encoded,
        groupOrders: [hostileTuple],
      }),
    ).toThrow('Invalid Nexus metadata record.')
    const revokedRoot = Proxy.revocable(['child'], {})
    revokedRoot.revoke()
    expect(() =>
      normalizeDashStackMetadataRecord({
        ...listRecord(),
        rootOrder: revokedRoot.proxy,
      }),
    ).toThrow('Invalid Nexus metadata record.')
    const revokedMap = Proxy.revocable(encoded.groupOrders, {})
    revokedMap.revoke()
    expect(() =>
      decodeDashStackMetadataRecord({
        ...encoded,
        groupOrders: revokedMap.proxy,
      }),
    ).toThrow('Invalid Nexus metadata record.')
    const revokedTuple = Proxy.revocable(encoded.groupOrders[0]!, {})
    revokedTuple.revoke()
    expect(() =>
      decodeDashStackMetadataRecord({
        ...encoded,
        groupOrders: [revokedTuple.proxy],
      }),
    ).toThrow('Invalid Nexus metadata record.')
    expect(() =>
      normalizeDashStackMetadataRecord({
        groupOrders: new Proxy(new Map(), {
          getPrototypeOf() {
            throw new Error('PRIVATE_PROXY_FAILURE')
          },
        }),
        collapseOverrides: new Map(),
      }),
    ).toThrow('Invalid Nexus metadata record.')
    expect(() =>
      normalizeDashStackMetadataRecord(
        new Proxy(listRecord(), {
          getOwnPropertyDescriptor() {
            throw new Error('PRIVATE_REFLECTION_FAILURE')
          },
        }),
      ),
    ).toThrow('Invalid Nexus metadata record.')
    expect(() =>
      normalizeDashStackMetadataRecord(
        new Proxy(listRecord(), {
          get(target, property, receiver) {
            if (property === 'groupOrders') throw new Error('PRIVATE_GET_FAILURE')
            return Reflect.get(target, property, receiver)
          },
        }),
      ),
    ).toThrow('Invalid Nexus metadata record.')
    const hostileIds = new Proxy(['child'], {
      get(target, property, receiver) {
        if (property === '0') throw new Error('PRIVATE_ARRAY_GET_FAILURE')
        return Reflect.get(target, property, receiver)
      },
    })
    expect(() =>
      normalizeDashStackMetadataRecord({
        ...listRecord(),
        rootOrder: hostileIds,
      }),
    ).toThrow('Invalid Nexus metadata record.')
  })

  it('omits empty product domains and excludes UI-only fields', () => {
    expect(
      normalizeDurableScopeMetadata({
        dashStack: { groupOrders: new Map(), collapseOverrides: new Map() },
        dashPanel: undefined,
      }),
    ).toBeUndefined()
    expect(
      normalizeDurableScopeMetadata({
        dashStack: { rootOrder: [], groupOrders: new Map(), collapseOverrides: new Map() },
        dashPanel: undefined,
      }),
    ).toBeUndefined()
    const scope = normalizeDurableScopeMetadata({
      dashStack: undefined,
      dashPanel: {
        placement: placements[2],
        preferredPosition: { x: 1, y: 2 },
      },
    })!
    expect(scope.dashPanel).toBeDefined()
    expect(() =>
      normalizeDurableScopeMetadata({
        dashStack: undefined,
        dashPanel: {
          placement: placements[2],
          preferredPosition: { x: 1, y: 2 },
          visibility: 'hidden',
          size: 300,
        },
      }),
    ).toThrow()
  })

  it('uses only the DashStack metadata identity across encoding and decoding', () => {
    const record = normalizeDashStackMetadataRecord(listRecord(['a']))
    const encoded = encodeDurableScopeMetadata({ dashStack: record })!
    expect(Object.keys(encoded)).toEqual(['dashStack'])
    expect(decodeDurableScopeMetadata(encoded)?.dashStack?.rootOrder).toEqual(['a'])
    expect(() => decodeDurableScopeMetadata({ dashList: encoded.dashStack })).toThrow(
      'Invalid Nexus metadata record.',
    )
    expect(() => decodeDurableScopeMetadata({ ...encoded, dashList: encoded.dashStack })).toThrow(
      'Invalid Nexus metadata record.',
    )
    expect(() => normalizeDurableScopeMetadata({ dashList: record })).toThrow(
      'Invalid Nexus metadata record.',
    )
  })

  it('validates a complete scope atomically', () => {
    expect(() =>
      decodeDurableScopeMetadata({
        dashStack: encodeDashStackMetadataRecord(
          normalizeDashStackMetadataRecord(listRecord(['a'])),
        ),
        dashPanel: {
          placement: { mode: 'fixed', disposition: { kind: 'free' } },
          preferredPosition: { x: 0, y: 0 },
        },
      }),
    ).toThrow()
  })

  property.prop([
    fc.uniqueArray(fc.stringMatching(/^[a-z][a-z0-9_-]{0,5}$/), { minLength: 1, maxLength: 5 }),
  ])('round-trips deterministic list records', (ids) => {
    const record = normalizeDashStackMetadataRecord({
      rootOrder: ids,
      groupOrders: new Map([['group', ids]]),
      collapseOverrides: new Map([['group', true]]),
    })
    const encoded = encodeDurableScopeMetadata({ dashStack: record })!
    const decoded = decodeDurableScopeMetadata(encoded)!
    expect(JSON.stringify(encodeDurableScopeMetadata(decoded))).toBe(JSON.stringify(encoded))
  })
})

it('round-trips panel hotkeys independently and rejects malformed serialized preferences', () => {
  const metadata = { dashPanelHotkey: 'Mod+Shift+[KeyK]' }
  expect(encodeDurableScopeMetadata(decodeDurableScopeMetadata(metadata))).toEqual(metadata)
  for (const invalid of [undefined, null, '', 'x'.repeat(129), ' key ', 3])
    expect(() => decodeDurableScopeMetadata({ dashPanelHotkey: invalid })).toThrow()
})

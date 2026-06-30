import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createElement } from 'react'
import {
  createTweakerStore,
  defineTweakerControl,
  mergeTweakerControls,
  normalizeControl,
  type JsonValue,
  type NormalizedControl,
  type RegisterOptions,
  type TweakerControlRegistry,
  type TweakerSchema,
} from '../src/index.js'
import {
  defaultValueForControl,
  formatDisplayValue,
  formatSliderValue,
  sanitizeValueForControl,
} from '../src/control.js'
import { registrationSignatureForSchema, resolveTweakerValues } from '../src/react/use-tweaker.js'

class MemoryStorage {
  private values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  clear() {
    this.values.clear()
  }
}

const storage = new MemoryStorage()

beforeEach(() => {
  storage.clear()
  vi.stubGlobal('window', { localStorage: storage })
})

function registerWithRegistry(
  store: ReturnType<typeof createTweakerStore>,
  schema: TweakerSchema,
  options: RegisterOptions,
  registry: TweakerControlRegistry,
) {
  store.getState().register(schema, { ...options, registry } as RegisterOptions & {
    registry: TweakerControlRegistry
  })
}

describe('normalizeControl', () => {
  it('keeps legacy default-panel ids for section string registrations', () => {
    const control = normalizeControl('demo', 'Rendering', 'speed', {
      defaultValue: 0.5,
      min: 0,
      max: 1,
    })

    expect(control.kind).toBe('slider')
    expect(control.id).toBe('demo:Rendering:speed')
    expect(control.panelId).toBe('default')
    expect(control.sectionId).toBe('Rendering')
  })

  it('normalizes select records into label/value options', () => {
    const control = normalizeControl('demo', 'Material', 'shape', {
      type: 'select',
      defaultValue: 'orb',
      options: { Orb: 'orb', Prism: 'prism' },
    })

    expect(control.options).toEqual([
      { label: 'Orb', value: 'orb' },
      { label: 'Prism', value: 'prism' },
    ])
  })

  it('normalizes status metadata on object controls', () => {
    const info = normalizeControl('demo', 'Rendering', 'speed', {
      defaultValue: 0.5,
      min: 0,
      max: 1,
      status: 'info',
    })
    const alert = normalizeControl('demo', 'Rendering', 'exposure', {
      type: 'number',
      defaultValue: 1,
      status: 'alert',
    })
    const error = normalizeControl('demo', 'Rendering', 'bloom', {
      type: 'checkbox',
      defaultValue: true,
      status: 'error',
    })

    expect(info.status).toBe('info')
    expect(alert.status).toBe('alert')
    expect(error.status).toBe('error')
  })

  it('normalizes help metadata on object controls', () => {
    const control = normalizeControl('demo', 'Rendering', 'speed', {
      defaultValue: 0.5,
      min: 0,
      max: 1,
      help: 'Adjusts the preview animation speed.',
    })

    expect(control.help).toBe('Adjusts the preview animation speed.')
  })

  it('normalizes formatted help content on object controls', () => {
    const help = createElement(
      'span',
      null,
      createElement('strong', null, 'Speed'),
      ' affects motion.',
    )
    const control = normalizeControl('demo', 'Rendering', 'speed', {
      defaultValue: 0.5,
      min: 0,
      max: 1,
      help,
    })

    expect(control.help).toEqual(help)
  })

  it('omits empty string help metadata on object controls', () => {
    const control = normalizeControl('demo', 'Rendering', 'speed', {
      defaultValue: 0.5,
      min: 0,
      max: 1,
      help: '   ',
    })

    expect(control.help).toBeUndefined()
  })

  it('normalizes description metadata on object controls', () => {
    const control = normalizeControl('demo', 'Rendering', 'speed', {
      defaultValue: 0.5,
      min: 0,
      max: 1,
      description: createElement('span', null, 'Current speed'),
    })

    expect(control.description).toEqual(createElement('span', null, 'Current speed'))
  })

  it('normalizes readOnly metadata on object controls', () => {
    const number = normalizeControl('demo', 'Rendering', 'exposure', {
      type: 'number',
      defaultValue: 1,
      readOnly: true,
    })
    const checkbox = normalizeControl('demo', 'Rendering', 'bloom', {
      type: 'checkbox',
      defaultValue: true,
      readOnly: true,
    })
    const unset = normalizeControl('demo', 'Rendering', 'speed', {
      defaultValue: 0.5,
      min: 0,
      max: 1,
    })

    expect(number.readOnly).toBe(true)
    expect(checkbox.readOnly).toBe(true)
    expect(unset.readOnly).toBeUndefined()
  })

  it('normalizes custom controls with JSON defaults', () => {
    const store = createTweakerStore({ id: 'custom', persistence: false })
    store.getState().register(
      {
        position: {
          type: 'vector3',
          id: 'position',
          defaultValue: [0, 1, 0],
          label: 'Position',
          format: 'cartesian',
          size: 'compact',
        },
      },
      { panel: 'scene', section: { id: 'transform', label: 'Transform' } },
    )

    expect(store.getState().controls[0]).toMatchObject({
      kind: 'custom',
      type: 'vector3',
      persistId: 'custom:scene:transform:position',
      value: [0, 1, 0],
      settings: { format: 'cartesian', size: 'compact' },
      help: undefined,
    })
  })

  it('normalizes display controls with number and string defaults', () => {
    const numberDisplay = normalizeControl('demo', 'Rendering', 'total', {
      type: 'display',
      defaultValue: 42,
      label: 'Total',
      formatOptions: { maximumFractionDigits: 1 },
      format: 'Total: {value}',
    })
    expect(numberDisplay).toMatchObject({
      kind: 'display',
      type: 'display',
      label: 'Total',
      value: 42,
      defaultValue: 42,
      formatOptions: { maximumFractionDigits: 1 },
      format: 'Total: {value}',
    })

    const stringDisplay = normalizeControl('demo', 'Rendering', 'status', {
      type: 'display',
      defaultValue: 'ready',
    })
    expect(stringDisplay.value).toBe('ready')
    expect(stringDisplay.formatOptions).toBeUndefined()
  })

  it('normalizes extension metadata through control definitions', () => {
    function GraphControl() {
      return null
    }

    const telemetryGraph = defineTweakerControl<JsonValue>({
      type: '@demo/telemetry-graph',
      valueMode: 'transient',
      layout: 'block',
      component: GraphControl,
      normalize: () => ({
        valueMode: 'display',
        layout: 'full',
        height: 96,
        minHeight: 72,
        settings: { stroke: '#8bd5ff' },
      }),
      sanitize: (value) =>
        Array.isArray(value) ? value.filter((item) => typeof item === 'number') : [],
      equals: (left, right) => {
        if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length)
          return false
        return left.every(
          (value, index) =>
            typeof value === 'number' &&
            typeof right[index] === 'number' &&
            Math.abs(value - right[index]) < 0.01,
        )
      },
    })
    const registry = mergeTweakerControls(telemetryGraph)
    const store = createTweakerStore({ id: 'extensions', persistence: false })

    expect(telemetryGraph.config({ type: '@demo/other', defaultValue: [] } as never).type).toBe(
      '@demo/telemetry-graph',
    )

    registerWithRegistry(
      store,
      {
        graph: {
          type: '@demo/telemetry-graph',
          defaultValue: [0, 1, 0],
          settings: { sampleRate: 60 },
        },
        graphOverride: {
          type: '@demo/telemetry-graph',
          defaultValue: [1],
          valueMode: 'input',
          layout: 'inline',
        },
      },
      { section: 'Telemetry' },
      registry,
    )

    const control = store.getState().controls.find((item) => item.key === 'graph')
    expect(control).toMatchObject({
      kind: 'custom',
      rendererType: '@demo/telemetry-graph',
      valueMode: 'transient',
      layout: 'block',
      height: 96,
      minHeight: 72,
      settings: { sampleRate: 60, stroke: '#8bd5ff' },
    })
    expect(store.getState().controls.find((item) => item.key === 'graphOverride')).toMatchObject({
      valueMode: 'input',
      layout: 'inline',
    })

    store.getState().setValue('extensions:Telemetry:graph', [2, 'bad', 4] as never)
    expect(store.getState().controls.find((item) => item.key === 'graph')?.value).toEqual([2, 4])
    expect(store.getState().values['extensions:Telemetry:graph']).toBeUndefined()

    store.getState().resetValues()
    expect(store.getState().controls.find((item) => item.key === 'graph')?.value).toEqual([2, 4])

    const listener = vi.fn()
    store.subscribe(listener)
    store.getState().setValue('extensions:Telemetry:graph', [2.001, 4.001])
    expect(listener).not.toHaveBeenCalled()
  })

  it('warns when duplicate extension type ids are merged', () => {
    function FirstControl() {
      return null
    }
    function SecondControl() {
      return null
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    try {
      mergeTweakerControls(
        defineTweakerControl({ type: '@demo/duplicate', component: FirstControl }),
        defineTweakerControl({ type: '@demo/duplicate', component: SecondControl }),
      )

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('@demo/duplicate'))
    } finally {
      warn.mockRestore()
    }
  })
})

describe('sanitizeValueForControl', () => {
  function control(overrides: Partial<NormalizedControl> = {}): NormalizedControl {
    return {
      id: 'x',
      persistId: 'x',
      domId: 'x',
      key: 'x',
      controlId: 'x',
      panelId: 'default',
      sectionId: 's',
      sectionLabel: 's',
      section: 's',
      reorderable: true,
      sortable: true,
      kind: 'number',
      type: 'number',
      rendererType: 'number',
      valueMode: 'input',
      layout: 'inline',
      label: 'x',
      value: 0,
      defaultValue: 0,
      ...overrides,
    }
  }

  it('clamps numbers and sliders within min/max', () => {
    const numeric = control({ kind: 'number', defaultValue: 1, min: 0, max: 10 })
    expect(sanitizeValueForControl(numeric, 15)).toBe(10)
    expect(sanitizeValueForControl(numeric, -3)).toBe(0)
    expect(sanitizeValueForControl(numeric, 5)).toBe(5)

    const slider = control({ kind: 'slider', defaultValue: 0.5, min: 0, max: 1 })
    expect(sanitizeValueForControl(slider, 5)).toBe(1)
  })

  it('falls back to the default when a number value is non-numeric', () => {
    const numeric = control({ kind: 'number', defaultValue: 2, min: 0, max: 10 })
    expect(sanitizeValueForControl(numeric, 'oops' as never)).toBe(2)
  })

  it('keeps select values that are still in options', () => {
    const select = control({
      kind: 'select',
      defaultValue: 'a',
      options: [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
      ],
    })
    expect(sanitizeValueForControl(select, 'b')).toBe('b')
  })

  it('falls back to the default, else the first option, when a value leaves options', () => {
    const withValidDefault = control({
      kind: 'select',
      defaultValue: 'a',
      options: [{ label: 'A', value: 'a' }],
    })
    expect(sanitizeValueForControl(withValidDefault, 'removed')).toBe('a')

    const withStaleDefault = control({
      kind: 'select',
      defaultValue: 'gone',
      options: [
        { label: 'First', value: 'first' },
        { label: 'Second', value: 'second' },
      ],
    })
    expect(sanitizeValueForControl(withStaleDefault, 'removed')).toBe('first')
  })

  it('coerces checkbox values to boolean', () => {
    const checkbox = control({ kind: 'checkbox', defaultValue: true })
    expect(sanitizeValueForControl(checkbox, true)).toBe(true)
    expect(sanitizeValueForControl(checkbox, 'yes' as never)).toBe(true)
  })

  it('leaves custom JSON values untouched', () => {
    const custom = control({ kind: 'custom', defaultValue: [1, 2, 3] })
    const value = [1, 2, 3]
    expect(sanitizeValueForControl(custom, value)).toBe(value)
  })

  it('keeps number/string display values and falls back for invalid types', () => {
    const numeric = control({ kind: 'display', defaultValue: 42 })
    expect(sanitizeValueForControl(numeric, 42)).toBe(42)
    // A string is a valid display value even on a numeric-default control.
    expect(sanitizeValueForControl(numeric, 'oops' as never)).toBe('oops')
    // Non-number/string values fall back to the default.
    expect(sanitizeValueForControl(numeric, [1, 2] as never)).toBe(42)

    const textual = control({ kind: 'display', defaultValue: 'hello' })
    expect(sanitizeValueForControl(textual, 'hello')).toBe('hello')
    expect(sanitizeValueForControl(textual, 7)).toBe(7)
    expect(sanitizeValueForControl(textual, { x: 1 } as never)).toBe('hello')
  })
})

describe('formatDisplayValue', () => {
  function displayControl(
    value: number | string,
    overrides: Partial<NormalizedControl> = {},
  ): NormalizedControl {
    return {
      id: 'x',
      persistId: 'x',
      domId: 'x',
      key: 'x',
      controlId: 'x',
      panelId: 'default',
      sectionId: 's',
      sectionLabel: 's',
      section: 's',
      reorderable: true,
      sortable: true,
      kind: 'display',
      type: 'display',
      rendererType: 'display',
      valueMode: 'display',
      layout: 'inline',
      label: 'x',
      value,
      defaultValue: value,
      ...overrides,
    }
  }

  it('renders plain numbers and strings', () => {
    expect(formatDisplayValue(displayControl(42))).toBe('42')
    expect(formatDisplayValue(displayControl('ready'))).toBe('ready')
  })

  it('applies Intl formatOptions to numbers', () => {
    const formatOptions = { style: 'unit', unit: 'millimeter' } satisfies Intl.NumberFormatOptions
    const mm = displayControl(35, { formatOptions })
    expect(formatDisplayValue(mm)).toBe(new Intl.NumberFormat(undefined, formatOptions).format(35))
  })

  it('applies a format template after number formatting', () => {
    const total = displayControl(12.5, {
      formatOptions: { maximumFractionDigits: 1 },
      format: 'Total: {value}',
    })
    expect(formatDisplayValue(total)).toBe('Total: 12.5')
  })

  it('applies a format template to strings', () => {
    const labeled = displayControl('on', { format: 'Status: {value}' })
    expect(formatDisplayValue(labeled)).toBe('Status: on')
  })
})

describe('formatSliderValue', () => {
  function sliderControl(
    value: number,
    overrides: Partial<NormalizedControl> = {},
  ): NormalizedControl {
    return {
      id: 'x',
      persistId: 'x',
      domId: 'x',
      key: 'x',
      controlId: 'x',
      panelId: 'default',
      sectionId: 's',
      sectionLabel: 's',
      section: 's',
      reorderable: true,
      sortable: true,
      kind: 'slider',
      type: 'slider',
      rendererType: 'slider',
      valueMode: 'input',
      layout: 'inline',
      label: 'x',
      value,
      defaultValue: value,
      min: 0,
      max: 1,
      step: 0.01,
      ...overrides,
    }
  }

  it('infers output fraction digits from step', () => {
    expect(formatSliderValue(sliderControl(1, { step: 1 }))).toBe('1')
    expect(formatSliderValue(sliderControl(0.5, { step: 0.1 }))).toBe('0.5')
    expect(formatSliderValue(sliderControl(0.5, { step: 0.01 }))).toBe('0.50')
    expect(formatSliderValue(sliderControl(0.005, { step: 0.001 }))).toBe('0.005')
  })

  it('applies Intl formatOptions to slider output', () => {
    expect(
      formatSliderValue(
        sliderControl(0.345, {
          step: 0.01,
          formatOptions: { style: 'percent', maximumFractionDigits: 1 },
        }),
      ),
    ).toBe('34.5%')
  })
})

describe('control defaults', () => {
  it('extracts default values from every supported control shape', () => {
    expect(defaultValueForControl(1)).toBe(1)
    expect(defaultValueForControl(true)).toBe(true)
    expect(defaultValueForControl('green')).toBe('green')
    expect(defaultValueForControl({ type: 'number', defaultValue: 2 })).toBe(2)
    expect(defaultValueForControl({ type: 'number', value: 3 })).toBe(3)
    expect(defaultValueForControl({ type: 'slider', defaultValue: 0.5, min: 0, max: 1 })).toBe(0.5)
    expect(defaultValueForControl({ type: 'select', defaultValue: 'orb', options: ['orb'] })).toBe(
      'orb',
    )
    expect(defaultValueForControl({ type: 'checkbox', defaultValue: false })).toBe(false)
  })
})

describe('resolveTweakerValues', () => {
  const section = { id: 'Rendering', label: 'Rendering' }

  it('returns schema defaults before controls are registered', () => {
    const values = resolveTweakerValues(
      {
        exposure: { defaultValue: 1, min: 0, max: 4 },
        bloom: false,
        tint: { type: 'select', defaultValue: 'green', options: ['green', 'amber'] },
      },
      'hook',
      'default',
      section,
      [],
      {},
    )

    expect(values).toEqual({ exposure: 1, bloom: false, tint: 'green' })
  })

  it('prefers persisted values over schema defaults before controls are registered', () => {
    const values = resolveTweakerValues(
      {
        exposure: { defaultValue: 1, min: 0, max: 4 },
        bloom: true,
      },
      'hook',
      'default',
      section,
      [],
      {
        'hook:Rendering:exposure': 3,
        'hook:Rendering:bloom': false,
      },
    )

    expect(values).toEqual({ exposure: 3, bloom: false })
  })

  it('prefers live control values over persisted values', () => {
    const controls = [
      normalizeControl('hook', 'Rendering', 'exposure', {
        defaultValue: 2,
        min: 0,
        max: 4,
      }),
    ] satisfies NormalizedControl[]
    const values = resolveTweakerValues(
      { exposure: { defaultValue: 1, min: 0, max: 4 } },
      'hook',
      'default',
      section,
      controls,
      { 'hook:Rendering:exposure': 3 },
    )

    expect(values).toEqual({ exposure: 2 })
  })
})

describe('schema signatures', () => {
  it('tracks status metadata changes', () => {
    const base = {
      speed: { defaultValue: 1, min: 0, max: 2, status: 'info' },
    } satisfies TweakerSchema
    const next = {
      speed: { defaultValue: 1, min: 0, max: 2, status: 'error' },
    } satisfies TweakerSchema

    expect(registrationSignatureForSchema(base)).not.toBe(registrationSignatureForSchema(next))
  })

  it('tracks help metadata changes', () => {
    const base = {
      speed: { defaultValue: 1, min: 0, max: 2, help: 'Old help' },
    } satisfies TweakerSchema
    const next = {
      speed: { defaultValue: 1, min: 0, max: 2, help: 'New help' },
    } satisfies TweakerSchema

    expect(registrationSignatureForSchema(base)).not.toBe(registrationSignatureForSchema(next))
  })

  it('tracks formatted help metadata changes', () => {
    const base = {
      speed: {
        defaultValue: 1,
        min: 0,
        max: 2,
        help: createElement('span', null, 'Old help'),
      },
    } satisfies TweakerSchema
    const next = {
      speed: {
        defaultValue: 1,
        min: 0,
        max: 2,
        help: createElement('span', null, 'New help'),
      },
    } satisfies TweakerSchema

    expect(registrationSignatureForSchema(base)).not.toBe(registrationSignatureForSchema(next))
  })

  it('tracks description metadata changes', () => {
    const base = {
      speed: {
        defaultValue: 1,
        min: 0,
        max: 2,
        description: createElement('span', null, 'Speed 1'),
      },
    } satisfies TweakerSchema
    const next = {
      speed: {
        defaultValue: 1,
        min: 0,
        max: 2,
        description: createElement('span', null, 'Speed 2'),
      },
    } satisfies TweakerSchema

    expect(registrationSignatureForSchema(base)).not.toBe(registrationSignatureForSchema(next))
  })

  it('tracks formatOptions metadata changes', () => {
    const base = {
      speed: {
        type: 'number',
        defaultValue: 1,
        min: 0,
        max: 2,
        formatOptions: { maximumFractionDigits: 1 },
      },
    } satisfies TweakerSchema
    const next = {
      speed: {
        type: 'number',
        defaultValue: 1,
        min: 0,
        max: 2,
        formatOptions: { style: 'percent' },
      },
    } satisfies TweakerSchema

    expect(registrationSignatureForSchema(base)).not.toBe(registrationSignatureForSchema(next))
  })

  it('tracks readOnly metadata changes', () => {
    const base = {
      speed: { type: 'number', defaultValue: 1, min: 0, max: 2, readOnly: false },
    } satisfies TweakerSchema
    const next = {
      speed: { type: 'number', defaultValue: 1, min: 0, max: 2, readOnly: true },
    } satisfies TweakerSchema

    expect(registrationSignatureForSchema(base)).not.toBe(registrationSignatureForSchema(next))
  })
})

describe('TweakerStore', () => {
  it('persists values and clamps numeric updates', () => {
    const schema = {
      exposure: { defaultValue: 1, min: 0, max: 4 },
    } satisfies TweakerSchema
    const store = createTweakerStore({ id: 'store' })

    store.getState().register(schema, { section: 'Rendering' })
    store.getState().setValue('store:Rendering:exposure', 8)

    const next = createTweakerStore({ id: 'store' })
    next.getState().register(schema, { section: 'Rendering' })

    expect(next.getState().controls[0]?.value).toBe(4)
  })

  it('does not notify when setValue resolves to the current value', () => {
    const store = createTweakerStore({ id: 'stable-value', persistence: false })
    const listener = vi.fn()

    store.getState().register({ speed: { defaultValue: 1, min: 0, max: 2 } }, { section: 'Tuning' })
    store.subscribe(listener)

    store.getState().setValue('stable-value:Tuning:speed', 1)
    store.getState().setValue('stable-value:Tuning:speed', 99)
    store.getState().setValue('stable-value:Tuning:speed', 2)
    expect(listener).toHaveBeenCalledTimes(1)

    listener.mockClear()
    store.getState().setValue('stable-value:Tuning:speed', 99)

    expect(listener).not.toHaveBeenCalled()
  })

  it('only replaces the changed control object during value writes', () => {
    const store = createTweakerStore({ id: 'targeted-value', persistence: false })

    store.getState().register(
      {
        speed: { defaultValue: 1, min: 0, max: 2 },
        exposure: { type: 'number', defaultValue: 1, min: 0, max: 4 },
      },
      { section: 'Tuning' },
    )

    const before = store.getState().controls
    store.getState().setValue('targeted-value:Tuning:speed', 1.5)
    const after = store.getState().controls

    expect(after).not.toBe(before)
    expect(after[0]).not.toBe(before[0])
    expect(after[1]).toBe(before[1])
  })

  it('stores panel and section-local order', () => {
    const store = createTweakerStore({ id: 'order', persistence: false })
    store.getState().register({ a: 1, b: 2 }, { panel: 'scene', section: 'Rendering' })
    store
      .getState()
      .setSectionOrder('scene', 'Rendering', ['order:scene:Rendering:b', 'order:scene:Rendering:a'])

    expect(store.getState().order.scene?.Rendering).toEqual([
      'order:scene:Rendering:b',
      'order:scene:Rendering:a',
    ])
  })

  it('preserves section order across unregister and re-register', () => {
    const store = createTweakerStore({ id: 'section-order', persistence: false })
    const unregisterRendering = store
      .getState()
      .register({ speed: 1 }, { section: { id: 'rendering', label: 'Rendering' } })
    store.getState().register({ shape: 'orb' }, { section: { id: 'material', label: 'Material' } })
    store.getState().register({ zoom: 1 }, { section: { id: 'camera', label: 'Camera' } })

    expect(store.getState().sectionOrder.default).toEqual(['rendering', 'material', 'camera'])

    unregisterRendering()
    expect(store.getState().sectionOrder.default).toEqual(['rendering', 'material', 'camera'])

    store
      .getState()
      .register(
        { speed: { defaultValue: 1, min: 0, max: 2, label: 'Speed' } },
        { section: { id: 'rendering', label: 'Rendering' } },
      )

    expect(store.getState().sectionOrder.default).toEqual(['rendering', 'material', 'camera'])
  })

  it('records section hidden state from registration and updates it on re-registration', () => {
    const store = createTweakerStore({ id: 'section-hidden', persistence: false })

    store
      .getState()
      .register({ speed: 1 }, { section: { id: 'rendering', label: 'Rendering', hidden: true } })
    expect(store.getState().hiddenSections.default?.rendering).toBe(true)

    // Re-registration flips it visible.
    store
      .getState()
      .register({ speed: 1 }, { section: { id: 'rendering', label: 'Rendering', hidden: false } })
    expect(store.getState().hiddenSections.default?.rendering).toBe(false)

    // Omitting hidden defaults to visible (false).
    store.getState().register({ speed: 1 }, { section: { id: 'rendering', label: 'Rendering' } })
    expect(store.getState().hiddenSections.default?.rendering).toBe(false)
  })

  it('preserves an empty section label as a headerless signal', () => {
    const store = createTweakerStore({ id: 'section-headerless', persistence: false })
    store.getState().register({ speed: 1 }, { section: { id: 'rendering', label: '' } })
    // The empty label propagates to the control's section metadata, where the
    // panel reads it to render the section without a header.
    expect(store.getState().controls[0]?.sectionLabel).toBe('')
    expect(store.getState().controls[0]?.section).toBe('')
  })

  it('does not persist section hidden state', () => {
    const store = createTweakerStore({ id: 'section-hidden-persist' })
    store
      .getState()
      .register({ speed: 1 }, { section: { id: 'rendering', label: 'Rendering', hidden: true } })

    const raw = storage.getItem('tweaker:section-hidden-persist')
    expect(raw).not.toBeNull()
    const persisted = JSON.parse(raw!).state
    expect(Object.keys(persisted)).not.toContain('hiddenSections')
    // The runtime map is still populated for the panel to read.
    expect(store.getState().hiddenSections.default?.rendering).toBe(true)
  })

  it('cleans up section hidden state when the section unregisters', () => {
    const store = createTweakerStore({ id: 'section-hidden-cleanup', persistence: false })
    const unregister = store
      .getState()
      .register({ speed: 1 }, { section: { id: 'rendering', label: 'Rendering', hidden: true } })

    expect(store.getState().hiddenSections.default?.rendering).toBe(true)

    unregister()

    expect(store.getState().hiddenSections.default?.rendering).toBeUndefined()
  })

  it('stores hook-level reorderable metadata and supports deprecated sortable', () => {
    const store = createTweakerStore({ id: 'sortable', persistence: false })
    store.getState().register({ channel: 'stable' }, { section: 'Build', sortable: false })

    expect(store.getState().controls[0]?.reorderable).toBe(false)
    expect(store.getState().controls[0]?.sortable).toBe(false)
  })

  it('maps deprecated hook-level panel effects to panel appearance', () => {
    const store = createTweakerStore({ id: 'opacity', persistence: false })
    store.getState().register({ channel: 'stable' }, { panel: 'build', section: 'Build' })
    store.getState().updatePanelEffects(
      { channel: 'stable' },
      {
        panel: 'build',
        section: 'Build',
        opacity: -1,
        hoverOpacity: 2,
        backgroundBlur: -4,
        hoverBackgroundBlur: 4,
      },
    )

    expect(store.getState().panelAppearances.build).toEqual({
      surfaceOpacity: 0,
      activeSurfaceOpacity: 1,
      backdropBlur: 0,
      activeBackdropBlur: 4,
    })
  })

  it('updates panel effects without pruning values or order', () => {
    const store = createTweakerStore({ id: 'panel-effects', persistence: false })
    const schema = {
      speed: { defaultValue: 1, min: 0, max: 2 },
      exposure: 1,
    } satisfies TweakerSchema

    store.getState().register(schema, { section: 'Rendering' })
    store.getState().setValue('panel-effects:Rendering:speed', 1.5)
    store
      .getState()
      .setSectionOrder('default', 'Rendering', [
        'panel-effects:Rendering:exposure',
        'panel-effects:Rendering:speed',
      ])

    store.getState().updatePanelEffects(schema, {
      section: 'Rendering',
      opacity: 0.4,
      hoverOpacity: 0.85,
      backgroundBlur: 0,
      hoverBackgroundBlur: 4,
    })

    expect(store.getState().values['panel-effects:Rendering:speed']).toBe(1.5)
    expect(store.getState().order.default?.Rendering).toEqual([
      'panel-effects:Rendering:exposure',
      'panel-effects:Rendering:speed',
    ])
    expect(store.getState().panelAppearances.default).toEqual({
      surfaceOpacity: 0.4,
      activeSurfaceOpacity: 0.85,
      backdropBlur: 0,
      activeBackdropBlur: 4,
    })
  })

  it('does not notify for equivalent panel, section, order, or effect updates', () => {
    const store = createTweakerStore({ id: 'stable-layout', persistence: false })
    const listener = vi.fn()

    store.getState().register({ speed: 1 }, { section: { id: 'rendering', label: 'Rendering' } })
    store.getState().setPanelCollapsed('default', true)
    store.getState().setSectionCollapsed('default', 'rendering', true)
    store.getState().setPanelDock('default', { edge: 'right', offset: 24 })
    store
      .getState()
      .setSectionOrder('default', 'rendering', ['stable-layout:default:rendering:speed'])
    store
      .getState()
      .updatePanelEffects(
        { speed: 1 },
        { section: { id: 'rendering', label: 'Rendering' }, opacity: 0.6 },
      )

    store.subscribe(listener)

    store.getState().setPanelCollapsed('default', true)
    store.getState().setSectionCollapsed('default', 'rendering', true)
    store.getState().setPanelDock('default', { edge: 'right', offset: 24 })
    store
      .getState()
      .setSectionOrder('default', 'rendering', ['stable-layout:default:rendering:speed'])
    store
      .getState()
      .updatePanelEffects(
        { speed: 1 },
        { section: { id: 'rendering', label: 'Rendering' }, opacity: 0.6 },
      )

    expect(listener).not.toHaveBeenCalled()
  })

  it('updates status metadata without pruning values or order', () => {
    const store = createTweakerStore({ id: 'status-change', persistence: false })

    store
      .getState()
      .register({ speed: { defaultValue: 1, status: 'info' } }, { section: 'Rendering' })
    store.getState().setValue('status-change:Rendering:speed', 1.5)
    store.getState().setSectionOrder('default', 'Rendering', ['status-change:Rendering:speed'])
    store
      .getState()
      .register({ speed: { defaultValue: 1, status: 'error' } }, { section: 'Rendering' })

    expect(store.getState().values['status-change:Rendering:speed']).toBe(1.5)
    expect(store.getState().order.default?.Rendering).toEqual(['status-change:Rendering:speed'])
    expect(store.getState().controls[0]?.status).toBe('error')
  })

  it('updates description metadata on re-registration', () => {
    const store = createTweakerStore({ id: 'description-change', persistence: false })
    const persistId = 'description-change:Rendering:speed'

    store.getState().register(
      {
        speed: {
          defaultValue: 1,
          min: 0,
          max: 2,
          description: 'Speed is 1',
        },
      },
      { section: 'Rendering' },
    )
    store.getState().setValue(persistId, 1.5)

    store.getState().register(
      {
        speed: {
          defaultValue: 1,
          min: 0,
          max: 2,
          description: 'Speed is 2',
        },
      },
      { section: 'Rendering' },
    )

    expect(store.getState().values[persistId]).toBe(1.5)
    expect(store.getState().controls[0]?.description).toBe('Speed is 2')
  })

  it('updates formatOptions and readOnly metadata on re-registration', () => {
    const store = createTweakerStore({ id: 'meta-change', persistence: false })
    const persistId = 'meta-change:Rendering:speed'

    store.getState().register(
      {
        speed: {
          type: 'number',
          defaultValue: 1,
          min: 0,
          max: 2,
          formatOptions: { maximumFractionDigits: 1 },
          readOnly: false,
        },
      },
      { section: 'Rendering' },
    )
    expect(store.getState().controls[0]?.formatOptions).toEqual({ maximumFractionDigits: 1 })
    expect(store.getState().controls[0]?.readOnly).toBeUndefined()

    store.getState().setValue(persistId, 1.5)
    store.getState().register(
      {
        speed: {
          type: 'number',
          defaultValue: 1,
          min: 0,
          max: 2,
          formatOptions: { style: 'percent' },
          readOnly: true,
        },
      },
      { section: 'Rendering' },
    )

    expect(store.getState().values[persistId]).toBe(1.5)
    expect(store.getState().controls[0]?.formatOptions).toEqual({ style: 'percent' })
    expect(store.getState().controls[0]?.readOnly).toBe(true)

    // A read-only control refuses writes after the re-registration takes effect.
    store.getState().setValue(persistId, 2)
    expect(store.getState().values[persistId]).toBe(1.5)
  })

  it('re-clamps values when numeric bounds narrow on re-registration', () => {
    const store = createTweakerStore({ id: 'bounds-change', persistence: false })
    const persistId = 'bounds-change:Rendering:speed'

    store
      .getState()
      .register(
        { speed: { type: 'number', defaultValue: 1, min: 0, max: 10 } },
        { section: 'Rendering' },
      )
    store.getState().setValue(persistId, 8)
    expect(store.getState().values[persistId]).toBe(8)

    // Narrowing max to 5 pulls the out-of-range value back in range.
    store
      .getState()
      .register(
        { speed: { type: 'number', defaultValue: 1, min: 0, max: 5 } },
        { section: 'Rendering' },
      )
    expect(store.getState().values[persistId]).toBe(5)
    expect(store.getState().controls[0]?.value).toBe(5)
  })

  it('invalidates select values that leave the options list on re-registration', () => {
    const store = createTweakerStore({ id: 'options-change', persistence: false })
    const persistId = 'options-change:Rendering:tint'

    store
      .getState()
      .register(
        { tint: { type: 'select', defaultValue: 'green', options: ['green', 'amber'] } },
        { section: 'Rendering' },
      )
    store.getState().setValue(persistId, 'amber')
    expect(store.getState().values[persistId]).toBe('amber')

    // "amber" is removed; the default "green" is still valid so it wins.
    store
      .getState()
      .register(
        { tint: { type: 'select', defaultValue: 'green', options: ['green'] } },
        { section: 'Rendering' },
      )
    expect(store.getState().values[persistId]).toBe('green')

    // Default is also stale, so it falls back to the first option.
    store
      .getState()
      .register(
        { tint: { type: 'select', defaultValue: 'gone', options: ['blue'] } },
        { section: 'Rendering' },
      )
    expect(store.getState().values[persistId]).toBe('blue')
  })

  it('treats display controls as derived: ignores stored values and refuses writes', () => {
    const store = createTweakerStore({ id: 'display', persistence: false })
    const persistId = 'display:Rendering:total'

    // Seed a stale stored value; registration must ignore it in favor of the
    // derived defaultValue.
    store
      .getState()
      .register({ total: { type: 'display', defaultValue: 10 } }, { section: 'Rendering' })
    store.getState().setValue(persistId, 999)
    // setValue is refused for display controls.
    expect(store.getState().values[persistId]).toBeUndefined()
    expect(store.getState().controls[0]?.value).toBe(10)

    // Re-registering with a new derived value updates the display without writes.
    store
      .getState()
      .register({ total: { type: 'display', defaultValue: 25 } }, { section: 'Rendering' })
    expect(store.getState().controls[0]?.value).toBe(25)
    expect(store.getState().values[persistId]).toBeUndefined()
  })

  it('ignores stale persisted values when display controls register', () => {
    const persistId = 'display-stale:Rendering:total'
    storage.setItem(
      'tweaker:display-stale',
      JSON.stringify({
        state: {
          values: { [persistId]: 999 },
          order: {},
          panels: {},
          sections: {},
        },
      }),
    )

    const store = createTweakerStore({ id: 'display-stale' })
    store
      .getState()
      .register({ total: { type: 'display', defaultValue: 10 } }, { section: 'Rendering' })

    expect(store.getState().controls[0]?.value).toBe(10)
    // Stale values are intentionally retained, but display controls derive from
    // registration defaults instead of persisted entries.
    expect(store.getState().values[persistId]).toBe(999)
  })

  it('updates display format metadata on re-registration', () => {
    const store = createTweakerStore({ id: 'display-format', persistence: false })

    store
      .getState()
      .register(
        { total: { type: 'display', defaultValue: 10, format: 'Total: {value}' } },
        { section: 'Rendering' },
      )
    expect(formatDisplayValue(store.getState().controls[0]!)).toBe('Total: 10')

    store
      .getState()
      .register(
        { total: { type: 'display', defaultValue: 10, format: 'Now: {value}' } },
        { section: 'Rendering' },
      )

    const control = store.getState().controls[0]!
    expect(control.format).toBe('Now: {value}')
    expect(formatDisplayValue(control)).toBe('Now: 10')
  })

  it('does not notify when an equivalent schema registers again', () => {
    const store = createTweakerStore({ id: 'stable-schema', persistence: false })
    const listener = vi.fn()

    store
      .getState()
      .register({ speed: { defaultValue: 1, min: 0, max: 2 } }, { section: 'Rendering' })
    store.subscribe(listener)
    store
      .getState()
      .register({ speed: { defaultValue: 1, min: 0, max: 2 } }, { section: 'Rendering' })

    expect(listener).not.toHaveBeenCalled()
  })

  it('does not prune stale persisted keys on unregister', () => {
    storage.setItem(
      'tweaker:stale',
      JSON.stringify({
        state: {
          values: { 'stale:Rendering:remove': 9 },
          order: {},
          panels: {},
        },
      }),
    )
    const store = createTweakerStore({ id: 'stale' })
    const unregister = store.getState().register({ remove: 2 }, { section: 'Rendering' })

    expect(store.getState().values['stale:Rendering:remove']).toBe(9)

    unregister()

    expect(store.getState().values['stale:Rendering:remove']).toBe(9)
  })

  it('migrates legacy persisted panel layout into the default panel', () => {
    storage.setItem(
      'tweaker:legacy',
      JSON.stringify({
        state: {
          values: { 'legacy:Rendering:exposure': 2 },
          order: { Rendering: ['legacy:Rendering:exposure'] },
          collapsed: true,
          dock: { edge: 'left', offset: 16 },
        },
      }),
    )
    const store = createTweakerStore({ id: 'legacy' })
    store.getState().register({ exposure: 1 }, { section: 'Rendering' })

    expect(store.getState().values['legacy:Rendering:exposure']).toBe(2)
    expect(store.getState().order.default?.Rendering).toEqual(['legacy:Rendering:exposure'])
    expect(store.getState().panels.default).toEqual({
      collapsed: true,
      dock: { edge: 'left', offset: 16 },
    })
  })

  it('migrates legacy dock state even when legacy order is empty', () => {
    storage.setItem(
      'tweaker:legacy-empty-order',
      JSON.stringify({
        state: {
          values: {},
          order: {},
          collapsed: false,
          dock: { edge: 'right', offset: 80 },
        },
      }),
    )
    const store = createTweakerStore({ id: 'legacy-empty-order' })

    expect(store.getState().panels.default).toEqual({
      collapsed: false,
      dock: { edge: 'right', offset: 80 },
    })
  })

  it('keeps panel layout state independent', () => {
    const store = createTweakerStore({ id: 'panels', persistence: false })

    store.getState().setPanelCollapsed('scene', true)
    store.getState().setPanelDock('build', { edge: 'right', offset: 48 })

    expect(store.getState().getPanelState('scene')).toEqual({ collapsed: true, dock: null })
    expect(store.getState().getPanelState('build')).toEqual({
      collapsed: false,
      dock: { edge: 'right', offset: 48 },
    })
  })

  it('persists section collapse state by panel and section', () => {
    const store = createTweakerStore({ id: 'sections' })

    store.getState().setSectionCollapsed('scene', 'rendering', true)
    store.getState().setSectionCollapsed('scene', 'material', true)
    store.getState().setSectionCollapsed('scene', 'material', false)
    store.getState().setSectionCollapsed('build', 'rendering', true)

    const next = createTweakerStore({ id: 'sections' })

    expect(next.getState().sections.scene?.rendering).toBe(true)
    expect(next.getState().sections.scene?.material).toBe(false)
    expect(next.getState().sections.build?.rendering).toBe(true)
  })

  it('preserves values when section labels and object keys change with stable ids', () => {
    const store = createTweakerStore({ id: 'stable', persistence: false })
    store.getState().register(
      {
        speed: { id: 'speed', defaultValue: 1, min: 0, max: 2 },
      },
      { panel: 'scene', section: { id: 'rendering', label: 'Rendering' } },
    )
    store.getState().setValue('stable:scene:rendering:speed', 1.5)

    store.getState().register(
      {
        velocity: { id: 'speed', defaultValue: 1, min: 0, max: 2 },
      },
      { panel: 'scene', section: { id: 'rendering', label: 'Render Settings' } },
    )

    expect(store.getState().controls.find((control) => control.key === 'velocity')?.value).toBe(1.5)
  })

  it('persists custom JSON control values', () => {
    const schema = {
      position: { type: 'vector3', id: 'position', defaultValue: [0, 1, 0] },
    } satisfies TweakerSchema
    const store = createTweakerStore({ id: 'json' })

    store.getState().register(schema, {
      panel: 'scene',
      section: { id: 'transform', label: 'Transform' },
    })
    store.getState().setValue('json:scene:transform:position', [2, 3, 4])

    const next = createTweakerStore({ id: 'json' })
    next.getState().register(schema, {
      panel: 'scene',
      section: { id: 'transform', label: 'Transform' },
    })

    expect(next.getState().controls[0]?.value).toEqual([2, 3, 4])
  })

  it('discards invalid localStorage data through the Zod storage boundary', () => {
    storage.setItem(
      'tweaker:invalid',
      JSON.stringify({
        state: {
          values: { 'invalid:Rendering:exposure': 2 },
          order: [],
          panels: { default: { collapsed: 'nope', dock: { edge: 'diagonal', offset: -1 } } },
        },
      }),
    )

    const store = createTweakerStore({ id: 'invalid' })
    store.getState().register({ exposure: 1 }, { section: 'Rendering' })

    expect(store.getState().values).toEqual({})
    expect(store.getState().controls[0]?.value).toBe(1)
  })
})

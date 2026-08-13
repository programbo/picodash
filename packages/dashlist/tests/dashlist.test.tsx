// @vitest-environment jsdom
import { act, createElement, Fragment, StrictMode, type ReactElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vite-plus/test'
import {
  createDomTestRenderer as create,
  type DomTestRenderer,
} from '../../../test/dom-renderer.ts'
import { createPicodashNexus, PicodashContractError } from '@picodash/nexus'
import {
  acquireDashListNodeLease,
  PicodashNexusProviderBoundary,
} from '@picodash/nexus/integration'
import { usePicodashScope } from '@picodash/nexus/react'
import {
  DashGroup,
  DashList,
  Dashlet,
  useDashListActions,
  type SingleFieldDashletRenderContext,
} from '../src/index.tsx'
import {
  createDashListActionRegistry,
  dashListResetValuesFingerprint,
  executeDashListActionIfCurrent,
} from '../src/actions.tsx'
import {
  acquireRegisteredDashListNodeLease,
  createNodeRegistry,
} from '../src/node-registration.tsx'

const makeNexus = () =>
  createPicodashNexus({ valueOwner: 'nexus', fields: { value: { defaultValue: 0 } } })

function render(element: ReactElement): DomTestRenderer {
  let renderer!: DomTestRenderer
  act(() => {
    renderer = create(element)
  })
  return renderer
}

function expectContract(action: () => unknown, code: string, context: Record<string, string>) {
  try {
    action()
    throw new Error(`Expected ${code} contract error.`)
  } catch (error) {
    expect(error).toBeInstanceOf(PicodashContractError)
    expect((error as PicodashContractError).code).toBe(code)
    expect((error as PicodashContractError).context).toEqual(context)
  }
}

function ActionProbe({
  capture,
  scopeId,
}: {
  readonly capture: (actions: ReturnType<typeof useDashListActions>) => void
  readonly scopeId?: string
}) {
  const actions = useDashListActions(scopeId)
  capture(actions)
  return null
}

describe('@picodash/dashlist alpha shell', () => {
  it('rolls back private node registration when public lease acquisition fails', () => {
    const nexus = makeNexus()
    const scoped = nexus.scope('rollback')
    const held = acquireDashListNodeLease(scoped, { nodeId: 'node' })
    const registry = createNodeRegistry()
    const failedToken = {}
    const failedGeneration = registry.register(failedToken, {}, 'dashlet', 'node')

    expect(() =>
      acquireRegisteredDashListNodeLease(registry, failedToken, failedGeneration, scoped, 'node'),
    ).toThrowError(expect.objectContaining({ code: 'duplicate-dash-list-node' }))
    const correctedToken = {}
    registry.register(correctedToken, {}, 'dashlet', 'node')
    expect(registry.getFailure()).toBeNull()

    held.release()
    nexus.destroy()
  })

  it('resolves explicit root/scoped Nexuses and rejects immutable mismatches', () => {
    const nexus = makeNexus()
    const root = render(
      createElement(DashList, {
        id: 'root-list',
        nexus,
        children: createElement(Dashlet, { id: 'item', label: 'Item' }),
      }),
    )
    expect(root.root.findByProps({ 'data-picodash-dashlist': true })).toBeDefined()
    act(() => {
      root.update(
        createElement(DashList, {
          id: 'root-list',
          nexus,
          children: createElement(Dashlet, { id: 'item', label: 'Item' }),
        }),
      )
    })
    expect(() =>
      act(() =>
        root.update(
          createElement(DashList, {
            id: 'changed',
            nexus,
          }),
        ),
      ),
    ).toThrow('DashList Nexus and id are immutable while mounted.')
    const scoped = render(
      createElement(DashList, {
        id: 'scope',
        nexus: nexus.scope('scope'),
      }),
    )
    expect(scoped.root.findByProps({ 'data-picodash-dashlist': true })).toBeDefined()
    expect(() =>
      render(
        createElement(DashList, {
          id: 'different',
          nexus: nexus.scope('scope'),
        }),
      ),
    ).toThrow('DashList scoped Nexus and id must name the same scope.')
    act(() => root.unmount())
    act(() => scoped.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('keeps the context resolution matrix and exact missing-context errors', () => {
    const noContextNexus = makeNexus()
    expectContract(() => render(createElement(DashList)), 'missing-nexus-context', {
      required: 'root-or-scoped',
    })
    expect(() => render(createElement(DashList, { nexus: noContextNexus } as never))).toThrow(
      'DashList requires id when resolving a root Nexus.',
    )
    const scoped = noContextNexus.scope('scoped')
    const omitted = render(createElement(DashList, { nexus: scoped }))
    act(() => omitted.unmount())
    const same = render(createElement(DashList, { nexus: scoped, id: 'scoped' }))
    expect(() => render(createElement(DashList, { nexus: scoped, id: 'other' }))).toThrow(
      'DashList scoped Nexus and id must name the same scope.',
    )
    act(() => same.unmount())
    expect(() => noContextNexus.destroy()).not.toThrow()

    const nearestRoot = makeNexus()
    expect(() =>
      render(
        createElement(PicodashNexusProviderBoundary, {
          nexus: nearestRoot,
          children: createElement(DashList),
        }),
      ),
    ).toThrow('DashList requires id when resolving a root Nexus.')
    expect(() => nearestRoot.destroy()).not.toThrow()
  })

  it('uses nearest Provider/entity context and nested child relationships', () => {
    const nexus = makeNexus()
    function ScopeProbe() {
      return createElement('output', { 'data-scope': usePicodashScope().scopeId })
    }
    const renderer = render(
      createElement(PicodashNexusProviderBoundary, {
        nexus,
        children: createElement(
          DashList,
          { id: 'primary' },
          createElement(
            Dashlet,
            { id: 'host', label: 'Host' },
            createElement(ScopeProbe),
            createElement(
              DashList,
              { id: 'child' },
              createElement(Dashlet, { id: 'child-item', label: 'Child' }),
            ),
            createElement(DashList, {
              id: 'explicit',
              nexus: nexus.scope('explicit'),
              children: createElement(Dashlet, { id: 'explicit-item', label: 'Explicit' }),
            }),
          ),
        ),
      }),
    )
    expect(renderer.root.findByType('output').props['data-scope']).toBe('primary')
    expect(renderer.root.findAllByProps({ 'data-picodash-dashlist': true })).toHaveLength(3)
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('retains children and renders neutral/list/group semantics with labels', () => {
    const nexus = makeNexus()
    const renderer = render(
      createElement(DashList, {
        id: 'semantic',
        nexus,
        title: 'Settings',
        headingLevel: 3,
        'aria-label': 'Explicit settings controls',
        children: [
          createElement(
            Fragment,
            null,
            createElement(DashGroup, {
              id: 'group',
              label: 'General',
              children: createElement(Dashlet, {
                id: 'item',
                label: 'Value',
                children: createElement('input', { defaultValue: 'retained' }),
              }),
            }),
          ),
        ],
      }),
    )
    expect(renderer.root.findByType('h3').children).toEqual(['Settings'])
    expect(renderer.root.findAllByProps({ role: 'list' }).length).toBe(2)
    expect(renderer.root.findAllByProps({ role: 'listitem' }).length).toBe(2)
    expect(renderer.root.findByProps({ 'data-picodash-dashlist-list': true }).props).toMatchObject({
      'aria-label': 'Explicit settings controls',
      'aria-labelledby': undefined,
    })
    const groupLabel = renderer.root.findByProps({ 'data-picodash-dashgroup-label': true })
    expect(renderer.root.findByProps({ 'data-picodash-dashgroup-list': true }).props).toMatchObject(
      {
        'aria-label': undefined,
        'aria-labelledby': groupLabel.props.id,
      },
    )
    expect(renderer.root.findByProps({ role: 'status' }).props['aria-live']).toBe('polite')
    expect(renderer.root.findByType('input').props.defaultValue).toBe('retained')
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('wraps inline component children in separate layout cells', () => {
    const nexus = makeNexus()
    function Control() {
      return createElement('input', { 'aria-label': 'Control' })
    }
    function Readout() {
      return '48%'
    }
    const renderer = render(
      createElement(
        DashList,
        { id: 'text-content', nexus },
        createElement(
          Dashlet,
          { id: 'readout', label: 'Readout' },
          createElement(Fragment, null, createElement(Control), ' ', createElement(Readout)),
        ),
      ),
    )
    const cells = renderer.root.findAllByProps({ 'data-picodash-dashlet-content-cell': true })
    expect(cells).toHaveLength(2)
    expect(cells[0]!.findByType('input').props['aria-label']).toBe('Control')
    expect(cells[1]!.children).toEqual(['48%'])
    expect(
      renderer.root.findByProps({ 'data-picodash-dashlet-content-whitespace': true }).children,
    ).toEqual([' '])

    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('keeps multiple roots returned by one component in one subgrid cell', () => {
    const nexus = makeNexus()
    function SliderCells() {
      return createElement(
        Fragment,
        null,
        createElement('input', { 'aria-label': 'Slider control' }),
        createElement('output', null, '48%'),
      )
    }
    const renderer = render(
      createElement(
        DashList,
        { id: 'component-cells', nexus },
        createElement(Dashlet, { id: 'slider', label: 'Slider' }, createElement(SliderCells)),
      ),
    )
    const cell = renderer.root.findByProps({ 'data-picodash-dashlet-content-cell': true })
    expect(cell.findByType('input').props['aria-label']).toBe('Slider control')
    expect(cell.findByType('output').children).toEqual(['48%'])

    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('preserves control DOM identity when the Dashlet layout changes', () => {
    const nexus = makeNexus()
    const renderLayout = (layout: 'inline' | 'block' | 'full') =>
      createElement(
        DashList,
        { id: 'layout-identity', nexus },
        createElement(
          Dashlet,
          { id: 'control', label: 'Control', layout },
          createElement('input', { 'aria-label': 'Persistent control', defaultValue: 'retained' }),
        ),
      )
    const renderer = render(renderLayout('inline'))
    const initialControl = renderer.root.findByProps({ 'aria-label': 'Persistent control' }).element
    initialControl.focus()

    act(() => renderer.update(renderLayout('block')))
    const blockControl = renderer.root.findByProps({ 'aria-label': 'Persistent control' }).element
    expect(blockControl).toBe(initialControl)
    expect(blockControl.ownerDocument.activeElement).toBe(blockControl)

    act(() => renderer.update(renderLayout('full')))
    expect(renderer.root.findByProps({ 'aria-label': 'Persistent control' }).element).toBe(
      initialControl,
    )

    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('preserves explicit whitespace in block and full Dashlet content', () => {
    const nexus = makeNexus()
    const renderer = render(
      createElement(
        DashList,
        { id: 'content-whitespace', nexus },
        createElement(
          Dashlet,
          { id: 'quality', label: 'Quality', layout: 'block' },
          createElement('span', null, 'Low'),
          ' ',
          createElement('span', null, 'quality'),
        ),
      ),
    )
    expect(
      renderer.root.findByProps({ 'data-picodash-dashlet-content-whitespace': true }).children,
    ).toEqual([' '])

    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('marks whitespace returned by an inline child component as layout-empty', () => {
    const nexus = makeNexus()
    function Spacer() {
      return ' '
    }
    const renderer = render(
      createElement(
        DashList,
        { id: 'component-whitespace', nexus },
        createElement(
          Dashlet,
          { id: 'control', label: 'Control' },
          createElement(Spacer),
          createElement('input', { 'aria-label': 'Visible control' }),
        ),
      ),
    )
    const cells = renderer.root.findAllByProps({ 'data-picodash-dashlet-content-cell': true })
    expect(cells).toHaveLength(2)
    expect(cells[0]!.element.hasAttribute('data-picodash-dashlet-content-empty')).toBe(true)
    expect(cells[1]!.findByType('input').props['aria-label']).toBe('Visible control')

    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('marks the List compact from its observed inline size', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver')
    let resize!: ResizeObserverCallback
    const disconnect = vi.fn()
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: class {
        constructor(callback: ResizeObserverCallback) {
          resize = callback
        }
        observe() {}
        disconnect() {
          disconnect()
        }
      },
    })
    const nexus = makeNexus()
    const renderer = render(
      createElement(
        DashList,
        { id: 'responsive-list', nexus },
        createElement(Dashlet, { id: 'control', label: 'Control' }, createElement('input')),
      ),
    )
    const root = renderer.root.findByProps({ 'data-picodash-dashlist': true }).element

    act(() =>
      resize(
        [{ target: root, contentBoxSize: [{ inlineSize: 287 }] } as unknown as ResizeObserverEntry],
        {} as ResizeObserver,
      ),
    )
    expect(root.hasAttribute('data-picodash-dashlist-compact')).toBe(true)
    act(() =>
      resize(
        [{ target: root, contentBoxSize: [{ inlineSize: 288 }] } as unknown as ResizeObserverEntry],
        {} as ResizeObserver,
      ),
    )
    expect(root.hasAttribute('data-picodash-dashlist-compact')).toBe(false)

    act(() => renderer.unmount())
    expect(disconnect).toHaveBeenCalledOnce()
    if (original) Object.defineProperty(globalThis, 'ResizeObserver', original)
    else Reflect.deleteProperty(globalThis, 'ResizeObserver')
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('keeps group reorder and disclosure controls in visual DOM order', () => {
    const nexus = makeNexus()
    const renderer = render(
      createElement(
        DashList,
        { id: 'group-control-order', nexus },
        createElement(DashGroup, { id: 'first', label: 'First' }),
        createElement(DashGroup, { id: 'second', label: 'Second' }),
      ),
    )
    const firstGroup = renderer.root.findByProps({ 'data-picodash-dashgroup': 'first' })
    expect(
      firstGroup
        .findByProps({ 'data-slot': 'dash-header-leading' })
        .findAllByType('button')
        .map((button) => button.props['aria-label']),
    ).toEqual(['Reorder First', 'Collapse group First'])

    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('retains an empty inline cell when a child component renders nothing', () => {
    const nexus = makeNexus()
    function MaybeReadout() {
      return null
    }
    const renderer = render(
      createElement(
        DashList,
        { id: 'conditional-content', nexus },
        createElement(
          Dashlet,
          { id: 'conditional', label: 'Conditional' },
          createElement(MaybeReadout),
          createElement('input', { 'aria-label': 'Only visible control' }),
        ),
      ),
    )
    const cells = renderer.root.findAllByProps({ 'data-picodash-dashlet-content-cell': true })
    expect(cells).toHaveLength(2)
    expect(cells[0]!.children).toEqual([])
    expect(cells[1]!.findByType('input').props['aria-label']).toBe('Only visible control')

    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('resolves durable group collapse metadata without unmounting descendants', () => {
    const nexus = makeNexus()
    const scoped = nexus.scope('collapse')
    scoped.setDashListCollapseOverride('group', true)
    const renderer = render(
      createElement(
        DashList,
        { id: 'collapse', nexus },
        createElement(DashGroup, {
          id: 'group',
          label: 'Group',
          children: createElement(
            Dashlet,
            { id: 'item', label: 'Item' },
            createElement('input', { defaultValue: 'retained' }),
          ),
        }),
      ),
    )
    let content = renderer.root.findByProps({ 'data-picodash-dashgroup-list': true })
    expect(content.props).toMatchObject({
      hidden: true,
      inert: true,
      'aria-hidden': true,
    })
    expect(renderer.root.findByProps({ 'data-picodash-dashlet': 'item' })).toBeDefined()
    const disclosure = renderer.root.findByProps({ 'aria-label': 'Expand group Group' })
    expect(disclosure.props['aria-expanded']).toBe(false)

    // Returning to the declared default removes the redundant durable override.
    act(() => {
      void disclosure.props.onClick()
    })
    expect(scoped.getState().scope?.dashList?.collapseOverrides.has('group') ?? false).toBe(false)
    content = renderer.root.findByProps({ 'data-picodash-dashgroup-list': true })
    expect(content.props.hidden).toBeUndefined()

    act(() =>
      renderer.update(
        createElement(
          DashList,
          { id: 'collapse', nexus },
          createElement(DashGroup, {
            id: 'group',
            label: 'Group',
            defaultCollapsed: true,
            children: createElement(Dashlet, { id: 'item', label: 'Item' }),
          }),
        ),
      ),
    )
    content = renderer.root.findByProps({ 'data-picodash-dashgroup-list': true })
    expect(content.props.hidden).toBe(true)

    // Non-collapsible presentation is expanded while preserving dormant metadata.
    act(() => {
      scoped.setDashListCollapseOverride('group', true)
    })
    act(() =>
      renderer.update(
        createElement(
          DashList,
          { id: 'collapse', nexus },
          createElement(DashGroup, {
            id: 'group',
            label: 'Group',
            collapsible: false,
            children: createElement(Dashlet, { id: 'item', label: 'Item' }),
          }),
        ),
      ),
    )
    content = renderer.root.findByProps({ 'data-picodash-dashgroup-list': true })
    expect(content.props.hidden).toBeUndefined()
    expect(scoped.getState().scope?.dashList?.collapseOverrides.get('group')).toBe(true)
    expect(renderer.root.findAllByProps({ 'aria-expanded': true })).toHaveLength(0)

    // Content policies do not disable the group disclosure control.
    act(() =>
      renderer.update(
        createElement(
          DashList,
          { id: 'collapse', nexus },
          createElement(DashGroup, {
            id: 'group',
            label: 'Group',
            disabled: true,
            readOnly: true,
            children: createElement(Dashlet, { id: 'item', label: 'Item' }),
          }),
        ),
      ),
    )
    const policyDisclosure = renderer.root.findByProps({ 'aria-label': 'Expand group Group' })
    expect(policyDisclosure.props.disabled).toBeUndefined()
    act(() => {
      void policyDisclosure.props.onClick()
    })
    expect(renderer.root.findByProps({ 'data-picodash-dashgroup-list': true }).props.hidden).toBe(
      undefined,
    )
    act(() => {
      void renderer.root.findByProps({ 'aria-label': 'Collapse group Group' }).props.onClick()
    })
    expect(renderer.root.findByProps({ 'data-picodash-dashgroup-list': true }).props.hidden).toBe(
      true,
    )

    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('repairs focus to the disclosure before collapsing content', () => {
    const nexus = makeNexus()
    const hiddenWhenFocused: unknown[] = []
    const renderer = render(
      createElement(
        DashList,
        { id: 'focus-collapse', nexus },
        createElement(DashGroup, {
          id: 'group',
          label: 'Group',
          children: createElement(Dashlet, {
            id: 'item',
            label: 'Item',
            children: createElement('button', { 'aria-label': 'Focus target' }, 'Target'),
          }),
        }),
      ),
    )
    const disclosure = renderer.root.findByProps({ 'aria-label': 'Collapse group Group' })
    const disclosureElement = disclosure.element
    const focusTarget = renderer.root.findByProps({ 'aria-label': 'Focus target' }).element
    const nativeFocus = disclosureElement.focus.bind(disclosureElement)
    const focus = vi.spyOn(disclosureElement, 'focus').mockImplementation(() => {
      hiddenWhenFocused.push(
        renderer.root.findByProps({ 'data-picodash-dashgroup-list': true }).props.hidden,
      )
      nativeFocus()
    })
    focusTarget.focus()
    act(() => {
      void disclosure.props.onClick()
    })
    expect(focus).toHaveBeenCalledTimes(1)
    expect(renderer.root.findByProps({ 'data-picodash-dashgroup-list': true }).props.hidden).toBe(
      true,
    )
    act(() => {
      void renderer.root.findByProps({ 'aria-label': 'Expand group Group' }).props.onClick()
    })
    focusTarget.focus()
    act(() => {
      nexus.scope('focus-collapse').setDashListCollapseOverride('group', true)
    })
    expect(focus).toHaveBeenCalledTimes(2)
    expect(hiddenWhenFocused).toEqual([undefined, undefined])
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('exposes stable actions with atomic collapse, stale recheck, and value/list resets', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      initialValues: { value: 5 },
      fields: {
        value: {
          defaultValue: 0,
          parse: (input: unknown) =>
            typeof input === 'number'
              ? { ok: true as const, candidate: input }
              : { ok: false as const, issues: [{ message: 'Draft value rejected.' }] },
        },
      },
    })
    const scoped = nexus.scope('actions')
    let latest!: ReturnType<typeof useDashListActions>
    const actionHistory: ReturnType<typeof useDashListActions>[] = []
    let binding!: {
      readonly dirty: boolean
      readonly setInput: (value: number) => void
    }
    const renderer = render(
      createElement(
        DashList,
        { id: 'actions', nexus },
        createElement(DashGroup, {
          id: 'group',
          label: 'Group',
          children: createElement(Dashlet, {
            id: 'item',
            label: 'Item',
            field: nexus.fields.value as never,
            children(context: SingleFieldDashletRenderContext<number>) {
              binding = context.binding
              return createElement(ActionProbe, {
                scopeId: 'actions',
                capture: (actions) => {
                  latest = actions
                  actionHistory.push(actions)
                },
              })
            },
          }),
        }),
      ),
    )
    expect(latest.collapseAll.availability).toBe('enabled')
    expect(latest.expandAll.availability).toBe('disabled')
    expect(latest.resetValues.availability).toBe('enabled')
    expect(actionHistory.length).toBeGreaterThan(0)
    expect(Reflect.get(actionHistory[0]!.collapseAll, 'execute')).toBe(
      Reflect.get(latest.collapseAll, 'execute'),
    )
    const initialActions = latest
    const stale = latest.collapseAll
    act(() => {
      const result = stale.execute()
      expect(result.status).toBe('executed')
    })
    expect(scoped.getState().scope?.dashList?.collapseOverrides.get('group')).toBe(true)
    expect(latest.expandAll.availability).toBe('enabled')
    expect(latest.collapseAll.availability).toBe('disabled')
    expect(latest.resetValues).toBe(initialActions.resetValues)
    expect(Reflect.get(latest.resetValues, 'execute')).toBe(
      Reflect.get(initialActions.resetValues, 'execute'),
    )

    act(() => {
      scoped.setValue(scoped.fields.value, 5)
    })
    expect(latest.resetValues.availability).toBe('enabled')
    act(() => {
      scoped.resetValue(scoped.fields.value)
    })
    expect(latest.resetValues.availability).toBe('disabled')

    const staleExpand = latest.expandAll
    act(() => {
      scoped.setDashListCollapseOverride('group', false)
    })
    expect(staleExpand.execute()).toEqual({ status: 'not_executed', availability: 'disabled' })

    act(() => binding.setInput('draft' as never))
    expect(scoped.getState().interaction.bindings.size).toBe(1)
    expect(latest.resetValues.availability).toBe('enabled')
    act(() => {
      renderer.update(
        createElement(
          DashList,
          { id: 'actions', nexus },
          createElement(DashGroup, {
            id: 'group',
            label: 'Group',
            children: createElement(Dashlet, {
              id: 'item',
              label: 'Item',
              disabled: true,
              field: nexus.fields.value as never,
              children(context: SingleFieldDashletRenderContext<number>) {
                binding = context.binding
                return createElement(ActionProbe, {
                  scopeId: 'actions',
                  capture: (actions) => {
                    latest = actions
                    actionHistory.push(actions)
                  },
                })
              },
            }),
          }),
        ),
      )
    })
    expect(binding.dirty).toBe(true)
    act(() => {
      scoped.setDashListRootOrder(['group'])
    })
    expect(latest.resetList.availability).toBe('enabled')
    act(() => {
      const result = latest.resetValues.execute()
      expect(result.status).toBe('executed')
    })
    expect(scoped.getState().values.value).toBe(0)
    expect(scoped.getState().interaction.bindings.size).toBe(0)
    expect(scoped.getState().scope?.dashList?.rootOrder).toEqual(['group'])

    act(() => {
      const result = latest.resetList.execute()
      expect(result.status).toBe('executed')
    })
    expect(scoped.getState().scope?.dashList).toBeUndefined()
    expect(scoped.getState().values.value).toBe(0)
    act(() => {
      scoped.setDashListRootOrder(['group'])
    })
    const disposedResetList = latest.resetList
    expect(disposedResetList.availability).toBe('enabled')
    act(() => renderer.unmount())
    expect(disposedResetList.execute()).toEqual({
      status: 'not_executed',
      availability: 'unavailable',
    })
    expect(scoped.getState().scope?.dashList?.rootOrder).toEqual(['group'])
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('refuses a queued reset callback after its reviewed fingerprint changes', () => {
    const execute = vi.fn(() => ({ status: 'not_executed', availability: 'disabled' }) as const)
    let fingerprint = 'reviewed'
    executeDashListActionIfCurrent(
      { availability: 'enabled', execute },
      {
        fingerprint,
        getFingerprint: () => fingerprint,
        subscribe: () => () => undefined,
      },
    )
    expect(execute).toHaveBeenCalledTimes(1)
    fingerprint = 'changed'
    executeDashListActionIfCurrent(
      { availability: 'enabled', execute },
      {
        fingerprint: 'reviewed',
        getFingerprint: () => fingerprint,
        subscribe: () => () => undefined,
      },
    )
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('invalidates a reset guard when a dirty alias moves to another Dashlet', () => {
    const nexus = makeNexus()
    const registry = createDashListActionRegistry(nexus.scope('guard'), 'guard')
    registry.activate()
    const first = registry.registerBindings('first', [
      { key: 'value', dirty: true, discardInput: vi.fn() },
    ])
    const fingerprint = dashListResetValuesFingerprint(registry)
    first()
    registry.registerBindings('second', [{ key: 'value', dirty: true, discardInput: vi.fn() }])
    const execute = vi.fn(() => ({ status: 'not_executed', availability: 'disabled' }) as const)

    executeDashListActionIfCurrent(
      { availability: 'enabled', execute },
      {
        fingerprint,
        getFingerprint: () => dashListResetValuesFingerprint(registry),
        subscribe: registry.subscribe,
      },
    )
    expect(execute).not.toHaveBeenCalled()
    registry.dispose()
    nexus.destroy()
  })

  it('announces a rejected built-in value reset', () => {
    let snapshot = { value: 5 }
    let rejectWrites = false
    const listeners = new Set<() => void>()
    const nexus = createPicodashNexus({
      valueOwner: 'external',
      adapter: {
        getSnapshot: () => snapshot,
        subscribe(listener: () => void) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        setValues(next: Readonly<{ value: number }>) {
          if (rejectWrites) throw new Error('adapter rejected reset')
          snapshot = { ...next }
          for (const listener of listeners) listener()
        },
      },
      fields: {
        value: {
          defaultValue: 0,
          parse: (input: unknown) =>
            typeof input === 'number'
              ? { ok: true as const, candidate: input }
              : { ok: false as const, issues: [{ message: 'Expected a number.' }] },
        },
      },
    })
    let latest!: ReturnType<typeof useDashListActions>
    const renderer = render(
      createElement(
        DashList,
        { id: 'rejected-reset', nexus },
        createElement(Dashlet, {
          id: 'item',
          label: 'Item',
          field: nexus.fields.value as never,
          children() {
            return createElement(ActionProbe, {
              capture: (actions) => {
                latest = actions
              },
            })
          },
        }),
      ),
    )
    rejectWrites = true
    act(() => {
      const result = latest.resetValues.execute()
      expect(result.status).toBe('executed')
      if (result.status === 'executed') expect(result.result.ok).toBe(false)
    })
    expect(renderer.root.findByProps({ role: 'status' }).children).toEqual([
      'Reset values was rejected.',
    ])
    act(() => renderer.unmount())
    nexus.destroy()
  })

  it('announces a rejected group disclosure metadata write', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      nexusId: 'dashlist-collapse-quarantine',
      schemaVersion: 1,
      fields: { value: { defaultValue: 1 } },
      initialEnvelope: {
        kind: 'picodash-nexus-envelope',
        formatVersion: 1,
        nexusId: 'dashlist-collapse-quarantine',
        schemaVersion: 1,
        revision: 1,
        writerId: 'fixture',
        valueOwner: 'nexus',
        values: { value: 1 },
        scopes: [['collapse-quarantine', { dashList: { invalid: true } }]],
      },
    } as never)
    expect(nexus.metadataRecovery.getState().quarantinedScopes.has('collapse-quarantine')).toBe(
      true,
    )
    const renderer = render(
      createElement(
        DashList,
        { id: 'collapse-quarantine', nexus },
        createElement(DashGroup, {
          id: 'group',
          label: 'Group',
          children: createElement(Dashlet, { id: 'item', label: 'Item' }),
        }),
      ),
    )
    const disclosure = renderer.root.findByProps({ 'aria-label': 'Collapse group Group' })
    act(() => {
      void disclosure.props.onClick()
    })
    expect(
      JSON.stringify(renderer.root.findByProps({ role: 'status' }).children[0] ?? ''),
    ).toContain('Group disclosure failed for Group: Scope metadata is quarantined.')
    expect(disclosure.props['aria-expanded']).toBe(true)
    act(() => renderer.unmount())
    nexus.destroy()
  })

  it('leases committed nodes for active prune exclusion and releases them without auto-delete', () => {
    const nexus = makeNexus()
    const scoped = nexus.scope('presence')
    scoped.setDashListRootOrder(['active', 'dormant'])
    const renderer = render(
      createElement(
        StrictMode,
        null,
        createElement(
          DashList,
          { id: 'presence', nexus },
          createElement(Dashlet, { id: 'active', label: 'Active' }),
        ),
      ),
    )
    expect(scoped.createPrunePlan({ mode: 'review' }).candidates).toEqual([
      { nodeId: 'dormant', effects: ['root-order-entry'] },
    ])
    const explicit = scoped.createPrunePlan({
      mode: 'explicit',
      removeNodeIds: ['dormant'],
      keepNodeIds: [],
    })
    act(() => {
      expect(scoped.executePrunePlan(explicit)).toMatchObject({ ok: true })
    })
    expect(scoped.getState().scope?.dashList?.rootOrder).toEqual(['active'])

    act(() =>
      renderer.update(
        createElement(
          DashList,
          { id: 'presence', nexus },
          createElement(Dashlet, { id: 'replacement', label: 'Replacement' }),
        ),
      ),
    )
    expect(scoped.getState().scope?.dashList?.rootOrder).toEqual(['active'])
    expect(scoped.createPrunePlan({ mode: 'review' }).candidates).toEqual([
      { nodeId: 'active', effects: ['root-order-entry'] },
    ])
    const inventory = scoped.createPrunePlan({ mode: 'inventory', knownNodeIds: ['replacement'] })
    act(() => {
      expect(scoped.executePrunePlan(inventory)).toMatchObject({ ok: true })
    })
    expect(scoped.getState().scope).toBeUndefined()
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('rejects invalid declarations and non-text labels synchronously', () => {
    const nexus = makeNexus()
    expect(() =>
      render(
        createElement(DashList, {
          id: 'invalid',
          nexus,
          children: createElement('div', null, 'not a declaration'),
        }),
      ),
    ).toThrow('DashList children cannot be DOM elements or text wrappers.')
    expect(() =>
      render(
        createElement(DashList, {
          id: 'labels',
          nexus,
          children: createElement(Dashlet, {
            id: 'item',
            label: createElement('span', null, 'Icon'),
          }),
        }),
      ),
    ).toThrow('Dashlet non-text labels require an explicit aria-label.')
    expect(() =>
      render(
        createElement(DashList, {
          id: 'nested',
          nexus,
          children: createElement(DashGroup, {
            id: 'group',
            label: 'Group',
            children: createElement(DashGroup, { id: 'nested-group', label: 'Nested' }),
          }),
        }),
      ),
    ).toThrow('DashGroup cannot contain another DashGroup.')
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('accepts custom declarations and explicit non-text accessible labels', () => {
    const nexus = makeNexus()
    function CustomDeclaration({ id }: { readonly id: string }) {
      return createElement(Dashlet, { id, label: 'Custom' }, 'retained')
    }
    const renderer = render(
      createElement(DashList, {
        id: 'custom-list',
        nexus,
        children: [
          null,
          false,
          createElement(Fragment, null, createElement(CustomDeclaration, { id: 'custom' })),
          createElement(DashGroup, {
            id: 'icon-group',
            label: createElement('span', null, 'Icon'),
            'aria-label': 'Icon group',
            children: createElement(Dashlet, {
              id: 'icon-item',
              label: createElement('span', null, 'Icon'),
              'aria-label': 'Icon item',
            }),
          }),
        ],
      }),
    )
    expect(renderer.root.findAllByProps({ 'data-picodash-dashlet': 'custom' })).toHaveLength(1)
    expect(
      renderer.root.findAllByProps({ 'aria-label': 'Icon group' }).length,
    ).toBeGreaterThanOrEqual(2)
    expect(renderer.root.findByProps({ 'data-picodash-dashgroup-list': true }).props).toMatchObject(
      {
        'aria-label': 'Icon group',
        'aria-labelledby': undefined,
      },
    )
    expect(renderer.root.findByProps({ 'aria-label': 'Icon item' })).toBeDefined()
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('validates hostile heading values and preserves custom theme props', () => {
    const nexus = makeNexus()
    expect(() =>
      render(
        createElement(DashList, {
          id: 'bad-heading',
          nexus,
          title: 'Bad',
          headingLevel: 7 as never,
        }),
      ),
    ).toThrow('DashList headingLevel must be an integer from 1 through 6.')
    expect(() =>
      render(
        createElement(DashList, {
          id: 'missing-heading',
          nexus,
          title: 'Missing',
        } as never),
      ),
    ).toThrow('DashList title requires headingLevel.')
    const ref = { current: null as HTMLDivElement | null }
    const renderer = render(
      createElement(DashList, {
        id: 'custom-theme',
        nexus,
        theme: 'operator',
        ref,
        children: createElement(Dashlet, { id: 'item', label: 'Item' }),
      }),
    )
    expect(renderer.root.findByProps({ 'data-picodash-dashlist': true })).toBeDefined()
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('rejects duplicate active Lists and cleans standalone/provider precedence', () => {
    const duplicateNexus = makeNexus()
    const first = render(createElement(DashList, { id: 'duplicate', nexus: duplicateNexus }))
    expectContract(
      () => render(createElement(DashList, { id: 'duplicate', nexus: duplicateNexus })),
      'duplicate-entity',
      { scopeId: 'duplicate', entityKind: 'dashList' },
    )
    act(() => first.unmount())
    expect(() => duplicateNexus.destroy()).not.toThrow()

    const hostedNexus = makeNexus()
    const standalone = render(createElement(DashList, { id: 'shared', nexus: hostedNexus }))
    expectContract(
      () =>
        render(
          createElement(PicodashNexusProviderBoundary, {
            nexus: hostedNexus,
            children: createElement(DashList, { id: 'shared' }),
          }),
        ),
      'duplicate-entity',
      { scopeId: 'shared', entityKind: 'dashList' },
    )
    act(() => standalone.unmount())
    expect(() => hostedNexus.destroy()).not.toThrow()
  })

  it('releases standalone leases under StrictMode and does not acquire during SSR', async () => {
    const nexus = makeNexus()
    let strictActions!: ReturnType<typeof useDashListActions>
    const renderer = render(
      createElement(
        StrictMode,
        null,
        createElement(DashList, {
          id: 'strict',
          nexus,
          children: createElement(DashGroup, {
            id: 'group',
            label: 'Group',
            children: createElement(Dashlet, {
              id: 'item',
              label: 'Item',
              children: createElement(ActionProbe, {
                capture: (actions) => (strictActions = actions),
              }),
            }),
          }),
        }),
      ),
    )
    expect(strictActions.collapseAll.availability).toBe('enabled')
    expect(() => nexus.destroy()).toThrow(PicodashContractError)
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()

    const { renderToString } = await import('react-dom/server')
    const ssrNexus = makeNexus()
    renderToString(
      createElement(DashList, {
        id: 'ssr',
        nexus: ssrNexus,
        children: createElement(Dashlet, { id: 'item', label: 'Item' }),
      }),
    )
    let ssrActions!: ReturnType<typeof useDashListActions>
    const ssrProbe = render(
      createElement(PicodashNexusProviderBoundary, {
        nexus: ssrNexus,
        children: createElement(ActionProbe, {
          scopeId: 'ssr',
          capture: (actions) => (ssrActions = actions),
        }),
      }),
    )
    expect(ssrActions.expandAll.availability).toBe('unavailable')
    act(() => ssrProbe.unmount())
    expect(() => ssrNexus.destroy()).not.toThrow()

    const failedNexus = makeNexus()
    expect(() =>
      render(
        createElement(
          Fragment,
          null,
          createElement(DashList, { id: 'failed', nexus: failedNexus }),
          createElement(DashList, { id: 'failed', nexus: failedNexus }),
        ),
      ),
    ).toThrow()
    let failedActions!: ReturnType<typeof useDashListActions>
    const failedProbe = render(
      createElement(PicodashNexusProviderBoundary, {
        nexus: failedNexus,
        children: createElement(ActionProbe, {
          scopeId: 'failed',
          capture: (actions) => (failedActions = actions),
        }),
      }),
    )
    expect(failedActions.expandAll.availability).toBe('unavailable')
    act(() => failedProbe.unmount())
    expect(() => failedNexus.destroy()).not.toThrow()

    const lateNexus = makeNexus()
    let lateActions!: ReturnType<typeof useDashListActions>
    const lateProbe = render(
      createElement(PicodashNexusProviderBoundary, {
        nexus: lateNexus,
        children: createElement(ActionProbe, {
          scopeId: 'late',
          capture: (actions) => (lateActions = actions),
        }),
      }),
    )
    expect(lateActions.collapseAll.availability).toBe('unavailable')
    const lateList = render(
      createElement(
        DashList,
        { id: 'late', nexus: lateNexus },
        createElement(DashGroup, { id: 'group', label: 'Group' }),
      ),
    )
    act(() => {})
    expect(lateActions.collapseAll.availability).toBe('enabled')
    act(() => lateList.unmount())
    expect(lateActions.collapseAll.availability).toBe('unavailable')
    act(() => lateProbe.unmount())
    expect(() => lateNexus.destroy()).not.toThrow()
  })

  it('settles custom forwarding through StrictMode, keyed reparenting, cleanup, and nested Lists', () => {
    const nexus = makeNexus()
    function CustomDeclaration({ id }: { readonly id: string }) {
      return createElement(Dashlet, { id, label: 'Custom' })
    }
    const first = createElement(
      StrictMode,
      null,
      createElement(
        DashList,
        { id: 'lifecycle', nexus },
        createElement(DashGroup, {
          id: 'first-group',
          label: 'First',
          children: createElement(CustomDeclaration, { id: 'moving', key: 'moving' }),
        }),
        createElement(
          Dashlet,
          { id: 'host', label: 'Host' },
          createElement(DashList, {
            id: 'nested',
            children: createElement(Dashlet, { id: 'independent', label: 'Independent' }),
          }),
        ),
      ),
    )
    const renderer = render(first)
    expect(renderer.root.findAllByProps({ 'data-picodash-dashlet': 'moving' })).toHaveLength(1)
    act(() => {
      renderer.update(
        createElement(
          StrictMode,
          null,
          createElement(
            DashList,
            { id: 'lifecycle', nexus },
            createElement(DashGroup, {
              id: 'second-group',
              label: 'Second',
              children: createElement(CustomDeclaration, { id: 'moving', key: 'moving' }),
            }),
            createElement(
              Dashlet,
              { id: 'host', label: 'Host' },
              createElement(DashList, {
                id: 'nested',
                children: createElement(Dashlet, { id: 'independent', label: 'Independent' }),
              }),
            ),
          ),
        ),
      )
    })
    expect(renderer.root.findAllByProps({ 'data-picodash-dashlet': 'moving' })).toHaveLength(1)
    act(() => renderer.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('reports deterministic declaration agreement failures after commit', () => {
    const failures: Array<{ readonly name: string; readonly children: ReactNode }> = []
    failures.push(
      ...[
        ['not-string', 42],
        ['empty', ''],
        ['surrounding-whitespace', ' item '],
        ['control-character', 'item\n'],
      ].map(([, id]) => ({
        name: 'invalid-node-id',
        children: createElement(Dashlet, { id: id as string, label: 'Invalid' }),
      })),
    )
    function Missing({ id }: { readonly id: string }) {
      void id
      return null
    }
    function Mismatch({ id }: { readonly id: string }) {
      void id
      return createElement(Dashlet, { id: 'actual', label: 'Mismatch' })
    }
    function Multiple({ id }: { readonly id: string }) {
      return [
        createElement(Dashlet, { id, label: 'One', key: 'one' }),
        createElement(Dashlet, { id: `${id}-two`, label: 'Two', key: 'two' }),
      ]
    }
    function Group({ id }: { readonly id: string }) {
      return createElement(DashGroup, { id, label: 'Nested group' })
    }
    failures.push(
      { name: 'missing-registration', children: createElement(Missing, { id: 'missing' }) },
      { name: 'id-mismatch', children: createElement(Mismatch, { id: 'declared' }) },
      { name: 'multiple-registrations', children: createElement(Multiple, { id: 'many' }) },
      {
        name: 'kind-mismatch',
        children: createElement(DashGroup, {
          id: 'parent-group',
          label: 'Parent',
          children: createElement(Group, { id: 'nested-group' }),
        }),
      },
      {
        name: 'nested-node',
        children: createElement(
          Dashlet,
          { id: 'outer', label: 'Outer' },
          createElement(Dashlet, { id: 'inner', label: 'Inner' }),
        ),
      },
      {
        name: 'duplicate-node-id',
        children: [
          createElement(Dashlet, { id: 'duplicate', label: 'Root', key: 'root' }),
          createElement(DashGroup, {
            id: 'group',
            label: 'Group',
            children: createElement(Dashlet, { id: 'duplicate', label: 'Child' }),
            key: 'group',
          }),
        ],
      },
    )

    for (const failure of failures) {
      const nexus = makeNexus()
      expect(() =>
        render(
          createElement(DashList, {
            id: `failure-${failure.name}`,
            nexus,
            children: failure.children,
          }),
        ),
      ).toThrow(new RegExp(`DashList node registration failed: ${failure.name}`))
    }
  })

  it('reorders root siblings with keyboard parity and announces the commit', () => {
    const nexus = makeNexus()
    const scoped = nexus.scope('order-root')
    const renderer = render(
      createElement(
        DashList,
        { id: 'order-root', nexus },
        createElement(Dashlet, { id: 'first', label: 'First' }),
        createElement(Dashlet, { id: 'second', label: 'Second' }),
      ),
    )
    const order = () =>
      renderer.root
        .findAll((item) => typeof item.props['data-picodash-dashlet'] === 'string')
        .map((item) => item.props['data-picodash-dashlet'])
    let handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    const beforePickupPreventDefault = vi.fn()
    act(() => {
      void handle.props.onKeyDown({ key: 'ArrowDown', preventDefault: beforePickupPreventDefault })
      void handle.props.onKeyDown({ key: 'Home', preventDefault: beforePickupPreventDefault })
    })
    expect(beforePickupPreventDefault).not.toHaveBeenCalled()
    expect(order()).toEqual(['first', 'second'])
    act(() => {
      void handle.props.onKeyDown({ key: ' ', preventDefault() {} })
    })
    expect(
      JSON.stringify(renderer.root.findByProps({ role: 'status' }).children[0] ?? ''),
    ).toContain('Picked up First, position 1 of 2')
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void handle.props.onKeyDown({ key: 'ArrowDown', preventDefault() {} })
    })
    expect(order()).toEqual(['second', 'first'])
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void handle.props.onKeyDown({ key: 'ArrowDown', preventDefault() {} })
    })
    expect(
      JSON.stringify(renderer.root.findByProps({ role: 'status' }).children[0] ?? ''),
    ).toContain('boundary')
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void handle.props.onKeyDown({ key: 'ArrowUp', preventDefault() {} })
    })
    expect(order()).toEqual(['first', 'second'])
    expect(
      JSON.stringify(renderer.root.findByProps({ role: 'status' }).children[0] ?? ''),
    ).toContain('First moved to position 1 of 2')
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void handle.props.onKeyDown({ key: 'ArrowDown', preventDefault() {} })
    })
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void handle.props.onKeyDown({ key: ' ', preventDefault() {} })
    })
    expect(scoped.getState().scope?.dashList?.rootOrder).toEqual(['second', 'first'])
    expect(
      JSON.stringify(renderer.root.findByProps({ role: 'status' }).children[0] ?? ''),
    ).toContain('Reorder complete: First, position 2 of 2')
    act(() => renderer.unmount())
    nexus.destroy()
  })

  it('remounts the live region for repeated identical announcements', () => {
    const nexus = makeNexus()
    const renderer = render(
      createElement(
        DashList,
        { id: 'repeat-announcement', nexus },
        createElement(Dashlet, { id: 'first', label: 'First' }),
        createElement(Dashlet, { id: 'second', label: 'Second' }),
      ),
    )
    let handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void handle.props.onKeyDown({ key: 'Enter', preventDefault() {} })
    })
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void handle.props.onKeyDown({ key: 'ArrowUp', preventDefault() {} })
    })
    const firstStatus = renderer.root.findByProps({ role: 'status' })
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void handle.props.onKeyDown({ key: 'ArrowUp', preventDefault() {} })
    })
    const secondStatus = renderer.root.findByProps({ role: 'status' })
    expect(secondStatus).not.toBe(firstStatus)
    expect(JSON.stringify(secondStatus.children[0] ?? '')).toContain('boundary')
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void handle.props.onKeyDown({ key: 'Escape', preventDefault() {} })
      renderer.unmount()
    })
    nexus.destroy()
  })

  it('cancels a keyboard reorder when focus leaves its handle', () => {
    const nexus = makeNexus()
    const scoped = nexus.scope('order-blur')
    const renderer = render(
      createElement(
        DashList,
        { id: 'order-blur', nexus },
        createElement(Dashlet, { id: 'first', label: 'First' }),
        createElement(Dashlet, { id: 'second', label: 'Second' }),
      ),
    )
    let first = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void first.props.onKeyDown({ key: ' ', preventDefault() {} })
    })
    first = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void first.props.onKeyDown({ key: 'ArrowDown', preventDefault() {} })
    })
    expect(
      renderer.root
        .findAll((item) => typeof item.props['data-picodash-dashlet'] === 'string')
        .map((item) => item.props['data-picodash-dashlet']),
    ).toEqual(['second', 'first'])
    first = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void first.props.onBlur()
    })
    expect(scoped.getState().scope?.dashList?.rootOrder).toBeUndefined()
    expect(
      renderer.root
        .findAll((item) => typeof item.props['data-picodash-dashlet'] === 'string')
        .map((item) => item.props['data-picodash-dashlet']),
    ).toEqual(['first', 'second'])
    expect(
      JSON.stringify(renderer.root.findByProps({ role: 'status' }).children[0] ?? ''),
    ).toContain('cancelled')

    let second = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'second' })
    act(() => {
      void second.props.onKeyDown({ key: ' ', preventDefault() {} })
    })
    second = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'second' })
    act(() => {
      void second.props.onKeyDown({ key: 'ArrowUp', preventDefault() {} })
    })
    second = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'second' })
    act(() => {
      void second.props.onKeyDown({ key: ' ', preventDefault() {} })
    })
    expect(scoped.getState().scope?.dashList?.rootOrder).toEqual(['second', 'first'])
    act(() => renderer.unmount())
    nexus.destroy()
  })

  it('does not attach another handle pointer to a keyboard reorder session', () => {
    const nexus = makeNexus()
    const renderer = render(
      createElement(
        DashList,
        { id: 'order-modality', nexus },
        createElement(Dashlet, { id: 'first', label: 'First' }),
        createElement(Dashlet, { id: 'second', label: 'Second' }),
      ),
    )
    let first = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void first.props.onKeyDown({ key: ' ', preventDefault() {} })
    })
    const second = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'second' })
    const preventDefault = vi.fn()
    const setPointerCapture = vi.fn()
    act(() => {
      void second.props.onPointerDown({
        pointerId: 2,
        clientY: 30,
        preventDefault,
        setPointerCapture,
      })
      void second.props.onPointerMove({ pointerId: 2, clientY: 60 })
    })
    expect(preventDefault).not.toHaveBeenCalled()
    expect(setPointerCapture).not.toHaveBeenCalled()
    expect(
      renderer.root
        .findAll((item) => typeof item.props['data-picodash-dashlet'] === 'string')
        .map((item) => item.props['data-picodash-dashlet']),
    ).toEqual(['first', 'second'])

    first = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void first.props.onKeyDown({ key: 'ArrowDown', preventDefault() {} })
    })
    expect(
      renderer.root
        .findAll((item) => typeof item.props['data-picodash-dashlet'] === 'string')
        .map((item) => item.props['data-picodash-dashlet']),
    ).toEqual(['second', 'first'])
    first = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void first.props.onKeyDown({ key: 'Escape', preventDefault() {} })
      renderer.unmount()
    })
    nexus.destroy()
  })

  it('ignores repeated pickup keys and non-primary pointer buttons', () => {
    const nexus = makeNexus()
    const scoped = nexus.scope('input-guards')
    const renderer = render(
      createElement(
        DashList,
        { id: 'input-guards', nexus },
        createElement(Dashlet, { id: 'first', label: 'First' }),
        createElement(Dashlet, { id: 'second', label: 'Second' }),
      ),
    )
    let handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    const repeatedPreventDefault = vi.fn()
    act(() => {
      void handle.props.onKeyDown({ key: 'Enter', repeat: false, preventDefault() {} })
      void handle.props.onKeyDown({
        key: 'Enter',
        repeat: true,
        preventDefault: repeatedPreventDefault,
      })
    })
    expect(repeatedPreventDefault).not.toHaveBeenCalled()
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void handle.props.onKeyDown({ key: 'ArrowDown', preventDefault() {} })
      void handle.props.onKeyDown({ key: 'Enter', repeat: false, preventDefault() {} })
    })
    expect(scoped.getState().scope?.dashList?.rootOrder).toEqual(['second', 'first'])

    const setPointerCapture = vi.fn()
    const pointerPreventDefault = vi.fn()
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'second' })
    act(() => {
      void handle.props.onPointerDown({
        button: 2,
        pointerId: 9,
        clientY: 100,
        setPointerCapture,
        preventDefault: pointerPreventDefault,
      })
    })
    expect(setPointerCapture).not.toHaveBeenCalled()
    expect(pointerPreventDefault).not.toHaveBeenCalled()
    expect(
      JSON.stringify(renderer.root.findByProps({ role: 'status' }).children[0] ?? ''),
    ).toContain('Reorder complete')
    act(() => renderer.unmount())
    nexus.destroy()
  })

  it('releases the shared reorder coordinator when an active group unmounts', () => {
    const nexus = makeNexus()
    const scoped = nexus.scope('order-unmount')
    const list = (includeGroup: boolean) =>
      createElement(
        DashList,
        { id: 'order-unmount', nexus },
        includeGroup
          ? createElement(DashGroup, {
              id: 'group',
              label: 'Group',
              key: 'group',
              children: [
                createElement(Dashlet, { id: 'child-a', label: 'Child A', key: 'child-a' }),
                createElement(Dashlet, { id: 'child-b', label: 'Child B', key: 'child-b' }),
              ],
            })
          : null,
        createElement(Dashlet, { id: 'root-a', label: 'Root A', key: 'root-a' }),
        createElement(Dashlet, { id: 'root-b', label: 'Root B', key: 'root-b' }),
      )
    const renderer = render(list(true))
    let handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'child-a' })
    act(() => {
      void handle.props.onKeyDown({ key: ' ', preventDefault() {} })
      renderer.update(list(false))
    })
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'root-a' })
    act(() => {
      void handle.props.onKeyDown({ key: ' ', preventDefault() {} })
    })
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'root-a' })
    act(() => {
      void handle.props.onKeyDown({ key: 'ArrowDown', preventDefault() {} })
    })
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'root-a' })
    act(() => {
      void handle.props.onKeyDown({ key: ' ', preventDefault() {} })
    })
    expect(scoped.getState().scope?.dashList?.rootOrder).toEqual(['root-b', 'root-a'])
    act(() => renderer.unmount())
    nexus.destroy()
  })

  it('keeps pin bands and supports pointer movement through the same model', () => {
    const nexus = makeNexus()
    const scoped = nexus.scope('order-pin')
    const renderer = render(
      createElement(
        DashList,
        { id: 'order-pin', nexus },
        createElement(Dashlet, { id: 'start', label: 'Start', pin: 'start' }),
        createElement(Dashlet, { id: 'auto-a', label: 'Auto A' }),
        createElement(Dashlet, { id: 'auto-b', label: 'Auto B' }),
        createElement(Dashlet, { id: 'auto-c', label: 'Auto C' }),
        createElement(Dashlet, { id: 'auto-d', label: 'Auto D' }),
        createElement(Dashlet, { id: 'end', label: 'End', pin: 'end' }),
      ),
    )
    const order = () =>
      renderer.root
        .findAll((item) => typeof item.props['data-picodash-dashlet'] === 'string')
        .map((item) => item.props['data-picodash-dashlet'])
    const handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'auto-a' })
    const row = (id: string, top: number) => ({
      getAttribute(name: string) {
        return name === 'data-picodash-dashlet' ? id : null
      },
      getBoundingClientRect() {
        return { top, bottom: top + 20 }
      },
    })
    const list = {
      querySelectorAll: () => [
        row('start', -20),
        row('auto-a', 0),
        row('auto-b', 20),
        row('auto-c', 40),
        row('auto-d', 60),
        row('end', 80),
      ],
    }
    const currentTarget = { closest: () => list }
    expect(handle.props['aria-keyshortcuts']).toBe('Enter Space ArrowUp ArrowDown Home End Escape')
    const instructions = renderer.root.findByProps({ id: handle.props['aria-describedby'] })
    expect(JSON.stringify(instructions.children)).toContain('Escape to cancel')
    act(() => {
      void handle.props.onPointerDown({
        pointerId: 1,
        clientY: 19,
        currentTarget,
        preventDefault() {},
      })
    })
    act(() => {
      void handle.props.onPointerMove({ pointerId: 1, clientY: 19 })
    })
    expect(order()).toEqual(['start', 'auto-a', 'auto-b', 'auto-c', 'auto-d', 'end'])
    act(() => {
      void handle.props.onPointerMove({ pointerId: 1, clientY: 40 })
    })
    expect(order()).toEqual(['start', 'auto-b', 'auto-a', 'auto-c', 'auto-d', 'end'])
    const crossedHandle = renderer.root.findByProps({
      'data-picodash-reorder-handle': 'auto-a',
    })
    act(() => {
      void crossedHandle.props.onPointerMove({ pointerId: 1, clientY: 80 })
    })
    const movedHandle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'auto-a' })
    act(() => {
      void movedHandle.props.onPointerUp({ pointerId: 1 })
    })
    expect(order()).toEqual(['start', 'auto-b', 'auto-c', 'auto-d', 'auto-a', 'end'])
    expect(scoped.getState().scope?.dashList?.rootOrder).toEqual([
      'start',
      'auto-b',
      'auto-c',
      'auto-d',
      'auto-a',
      'end',
    ])
    act(() => renderer.unmount())
    nexus.destroy()
  })

  it('uses explicit accessible names for icon-labelled reorder handles', () => {
    const nexus = makeNexus()
    const renderer = render(
      createElement(
        DashList,
        { id: 'order-names', nexus },
        createElement(Dashlet, {
          id: 'icon',
          label: createElement('span', { 'aria-hidden': true }, '★'),
          'aria-label': 'Favorite metric',
        }),
        createElement(Dashlet, { id: 'second', label: 'Second' }),
      ),
    )
    let handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'icon' })
    expect(handle.props['aria-label']).toBe('Reorder Favorite metric')
    act(() => {
      void handle.props.onKeyDown({ key: 'Enter', preventDefault() {} })
    })
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'icon' })
    act(() => {
      void handle.props.onKeyDown({ key: 'Enter', preventDefault() {} })
    })
    expect(
      JSON.stringify(renderer.root.findByProps({ role: 'status' }).children[0] ?? ''),
    ).toContain('Reorder complete: Favorite metric, position 1 of 2')
    act(() => renderer.unmount())
    nexus.destroy()
  })

  it('captures the active pointer and releases it on pointer cancellation without writing', () => {
    const nexus = makeNexus()
    const scoped = nexus.scope('pointer-cancel')
    const renderer = render(
      createElement(
        DashList,
        { id: 'pointer-cancel', nexus },
        createElement(Dashlet, { id: 'first', label: 'First' }),
        createElement(Dashlet, { id: 'second', label: 'Second' }),
      ),
    )
    const setPointerCapture = vi.fn()
    const releasePointerCapture = vi.fn()
    let handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void handle.props.onPointerDown({
        pointerId: 7,
        clientY: 100,
        setPointerCapture,
        releasePointerCapture,
        preventDefault() {},
      })
    })
    expect(setPointerCapture).toHaveBeenCalledWith(7)
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void handle.props.onPointerMove({ pointerId: 8, clientY: 20 })
      void handle.props.onPointerCancel({ pointerId: 8 })
    })
    expect(releasePointerCapture).not.toHaveBeenCalled()
    act(() => {
      void handle.props.onPointerCancel({ pointerId: 7 })
    })
    expect(releasePointerCapture).toHaveBeenCalledWith(7)
    expect(scoped.getState().scope?.dashList?.rootOrder).toBeUndefined()
    expect(
      JSON.stringify(renderer.root.findByProps({ role: 'status' }).children[0] ?? ''),
    ).toContain('cancelled')
    act(() => renderer.unmount())
    nexus.destroy()
  })

  it('releases a captured pointer when external order drift cancels the session', () => {
    const nexus = makeNexus()
    const scoped = nexus.scope('pointer-drift')
    const renderer = render(
      createElement(
        DashList,
        { id: 'pointer-drift', nexus },
        createElement(Dashlet, { id: 'first', label: 'First' }),
        createElement(Dashlet, { id: 'second', label: 'Second' }),
      ),
    )
    const firstCapture = vi.fn()
    const firstRelease = vi.fn()
    let handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void handle.props.onPointerDown({
        pointerId: 7,
        clientY: 100,
        setPointerCapture: firstCapture,
        releasePointerCapture: firstRelease,
        preventDefault() {},
      })
    })
    expect(firstCapture).toHaveBeenCalledWith(7)
    act(() => {
      void scoped.setDashListRootOrder(['second', 'first'])
    })
    expect(firstRelease).toHaveBeenCalledWith(7)
    expect(
      JSON.stringify(renderer.root.findByProps({ role: 'status' }).children[0] ?? ''),
    ).toContain('changed')

    const secondCapture = vi.fn()
    const secondRelease = vi.fn()
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'second' })
    act(() => {
      void handle.props.onPointerDown({
        pointerId: 8,
        clientY: 100,
        setPointerCapture: secondCapture,
        releasePointerCapture: secondRelease,
        preventDefault() {},
      })
    })
    expect(secondCapture).toHaveBeenCalledWith(8)
    act(() => {
      void handle.props.onPointerCancel({ pointerId: 8 })
    })
    expect(secondRelease).toHaveBeenCalledWith(8)
    act(() => renderer.unmount())
    nexus.destroy()
  })

  it('cancels a root pointer reorder when group collapse changes row geometry', () => {
    const nexus = makeNexus()
    const scoped = nexus.scope('collapse-drift')
    const renderer = render(
      createElement(
        DashList,
        { id: 'collapse-drift', nexus },
        createElement(DashGroup, {
          id: 'group',
          label: 'Group',
          children: createElement(Dashlet, { id: 'nested', label: 'Nested' }),
        }),
        createElement(Dashlet, { id: 'second', label: 'Second' }),
      ),
    )
    const releasePointerCapture = vi.fn()
    const handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'group' })
    act(() => {
      void handle.props.onPointerDown({
        pointerId: 7,
        clientY: 100,
        setPointerCapture() {},
        releasePointerCapture,
        preventDefault() {},
      })
    })
    act(() => {
      void scoped.setDashListCollapseOverride('group', true)
    })
    expect(releasePointerCapture).toHaveBeenCalledWith(7)
    expect(
      JSON.stringify(renderer.root.findByProps({ role: 'status' }).children[0] ?? ''),
    ).toContain('changed')
    expect(scoped.getState().scope?.dashList?.rootOrder).toBeUndefined()
    act(() => renderer.unmount())
    nexus.destroy()
  })

  it('cancels a root pointer reorder when collapsibility expands a stored collapse', () => {
    const nexus = makeNexus()
    const scoped = nexus.scope('collapsible-drift')
    scoped.setDashListCollapseOverride('group', true)
    const list = (collapsible: boolean) =>
      createElement(
        DashList,
        { id: 'collapsible-drift', nexus },
        createElement(DashGroup, {
          id: 'group',
          label: 'Group',
          collapsible,
          children: createElement(Dashlet, { id: 'nested', label: 'Nested' }),
        }),
        createElement(Dashlet, { id: 'second', label: 'Second' }),
      )
    const renderer = render(list(true))
    const releasePointerCapture = vi.fn()
    const handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'group' })
    act(() => {
      void handle.props.onPointerDown({
        pointerId: 7,
        clientY: 100,
        setPointerCapture() {},
        releasePointerCapture,
        preventDefault() {},
      })
    })
    act(() => renderer.update(list(false)))
    expect(releasePointerCapture).toHaveBeenCalledWith(7)
    expect(
      JSON.stringify(renderer.root.findByProps({ role: 'status' }).children[0] ?? ''),
    ).toContain('changed')
    expect(scoped.getState().scope?.dashList?.rootOrder).toBeUndefined()
    act(() => renderer.unmount())
    nexus.destroy()
  })

  it('reorders group children, cancels without a write, and cancels on drift', () => {
    const nexus = makeNexus()
    const scoped = nexus.scope('order-group')
    const renderer = render(
      createElement(
        DashList,
        { id: 'order-group', nexus },
        createElement(DashGroup, {
          id: 'group',
          label: 'Group',
          children: [
            createElement(Dashlet, { id: 'one', label: 'One', key: 'one' }),
            createElement(Dashlet, { id: 'two', label: 'Two', key: 'two' }),
          ],
        }),
      ),
    )
    const childOrder = () =>
      renderer.root
        .findAll((item) => typeof item.props['data-picodash-dashlet'] === 'string')
        .map((item) => item.props['data-picodash-dashlet'])
    let handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'one' })
    act(() => {
      void handle.props.onKeyDown({ key: 'Enter', preventDefault() {} })
    })
    act(() => {
      void handle.props.onKeyDown({ key: 'ArrowDown', preventDefault() {} })
    })
    expect(childOrder()).toEqual(['two', 'one'])
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'one' })
    act(() => {
      void handle.props.onKeyDown({ key: 'Escape', preventDefault() {} })
    })
    expect(scoped.getState().scope?.dashList?.groupOrders.size ?? 0).toBe(0)
    expect(
      JSON.stringify(renderer.root.findByProps({ role: 'status' }).children[0] ?? ''),
    ).toContain('cancelled')

    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'one' })
    act(() => {
      void handle.props.onKeyDown({ key: ' ', preventDefault() {} })
    })
    act(() => {
      void scoped.setDashListGroupOrder('group', ['two', 'one'])
    })
    expect(
      JSON.stringify(renderer.root.findByProps({ role: 'status' }).children[0] ?? ''),
    ).toContain('changed')
    expect(scoped.getState().scope?.dashList?.groupOrders.get('group')).toEqual(['two', 'one'])
    act(() => renderer.unmount())
    nexus.destroy()
  })

  it('does not write on a boundary no-op', () => {
    const nexus = makeNexus()
    const scoped = nexus.scope('order-noop')
    const renderer = render(
      createElement(
        DashList,
        { id: 'order-noop', nexus },
        createElement(Dashlet, { id: 'first', label: 'First' }),
        createElement(Dashlet, { id: 'second', label: 'Second' }),
      ),
    )
    let handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void handle.props.onKeyDown({ key: ' ', preventDefault() {} })
    })
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void handle.props.onKeyDown({ key: 'ArrowUp', preventDefault() {} })
    })
    handle = renderer.root.findByProps({ 'data-picodash-reorder-handle': 'first' })
    act(() => {
      void handle.props.onKeyDown({ key: 'Enter', preventDefault() {} })
    })
    expect(scoped.getState().scope?.dashList?.rootOrder).toBeUndefined()
    expect(
      JSON.stringify(renderer.root.findByProps({ role: 'status' }).children[0] ?? ''),
    ).toContain('Reorder complete: First, position 1 of 2')
    act(() => renderer.unmount())
    nexus.destroy()
  })
})

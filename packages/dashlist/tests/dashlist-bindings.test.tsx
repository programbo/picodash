// @vitest-environment jsdom
import { act, createElement, StrictMode, type ReactElement } from 'react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { createDomTestRenderer as create } from '../../../test/dom-renderer.ts'
import { createPicodashNexus } from '@picodash/nexus'
import { acquireBindingLease } from '@picodash/nexus/integration'
import { DashGroup, DashList, Dashlet } from '../src/index.tsx'
import { issuesForDashlet, normalizeBindingDescriptors } from '../src/bindings.tsx'

describe('DashList bindings', () => {
  it('cascades additive group content policies without changing group controls', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { count: { defaultValue: 1 } },
    })
    let context: any
    let view!: ReturnType<typeof create>
    act(() => {
      view = create(
        createElement(
          DashList,
          { id: 'list', nexus },
          createElement(
            DashGroup,
            { id: 'group', label: 'Group', disabled: true, readOnly: true },
            createElement(Dashlet as any, {
              id: 'count',
              label: 'Count',
              field: nexus.fields.count,
              children: (value: any) => {
                context = value
                return null
              },
            }),
          ),
        ),
      )
    })
    expect(context).toMatchObject({ disabled: true, readOnly: true })
    act(() => {
      void context.binding.setInput(2)
      void context.binding.resetValue()
    })
    expect(nexus.getState().values.count).toBe(1)
    const disclosure = view.root.findByProps({ 'aria-label': 'Collapse group Group' })
    expect(disclosure.props.disabled).toBeUndefined()
    act(() => void disclosure.props.onClick())
    expect(view.root.findByProps({ 'data-picodash-dashgroup-list': true }).props.hidden).toBe(true)
    act(() => view.unmount())
    nexus.destroy()
  })

  it('renders a typed single input context and commits through its lease', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { count: { defaultValue: 1 } },
    })
    let context: any
    let view!: ReturnType<typeof create>
    act(() => {
      view = create(
        createElement(
          StrictMode,
          null,
          createElement(
            DashList,
            { id: 'list', nexus },
            createElement(Dashlet as any, {
              id: 'count',
              label: 'Count',
              field: nexus.fields.count,
              children: (value: any) => {
                context = value
                return createElement('output', { 'data-value': String(value.binding.value) })
              },
            }),
          ),
        ) as ReactElement,
      )
    })
    expect(context.binding.mode).toBe('input')
    expect(context.binding.value).toBe(1)
    act(() => void context.binding.setInput(2))
    expect(nexus.getState().values.count).toBe(2)
    expect(view.root.findByType('output').props['data-value']).toBe('2')
    act(() => view.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('supports compound display/input aliases and cleans leases on unmount', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { first: { defaultValue: 'a' }, second: { defaultValue: 'b' } },
    })
    let context: any
    let view!: ReturnType<typeof create>
    act(() => {
      view = create(
        createElement(
          DashList,
          { id: 'list', nexus },
          createElement(Dashlet as any, {
            id: 'pair',
            label: 'Pair',
            fields: {
              left: { field: nexus.fields.first, mode: 'display' },
              right: nexus.fields.second,
            },
            children: (value: any) => {
              context = value
              return null
            },
          }),
        ),
      )
    })
    expect(context.bindings.left.mode).toBe('display')
    expect(context.bindings.right.mode).toBe('input')
    expect(
      view.root.findByProps({ 'data-picodash-dashlet-shell': true }).props['data-layout'],
    ).toBe('block')
    act(() => view.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('preserves opaque compound aliases that match object prototype keys', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { first: { defaultValue: 'a' }, second: { defaultValue: 'b' } },
    })
    const fields = Object.fromEntries([
      ['__proto__', nexus.fields.first],
      ['safe', nexus.fields.second],
    ])
    let context: any
    let view!: ReturnType<typeof create>
    act(() => {
      view = create(
        createElement(
          DashList,
          { id: 'list', nexus },
          createElement(Dashlet as any, {
            id: 'pair',
            label: 'Pair',
            fields,
            children: (value: any) => {
              context = value
              return null
            },
          }),
        ),
      )
    })
    expect(Object.getPrototypeOf(context.bindings)).toBeNull()
    expect(Object.hasOwn(context.bindings, '__proto__')).toBe(true)
    expect(context.bindings.__proto__.value).toBe('a')
    expect(Object.keys(context.bindings)).toEqual(['__proto__', 'safe'])
    act(() => view.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('rejects invalid compound aliases and modes before server output', async () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { value: { defaultValue: 1 } },
    })
    const render = (alias: string) =>
      createElement(
        DashList,
        { id: 'list', nexus },
        createElement(Dashlet as any, {
          id: 'invalid-alias',
          label: 'Invalid alias',
          fields: Object.fromEntries([[alias, nexus.fields.value]]),
        }),
      )

    const { renderToString } = await import('react-dom/server')
    for (const alias of ['', ' ', 'surrounded ', 'control\u0000alias']) {
      const fields = Object.fromEntries([[alias, nexus.fields.value]])
      expect(() => normalizeBindingDescriptors(undefined, fields)).toThrow(
        /binding aliases must be non-empty/,
      )
      expect(() => renderToString(render(alias))).toThrow(/binding aliases must be non-empty/)
    }
    const invalidModeFields = {
      value: { field: nexus.fields.value, mode: 'other' },
    } as never
    expect(() => normalizeBindingDescriptors(undefined, invalidModeFields)).toThrow(
      /binding mode must be input or display/,
    )
    expect(() =>
      renderToString(
        createElement(
          DashList,
          { id: 'invalid-mode-list', nexus },
          createElement(Dashlet as any, {
            id: 'invalid-mode',
            label: 'Invalid mode',
            fields: invalidModeFields,
          }),
        ),
      ),
    ).toThrow(/binding mode must be input or display/)
    expect(() =>
      renderToString(
        createElement(
          DashList,
          { id: 'invalid-single-mode-list', nexus },
          createElement(Dashlet as any, {
            id: 'invalid-single-mode',
            label: 'Invalid single mode',
            field: nexus.fields.value,
            mode: 'other',
          }),
        ),
      ),
    ).toThrow(/binding mode must be input or display/)
    nexus.destroy()
  })

  it('renders binding issues at their IDs and announces the first post-input rejection', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: {
        count: {
          defaultValue: 1,
          parse: (input: unknown) =>
            typeof input === 'number'
              ? { ok: true as const, candidate: input }
              : { ok: false as const, issues: [{ message: 'Count must be a number.' }] },
        },
      },
    })
    let context: any
    let view!: ReturnType<typeof create>
    act(() => {
      view = create(
        createElement(
          DashList,
          { id: 'list', nexus },
          createElement(Dashlet as any, {
            id: 'count',
            label: 'Count',
            field: nexus.fields.count,
            children: (value: any) => {
              context = value
              return null
            },
          }),
        ),
      )
    })
    expect(view.root.findByProps({ role: 'status' }).children).toEqual([])
    act(() => void context.binding.setInput('invalid'))
    expect(context.binding).toMatchObject({ dirty: true, invalid: true, touched: true })
    expect(context.binding.issues[0].code).toBe('parse_failed')
    expect(
      view.root.findByProps({
        id: context.binding.issuesId,
        'data-picodash-dashlet-binding-issues': 'count',
      }),
    ).toBeDefined()
    expect(
      view.root
        .findByProps({ role: 'status' })
        .children.filter((child): child is string => typeof child === 'string')
        .join(''),
    ).toContain('Count must be a number.')
    act(() => view.unmount())
  })

  it('keeps cross-field reset rejection common and enforces the latest read-only policy', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      initialValues: { count: 1 },
      fields: { count: { defaultValue: 3 }, limit: { defaultValue: 2 } },
      validateValues: (values: { readonly count: number; readonly limit: number }) =>
        values.count > values.limit ? [{ message: 'Count exceeds the limit.' }] : [],
    })
    let context: any
    let firstContext: any
    const render = (readOnly: boolean) =>
      createElement(
        DashList,
        { id: 'list', nexus },
        createElement(Dashlet as any, {
          id: 'count',
          label: 'Count',
          field: nexus.fields.count,
          readOnly,
          children: (value: any) => {
            context = value
            firstContext ??= value
            return null
          },
        }),
      )
    let view!: ReturnType<typeof create>
    act(() => {
      view = create(render(false))
    })
    act(() => {
      view.update(render(true))
    })
    act(() => void firstContext.binding.setInput(2))
    expect(nexus.getState().values.count).toBe(1)
    act(() => void context.binding.resetValue())
    expect(nexus.getState().values.count).toBe(1)
    act(() => {
      view.update(render(false))
    })
    act(() => void context.binding.resetValue())
    expect(context.issues).toHaveLength(1)
    expect(context.binding.issues).toHaveLength(0)
    expect(view.root.findByProps({ id: context.issuesId })).toBeDefined()
    expect(
      view.root
        .findByProps({ role: 'status' })
        .children.filter((child): child is string => typeof child === 'string')
        .join(''),
    ).toContain('Count exceeds the limit.')
    act(() => view.unmount())
  })

  it('does not apply aria-disabled to the Dashlet group container', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { count: { defaultValue: 1 } },
    })
    let context: any
    let view!: ReturnType<typeof create>
    act(() => {
      view = create(
        createElement(
          DashList,
          { id: 'list', nexus },
          createElement(Dashlet as any, {
            id: 'count',
            label: 'Count',
            field: nexus.fields.count,
            disabled: true,
            children: (value: any) => {
              context = value
              return createElement('a', { href: '#help' }, 'Help')
            },
          }),
        ),
      )
    })
    expect(context.disabled).toBe(true)
    expect(view.root.findByProps({ role: 'group' }).props['aria-disabled']).toBeUndefined()
    expect(view.root.findByType('a').props.href).toBe('#help')
    act(() => view.unmount())
    nexus.destroy()
  })

  it('does not render issues explicitly attributed to another Dashlet', () => {
    const issue = {
      code: 'validation_failed' as const,
      path: Object.freeze(['values', 'count']),
      message: 'Another Dashlet rejected its value.',
      scopeId: 'other-list',
      itemId: 'other-item',
      fieldKey: 'count',
    }
    expect(issuesForDashlet([issue], 'list', 'count')).toEqual([])
    expect(issuesForDashlet([issue], 'other-list', 'count')).toEqual([])
    expect(issuesForDashlet([issue], 'other-list', 'other-item')).toEqual([issue])
  })

  it('offers shell-owned stale overwrite confirmation without exposing a plan in context', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: {
        count: {
          defaultValue: 1,
          parse: (input: unknown) =>
            typeof input === 'number'
              ? { ok: true as const, candidate: input }
              : { ok: false as const, issues: [{ message: 'Count must be a number.' }] },
        },
      },
    })
    let context: any
    let view!: ReturnType<typeof create>
    act(() => {
      view = create(
        createElement(
          DashList,
          { id: 'list', nexus },
          createElement(Dashlet as any, {
            id: 'count',
            label: 'Count',
            field: nexus.fields.count,
            children: (value: any) => {
              context = value
              return null
            },
          }),
        ),
      )
    })
    expect(context.binding).not.toHaveProperty('createStaleInputOverwritePlan')
    act(() => void context.binding.setInput('invalid'))
    act(() => void nexus.setValue(nexus.fields.count, 2))
    expect(
      view.root
        .findAllByType('button')
        .map((button) =>
          button.children.filter((child): child is string => typeof child === 'string').join(' '),
        ),
    ).not.toContain('Overwrite value…')
    act(() => void context.binding.setInput(3))
    expect(context.binding).toMatchObject({ dirty: true, stale: true, draftValue: 3 })
    expect(
      view.root
        .findAllByType('button')
        .map((button) =>
          button.children.filter((child): child is string => typeof child === 'string').join(' '),
        ),
    ).toContain('Overwrite value…')
    act(() => view.unmount())
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('rejects descriptor mutation and foreign fields before rendering binding values', async () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { first: { defaultValue: 1 }, second: { defaultValue: 2 } },
    })
    const foreign = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { second: { defaultValue: 2 } },
    })
    const render = (field: typeof nexus.fields.first | typeof nexus.fields.second) =>
      createElement(
        DashList,
        { id: 'list', nexus },
        createElement(Dashlet as any, { id: 'value', label: 'Value', field }),
      )
    let view!: ReturnType<typeof create>
    act(() => {
      view = create(render(nexus.fields.first))
    })
    expect(() => act(() => view.update(render(nexus.fields.second)))).toThrow(
      /binding descriptors are immutable/,
    )
    act(() => view.unmount())

    const renderForeignContext = vi.fn(() => null)
    expect(() =>
      act(() => {
        create(
          createElement(
            DashList,
            { id: 'rollback', nexus },
            createElement(Dashlet as any, {
              id: 'pair',
              label: 'Pair',
              fields: { first: nexus.fields.first, second: foreign.fields.second },
              children: renderForeignContext,
            }),
          ),
        )
      }),
    ).toThrowError(expect.objectContaining({ code: 'foreign-handle' }))
    expect(renderForeignContext).not.toHaveBeenCalled()
    const { renderToString } = await import('react-dom/server')
    expect(() =>
      renderToString(
        createElement(
          DashList,
          { id: 'server-foreign', nexus },
          createElement(Dashlet as any, {
            id: 'foreign',
            label: 'Foreign',
            field: foreign.fields.second,
            children: renderForeignContext,
          }),
        ),
      ),
    ).toThrowError(expect.objectContaining({ code: 'foreign-handle' }))
    const lease = acquireBindingLease(nexus.scope('rollback'), {
      itemId: 'pair',
      alias: 'first',
      field: nexus.fields.first,
      mode: 'input',
    })
    lease.release()
  })
})

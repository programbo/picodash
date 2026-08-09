import { createElement, StrictMode, type ReactElement } from 'react'
import { act, create } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vite-plus/test'
import { createPicodashStore } from '@picodash/store'
import { acquireBindingLease } from '@picodash/store/integration'
import { DashList, Dashlet } from '../src/index.tsx'
import { issuesForDashlet, normalizeBindingDescriptors } from '../src/bindings.tsx'

;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

describe('DashList bindings', () => {
  it('renders a typed single input context and commits through its lease', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
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
            { id: 'list', store },
            createElement(Dashlet as any, {
              id: 'count',
              label: 'Count',
              field: store.fields.count,
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
    expect(store.getState().values.count).toBe(2)
    expect(view.root.findByType('output').props['data-value']).toBe('2')
    act(() => view.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('supports compound display/input aliases and cleans leases on unmount', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { first: { defaultValue: 'a' }, second: { defaultValue: 'b' } },
    })
    let context: any
    let view!: ReturnType<typeof create>
    act(() => {
      view = create(
        createElement(
          DashList,
          { id: 'list', store },
          createElement(Dashlet as any, {
            id: 'pair',
            label: 'Pair',
            fields: {
              left: { field: store.fields.first, mode: 'display' },
              right: store.fields.second,
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
    act(() => view.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('preserves opaque compound aliases that match object prototype keys', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { first: { defaultValue: 'a' }, second: { defaultValue: 'b' } },
    })
    const fields = Object.fromEntries([
      ['__proto__', store.fields.first],
      ['safe', store.fields.second],
    ])
    let context: any
    let view!: ReturnType<typeof create>
    act(() => {
      view = create(
        createElement(
          DashList,
          { id: 'list', store },
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
    expect(() => store.destroy()).not.toThrow()
  })

  it('rejects invalid compound aliases during normalization and server rendering', async () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { value: { defaultValue: 1 } },
    })
    const render = (alias: string) =>
      createElement(
        DashList,
        { id: 'list', store },
        createElement(Dashlet as any, {
          id: 'invalid-alias',
          label: 'Invalid alias',
          fields: Object.fromEntries([[alias, store.fields.value]]),
        }),
      )

    const { renderToString } = await import('react-dom/server')
    for (const alias of ['', ' ', 'surrounded ', 'control\u0000alias']) {
      const fields = Object.fromEntries([[alias, store.fields.value]])
      expect(() => normalizeBindingDescriptors(undefined, fields)).toThrow(
        /binding aliases must be non-empty/,
      )
      expect(() => renderToString(render(alias))).toThrow(/binding aliases must be non-empty/)
    }
    store.destroy()
  })

  it('renders binding issues at their IDs and announces the first post-input rejection', () => {
    const store = createPicodashStore({
      valueOwner: 'store',
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
          { id: 'list', store },
          createElement(Dashlet as any, {
            id: 'count',
            label: 'Count',
            field: store.fields.count,
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
    const store = createPicodashStore({
      valueOwner: 'store',
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
        { id: 'list', store },
        createElement(Dashlet as any, {
          id: 'count',
          label: 'Count',
          field: store.fields.count,
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
    expect(store.getState().values.count).toBe(1)
    act(() => void context.binding.resetValue())
    expect(store.getState().values.count).toBe(1)
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
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { count: { defaultValue: 1 } },
    })
    let context: any
    let view!: ReturnType<typeof create>
    act(() => {
      view = create(
        createElement(
          DashList,
          { id: 'list', store },
          createElement(Dashlet as any, {
            id: 'count',
            label: 'Count',
            field: store.fields.count,
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
    store.destroy()
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
    const store = createPicodashStore({
      valueOwner: 'store',
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
          { id: 'list', store },
          createElement(Dashlet as any, {
            id: 'count',
            label: 'Count',
            field: store.fields.count,
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
    act(() => void store.setValue(store.fields.count, 2))
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
    expect(() => store.destroy()).not.toThrow()
  })

  it('rejects descriptor mutation and foreign fields before rendering binding values', async () => {
    const store = createPicodashStore({
      valueOwner: 'store',
      fields: { first: { defaultValue: 1 }, second: { defaultValue: 2 } },
    })
    const foreign = createPicodashStore({
      valueOwner: 'store',
      fields: { second: { defaultValue: 2 } },
    })
    const render = (field: typeof store.fields.first | typeof store.fields.second) =>
      createElement(
        DashList,
        { id: 'list', store },
        createElement(Dashlet as any, { id: 'value', label: 'Value', field }),
      )
    let view!: ReturnType<typeof create>
    act(() => {
      view = create(render(store.fields.first))
    })
    expect(() => act(() => view.update(render(store.fields.second)))).toThrow(
      /binding descriptors are immutable/,
    )
    act(() => view.unmount())

    const renderForeignContext = vi.fn(() => null)
    expect(() =>
      act(() => {
        create(
          createElement(
            DashList,
            { id: 'rollback', store },
            createElement(Dashlet as any, {
              id: 'pair',
              label: 'Pair',
              fields: { first: store.fields.first, second: foreign.fields.second },
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
          { id: 'server-foreign', store },
          createElement(Dashlet as any, {
            id: 'foreign',
            label: 'Foreign',
            field: foreign.fields.second,
            children: renderForeignContext,
          }),
        ),
      ),
    ).toThrowError(expect.objectContaining({ code: 'foreign-handle' }))
    const lease = acquireBindingLease(store.scope('rollback'), {
      itemId: 'pair',
      alias: 'first',
      field: store.fields.first,
      mode: 'input',
    })
    lease.release()
  })
})

// @vitest-environment jsdom
import { act, fireEvent, render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { createPicodashNexus } from '@picodash/nexus'
import { I18nProvider } from 'react-aria-components'
import {
  DashGroup,
  DashStack,
  SliderDashlet,
  TargetSliderDashlet,
  TargetNumberDashlet,
  getDashStackStructure,
  revealDashlet,
} from '../src/index.js'
import { TargetNumber, TargetSlider } from '../src/ui.js'

afterEach(cleanup)
const make = () =>
  createPicodashNexus({
    valueOwner: 'nexus',
    fields: {
      value: {
        defaultValue: 2,
        validate: (value: number) =>
          typeof value === 'number' && Number.isFinite(value)
            ? []
            : [{ message: 'A number is required' }],
      },
    },
  })

describe('target versus achieved', () => {
  it('shows externally supplied nonnumeric JSON without fabricating a target', () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: { value: { defaultValue: 2 } },
    })
    render(
      <DashStack nexus={nexus} id="controls">
        <TargetSliderDashlet
          id="target"
          label="Bore"
          field={nexus.fields.value}
          result={{ status: 'ready', value: 2 }}
        />
      </DashStack>,
    )
    act(() => {
      // Exercise untyped external JSON entering a field without a domain validator.
      // @ts-expect-error external JSON is deliberately outside the declared TypeScript domain
      expect(nexus.setValues({ value: null }).ok).toBe(true)
    })
    expect(screen.getByText('null')).toBeTruthy()
    expect(screen.getByRole('note').textContent).toBe('The current target is not a finite number.')
    expect(screen.queryByRole('slider')).toBeNull()
    cleanup()
    nexus.destroy()
  })
  it('edits target independently from sparse marks and achieved motion', () => {
    const onChange = vi.fn()
    const view = render(
      <TargetSlider
        aria-label="Bore"
        value={2.37}
        min={0}
        max={10}
        step={0.01}
        result={{ status: 'ready', value: 2.4 }}
        marks={[
          { value: 0, label: 'Solid' },
          { value: 2, label: 'Minimum bore' },
        ]}
        onChange={onChange}
      />,
    )
    expect(screen.getByRole('textbox', { name: 'Target Bore' })).toBeTruthy()
    expect(screen.getByRole('slider', { name: 'Target Bore' }).getAttribute('value')).toBe('2.37')
    expect(screen.getByLabelText('Achieved').textContent).toBe('2.4')
    view.rerender(
      <TargetSlider
        aria-label="Bore"
        value={2.37}
        min={0}
        max={10}
        step={0.01}
        result={{ status: 'ready', value: 0 }}
        onChange={onChange}
      />,
    )
    expect(screen.getByLabelText('Achieved').textContent).toBe('0')
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getAllByRole('slider')).toHaveLength(1)
  })
  it('distinguishes previous, no-fit, error, and real values outside the scale', () => {
    const props = { value: 4, min: 0, max: 10, onChange: vi.fn(), 'aria-label': 'Bore' }
    const view = render(<TargetSlider {...props} result={{ status: 'ready', value: 0 }} />)
    const input = screen.getByRole('textbox')
    const marker = view.container.querySelector('[data-picodash-achieved-marker]')
    const root = view.container.querySelector('.picodash-dashstack-target-slider')
    view.rerender(<TargetSlider {...props} result={{ status: 'pending', lastValue: 0 }} />)
    expect(root?.getAttribute('data-result')).toBe('pending')
    expect(root?.getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('textbox')).toBe(input)
    expect(view.container.querySelector('[data-picodash-achieved-marker]')).toBe(marker)
    expect(screen.getByLabelText('Achieved').textContent).toBe('0')
    expect(view.container.querySelector('[data-picodash-target-result-message]')).toBeNull()
    view.rerender(<TargetSlider {...props} result={{ status: 'pending' }} />)
    expect(view.container.querySelector('[data-picodash-target-result-message]')?.textContent).toBe(
      '—',
    )
    view.rerender(<TargetSlider {...props} result={{ status: 'no-fit' }} />)
    expect(screen.queryByLabelText('Achieved')).toBeNull()
    expect(screen.getByText('No feasible result')).toBeTruthy()
    expect(root?.getAttribute('aria-busy')).toBe('false')
    expect(root?.getAttribute('data-result')).toBe('no-fit')
    expect(
      view.container.querySelector(
        '.picodash-dashstack-slider-track [data-picodash-target-result-message]',
      )?.textContent,
    ).toBe('No match')
    expect(input.getAttribute('aria-describedby')).toContain(screen.getByRole('status').id)
    view.rerender(<TargetSlider {...props} value={20} result={{ status: 'ready', value: 12 }} />)
    expect(screen.queryByRole('slider')).toBeNull()
    expect(screen.getByRole('textbox').getAttribute('value')).toBe('20')
    expect(screen.getByLabelText('Achieved').textContent).toContain('12')
    view.rerender(
      <TargetSlider {...props} result={{ status: 'error', message: 'Solver unavailable' }} />,
    )
    expect(screen.getByText('Solver unavailable')).toBeTruthy()
    expect(
      view.container.querySelector('[data-picodash-target-result-message]')?.getAttribute('title'),
    ).toBe('Solver unavailable')
    expect(input.getAttribute('aria-describedby')).toContain(screen.getByRole('status').id)
    expect(screen.getByRole('textbox')).toBe(input)
    expect(props.onChange).not.toHaveBeenCalled()
  })
  it('selects exact actual reference marks and retains dots while stems change', () => {
    const props = {
      value: 4,
      min: 0,
      max: 10,
      onChange: vi.fn(),
      'aria-label': 'Module',
      marks: [
        { value: 0.6, label: '' },
        { value: 2, label: 'Two' },
      ],
    }
    const view = render(
      <TargetSlider {...props} result={{ status: 'ready', value: 0.6000000000000001 }} />,
    )
    const first = view.container.querySelector('[data-picodash-dashstack-slider-mark="0.6"]')
    const second = view.container.querySelector('[data-picodash-dashstack-slider-mark="2"]')
    expect(first?.hasAttribute('data-selected')).toBe(true)
    expect(second?.hasAttribute('data-selected')).toBe(false)
    expect(view.container.querySelector('[data-picodash-achieved-pointer="none"]')).toBeTruthy()
    view.rerender(<TargetSlider {...props} result={{ status: 'ready', value: 2 }} />)
    expect(view.container.querySelector('[data-picodash-dashstack-slider-mark="0.6"]')).toBe(first)
    expect(first?.hasAttribute('data-selected')).toBe(false)
    expect(second?.hasAttribute('data-selected')).toBe(true)
    view.rerender(<TargetSlider {...props} result={{ status: 'pending', lastValue: 2 }} />)
    expect(second?.hasAttribute('data-selected')).toBe(true)
    view.rerender(<TargetSlider {...props} result={{ status: 'ready', value: 2.01 }} />)
    expect(second?.hasAttribute('data-selected')).toBe(false)
    expect(view.container.querySelector('[data-picodash-achieved-pointer="stem"]')).toBeTruthy()
    expect(screen.getByLabelText('Achieved').textContent).toBe('2.01')
    view.rerender(<TargetSlider {...props} result={{ status: 'no-fit' }} />)
    expect(view.container.querySelector('[data-picodash-target-marks] [data-selected]')).toBeNull()
    expect(first?.isConnected).toBe(true)
    view.rerender(
      <TargetSlider {...props} marks={undefined} result={{ status: 'ready', value: 2 }} />,
    )
    expect(view.container.querySelector('[data-picodash-achieved-pointer="arrow"]')).toBeTruthy()
    expect(props.onChange).not.toHaveBeenCalled()
  })
  it('preserves ordered marker slots when the entire feasible set changes', () => {
    const onChange = vi.fn()
    const props = { value: 4, min: 0, max: 10, onChange, 'aria-label': 'Module' }
    const slider = (values: number[]) => (
      <TargetSlider
        {...props}
        marks={values.map((value) => ({ value, label: '' }))}
        result={{ status: 'ready', value: 4 }}
      />
    )
    const view = render(slider([1, 3, 6]))
    const dots = () =>
      Array.from(
        view.container.querySelectorAll(
          '[data-picodash-dashstack-slider-mark]:not([data-exiting])',
        ),
      )
    const original = dots()
    view.rerender(slider([2, 4, 8]))
    expect(dots()).toEqual(original)
    expect(dots().map((dot) => dot.getAttribute('data-picodash-dashstack-slider-mark'))).toEqual([
      '2',
      '4',
      '8',
    ])
    expect(dots()[1]?.hasAttribute('data-selected')).toBe(true)
    view.rerender(slider([1, 2, 4, 9]))
    expect(dots().slice(0, 3)).toEqual(original)
    expect(dots()).toHaveLength(4)
    view.rerender(slider([3, 7]))
    expect(dots()).toEqual(original.slice(0, 2))
    expect(view.container.querySelector('[data-exiting][data-selected]')).toBeNull()
    view.rerender(slider([]))
    expect(dots()).toHaveLength(0)
    expect(view.container.querySelector('[data-picodash-achieved-pointer="arrow"]')).toBeTruthy()
    view.rerender(slider([2, 2, 8]))
    expect(dots()).toHaveLength(3)
    expect(onChange).not.toHaveBeenCalled()
  })
  it('keeps singleton scales finite, stationary and distinct from pending or no-fit', () => {
    const onChange = vi.fn()
    const props = {
      value: 0.6,
      min: 0.6,
      max: 0.6,
      step: 0.01,
      unit: 'mm',
      onChange,
      'aria-label': 'Module',
      marks: [{ value: 0.6, label: '' }],
    }
    const view = render(<TargetSlider {...props} result={{ status: 'ready', value: 0.6 }} />)
    const input = screen.getByRole('textbox')
    const root = view.container.querySelector('.picodash-dashstack-target-slider')
    const thumb = screen.getByRole('slider', { name: 'Target Module' })
    for (const attribute of ['aria-valuemin', 'aria-valuemax', 'aria-valuenow'])
      expect(thumb.getAttribute(attribute)).toBe('0.6')
    expect(thumb.getAttribute('aria-readonly')).toBe('true')
    expect(thumb.getAttribute('aria-valuetext')).toBe('0.6 mm')
    expect(thumb.getAttribute('aria-describedby')).toContain(
      screen.getByText(/Only available value/).id,
    )
    act(() => {
      thumb.focus()
    })
    for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'])
      fireEvent.keyDown(thumb, { key })
    fireEvent.pointerDown(thumb, { pointerId: 1, clientX: 20 })
    fireEvent.pointerMove(thumb, { pointerId: 1, clientX: 200 })
    fireEvent.pointerUp(thumb, { pointerId: 1 })
    expect(onChange).not.toHaveBeenCalled()
    expect(view.container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(
      view.container.querySelector('[data-picodash-target-track]')?.getAttribute('style'),
    ).toContain('ratio: 0.5')
    view.rerender(<TargetSlider {...props} result={{ status: 'pending', lastValue: 0.6 }} />)
    expect(screen.getByRole('slider')).toBe(thumb)
    expect(screen.getByLabelText('Achieved').textContent).toBe('0.6 mm')
    expect(root?.getAttribute('aria-busy')).toBe('true')
    view.rerender(<TargetSlider {...props} result={{ status: 'no-fit' }} />)
    expect(screen.getByRole('slider')).toBe(thumb)
    expect(screen.queryByLabelText('Achieved')).toBeNull()
    expect(root?.getAttribute('data-result')).toBe('no-fit')
    expect(view.container.querySelector('[data-picodash-target-marks] [data-selected]')).toBeNull()
    view.rerender(<TargetSlider {...props} max={0.65} result={{ status: 'ready', value: 0.6 }} />)
    expect(screen.getByRole('textbox')).toBe(input)
    expect(view.container.querySelector('.picodash-dashstack-target-slider')).toBe(root)
    expect(document.activeElement).toBe(screen.getByRole('slider'))
    expect(screen.getByRole('slider').getAttribute('max')).toBe('0.65')
    view.rerender(<TargetSlider {...props} result={{ status: 'ready', value: 0.6 }} />)
    expect(document.activeElement).toBe(screen.getByRole('slider'))
    view.rerender(<TargetSlider {...props} disabled result={{ status: 'ready', value: 0.6 }} />)
    expect(screen.getByRole('slider').getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByRole('slider').tabIndex).toBe(-1)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('supports bound singleton controls without changing canonical values', () => {
    const nexus = make()
    const view = render(
      <I18nProvider locale="de-DE">
        <DashStack nexus={nexus} id="controls">
          <TargetSliderDashlet
            id="target"
            label="Bore"
            field={nexus.fields.value}
            min={2}
            max={2}
            result={{ status: 'ready', value: 2 }}
            formatOptions={{ minimumFractionDigits: 1 }}
            unit="mm"
          />
        </DashStack>
      </I18nProvider>,
    )
    const thumb = screen.getByRole('slider', { name: 'Target Bore' })
    expect(thumb.getAttribute('aria-valuetext')).toBe('2,0 mm')
    fireEvent.keyDown(thumb, { key: 'ArrowRight' })
    expect(nexus.getState().values.value).toBe(2)
    expect(screen.getByRole('textbox', { name: 'Target Bore' })).toBeTruthy()
    view.unmount()
    nexus.destroy()
  })

  it('does not repair incompatible intent or fake an in-scale singleton result', () => {
    const onChange = vi.fn()
    const props = { min: 0.6, max: 0.6, step: 0.01, onChange, 'aria-label': 'Module' }
    const view = render(
      <TargetSlider {...props} value={0.7} result={{ status: 'ready', value: 0.8 }} />,
    )
    expect(screen.queryByRole('slider')).toBeNull()
    expect(screen.getByRole('textbox').getAttribute('value')).toBe('0.7')
    expect(screen.getByText(/Target 0.7 is outside/)).toBeTruthy()
    expect(screen.getByLabelText('Achieved').textContent).toBe('0.8 · outside scale')
    expect(view.container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(onChange).not.toHaveBeenCalled()
    view.rerender(
      <TargetSlider
        {...props}
        value={0.6}
        inputValue={0.7}
        result={{ status: 'ready', value: 0.6 }}
      />,
    )
    expect(screen.getByRole('slider').getAttribute('aria-valuenow')).toBe('0.6')
    expect(screen.getByRole('textbox').getAttribute('value')).toBe('0.7')
    expect(screen.getByRole('textbox').hasAttribute('readonly')).toBe(false)
    view.rerender(
      <TargetSlider {...props} value={0.6} readOnly result={{ status: 'ready', value: 0.6 }} />,
    )
    expect(screen.getByRole('textbox').hasAttribute('readonly')).toBe(true)
  })

  it('preserves numeric intent and an in-progress text draft as result and capacity change', () => {
    const change = vi.fn()
    const view = render(
      <TargetSlider
        aria-label="Bore"
        value={5}
        inputValue={8}
        max={5}
        unit="mm"
        onChange={change}
        result={{ status: 'ready', value: 4 }}
      />,
    )
    const input = screen.getByRole('textbox', { name: 'Target Bore' })
    expect(input.getAttribute('value')).toBe('8')
    expect(screen.getByRole('slider', { name: 'Target Bore' }).getAttribute('value')).toBe('5')
    fireEvent.change(input, { target: { value: '-' } })
    view.rerender(
      <TargetSlider
        aria-label="Bore"
        value={4}
        inputValue={8}
        max={4}
        unit="mm"
        onChange={change}
        result={{ status: 'pending', lastValue: 4 }}
      />,
    )
    expect(screen.getByRole('textbox', { name: 'Target Bore' })).toBe(input)
    expect((input as HTMLInputElement).value).toBe('-')
    expect(change).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Achieved').textContent).toBe('4 mm')
  })
  it('reveals a collapsed ancestor and focuses the numeric target without private selectors', async () => {
    const nexus = make(),
      scope = nexus.scope('controls')
    render(
      <DashStack nexus={nexus} id="controls">
        <DashGroup id="geometry" label="Geometry" defaultCollapsed>
          <DashGroup id="targets" label="Targets">
            <TargetSliderDashlet
              id="bore"
              label="Bore"
              field={nexus.fields.value}
              min={0}
              max={10}
              result={{ status: 'ready', value: 2 }}
            />
          </DashGroup>
        </DashGroup>
      </DashStack>,
    )
    expect(getDashStackStructure(scope).nodes.find((node) => node.id === 'bore')?.visible).toBe(
      false,
    )
    let result: Awaited<ReturnType<typeof revealDashlet>> | undefined
    await act(async () => {
      result = await revealDashlet(scope, 'bore')
    })
    expect(result).toEqual({ ok: true })
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Target Bore' }))
    expect(screen.getByRole('slider', { name: 'Target Bore' })).toBeTruthy()
    expect(await revealDashlet(scope, 'missing')).toEqual({ ok: false, reason: 'not-found' })
  })
})

describe('slider gesture lifecycle', () => {
  it('holds a keyboard edit open until keyup and restores it on Escape', async () => {
    const nexus = make()
    render(
      <DashStack nexus={nexus} id="controls">
        <SliderDashlet id="value" label="Value" field={nexus.fields.value} min={0} max={10} />
      </DashStack>,
    )
    const slider = screen.getByRole('slider', { name: /Value/ })
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(nexus.getState().values.value).toBe(3)
    fireEvent.keyDown(slider, { key: 'ArrowRight', repeat: true })
    expect(nexus.getState().values.value).toBe(4)
    fireEvent.keyDown(slider, { key: 'Escape' })
    expect(nexus.getState().values.value).toBe(2)
    fireEvent.keyUp(slider, { key: 'ArrowRight' })
    await act(async () => {})
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    fireEvent.keyUp(slider, { key: 'ArrowRight' })
    await act(async () => {})
    expect(nexus.getState().values.value).toBe(3)
  })
  it('preserves external writes and cancels on ancestor hiding or configuration change', async () => {
    const nexus = make()
    function View({ max = 10 }: { max?: number }) {
      return (
        <DashStack nexus={nexus} id="controls">
          <DashGroup id="group" label="Group">
            <SliderDashlet id="value" label="Value" field={nexus.fields.value} min={0} max={max} />
          </DashGroup>
        </DashStack>
      )
    }
    const view = render(<View />)
    let slider = screen.getByRole('slider', { name: /Value/ })
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    act(() => {
      nexus.setValue(nexus.fields.value, 7)
    })
    fireEvent.keyDown(slider, { key: 'Escape' })
    expect(nexus.getState().values.value).toBe(7)
    fireEvent.keyUp(slider, { key: 'ArrowRight' })
    await act(async () => {})
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    view.rerender(<View max={20} />)
    expect(nexus.getState().values.value).toBe(7)
    fireEvent.keyUp(slider, { key: 'ArrowRight' })
    await act(async () => {})
    slider = screen.getByRole('slider', { name: /Value/ })
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    fireEvent.click(screen.getByRole('button', { name: 'Collapse group Group' }))
    expect(nexus.getState().values.value).toBe(7)
  })
})

describe('TargetNumber', () => {
  it('edits only the target, uses display-only units, and labels both fields', async () => {
    const nexus = make()
    const view = render(
      <DashStack nexus={nexus} id="numbers">
        <TargetNumberDashlet
          id="ratio"
          label="Reduction"
          field={nexus.fields.value}
          step={0.01}
          unit=":1"
          result={{ status: 'ready', value: 5 }}
        />
      </DashStack>,
    )
    const input = screen.getByRole('textbox', { name: 'Target Reduction' })
    const actual = screen.getByLabelText('Actual Reduction')
    for (const field of view.container.querySelectorAll('[data-picodash-target-number-field]')) {
      expect(field.firstElementChild?.hasAttribute('data-picodash-target-field-label')).toBe(true)
    }
    expect(actual.tagName).toBe('OUTPUT')
    expect(actual.textContent).toBe('5:1')
    fireEvent.change(input, { target: { value: '3.5' } })
    fireEvent.blur(input)
    expect(nexus.getState().values.value).toBe(3.5)
    expect(actual.textContent).toBe('5:1')
    view.rerender(
      <DashStack nexus={nexus} id="numbers">
        <TargetNumberDashlet
          id="ratio"
          label="Reduction"
          field={nexus.fields.value}
          unit=":1"
          readOnly
          targetLabel="Requested"
          actualLabel="Result"
          result={{ status: 'pending', lastValue: 5 }}
        />
      </DashStack>,
    )
    expect(
      screen.getByRole('textbox', { name: 'Requested Reduction' }).hasAttribute('readonly'),
    ).toBe(true)
    expect(screen.getByLabelText('Result Reduction').textContent).toBe('5:1')
    expect(screen.getByText('Requested').id).toBeTruthy()
    cleanup()
    nexus.destroy()
  })
  it('keeps one result slot through pending, no fit, error and zero', () => {
    const props = { value: 2, onChange: vi.fn(), unit: 'mm', 'aria-label': 'Bore' }
    const view = render(<TargetNumber {...props} result={{ status: 'ready', value: 0 }} />)
    const output = screen.getByLabelText('Actual Bore')
    expect(output.textContent).toBe('0mm')
    for (const result of [
      { status: 'pending', lastValue: 0 },
      { status: 'pending' },
      { status: 'no-fit' },
      { status: 'error', message: 'Unavailable' },
    ] as const) {
      view.rerender(<TargetNumber {...props} result={result} />)
      expect(screen.getByLabelText('Actual Bore')).toBe(output)
      expect(output.textContent).toBe('lastValue' in result ? '0mm' : '—')
      const root = view.container.querySelector('.picodash-dashstack-target-number')
      expect(root?.getAttribute('data-result')).toBe(result.status)
      expect(root?.getAttribute('aria-busy')).toBe(String(result.status === 'pending'))
    }
    expect(props.onChange).not.toHaveBeenCalled()
  })
  it('accepts literal 2.9 at a 0.1 step independently of the actual result and optional min', () => {
    const nexus = make()
    nexus.setValue(nexus.fields.value, 2.9)
    for (const min of [undefined, 0, 1.5]) {
      const view = render(
        <DashStack nexus={nexus} id="decimal">
          <TargetNumberDashlet
            id="wall"
            label="Wall"
            field={nexus.fields.value}
            min={min}
            step={0.1}
            result={{ status: 'ready', value: 3.425 }}
            unit="mm"
            formatOptions={{ maximumFractionDigits: 3 }}
          />
        </DashStack>,
      )
      expect(screen.queryByRole('note')).toBeNull()
      const target = screen.getByRole('textbox', { name: 'Target Wall' })
      expect(target.getAttribute('value')).toBe('2.9')
      expect(target.hasAttribute('readonly')).toBe(false)
      expect(screen.getByLabelText('Actual Wall').textContent).toBe('3.425mm')
      view.unmount()
    }
    expect(nexus.getState().values.value).toBe(2.9)
    nexus.destroy()
  })
  it('preserves canonical values outside the configured interval without silent clamping', () => {
    const nexus = make()
    render(
      <DashStack nexus={nexus} id="numbers">
        <TargetNumberDashlet
          id="target"
          label="Bore"
          field={nexus.fields.value}
          max={1}
          result={{ status: 'ready', value: 0 }}
        />
      </DashStack>,
    )
    expect(screen.getByRole('textbox', { name: 'Target Bore' }).getAttribute('value')).toBe('2')
    expect(screen.getByRole('note').textContent).toContain('outside')
    expect(nexus.getState().values.value).toBe(2)
    cleanup()
    nexus.destroy()
  })
})

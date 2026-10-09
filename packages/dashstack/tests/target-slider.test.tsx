// @vitest-environment jsdom
import { act, fireEvent, render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { createPicodashNexus } from '@picodash/nexus'
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
    const view = render(<TargetSlider {...props} result={{ status: 'pending', lastValue: 0 }} />)
    expect(screen.getByLabelText('Achieved').textContent).toBe('0')
    view.rerender(<TargetSlider {...props} result={{ status: 'no-fit' }} />)
    expect(screen.queryByLabelText('Achieved')).toBeNull()
    expect(screen.getByText('No feasible result')).toBeTruthy()
    view.rerender(<TargetSlider {...props} value={20} result={{ status: 'ready', value: 12 }} />)
    expect(screen.queryByRole('slider')).toBeNull()
    expect(screen.getByRole('textbox').getAttribute('value')).toBe('20')
    expect(screen.getByLabelText('Achieved').textContent).toContain('12')
    view.rerender(
      <TargetSlider {...props} result={{ status: 'error', message: 'Solver unavailable' }} />,
    )
    expect(screen.getByText('Solver unavailable')).toBeTruthy()
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
    }
    expect(props.onChange).not.toHaveBeenCalled()
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

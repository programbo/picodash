// @vitest-environment jsdom
import { act, fireEvent, render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { createPicodashNexus } from '@picodash/nexus'
import {
  DashGroup,
  DashStack,
  SliderDashlet,
  TargetSliderDashlet,
  getDashStackStructure,
  revealDashlet,
} from '../src/index.js'
import { TargetSlider } from '../src/ui.js'

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
    expect(screen.getByLabelText('Achieved').textContent).toBe('Previous 0')
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

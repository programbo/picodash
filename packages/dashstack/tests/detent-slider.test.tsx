// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { createPicodashNexus } from '@picodash/nexus'
import { DashGroup, DashStack, SliderDashlet, revealDashlet } from '../src/index.js'
import { Slider } from '../src/ui.js'
import {
  detentIndex,
  detentKey,
  detentPointer,
  detentValue,
  type DetentScale,
} from '../src/detent-model.js'
import { isNumberCompatible } from '../src/number-compatibility.js'

afterEach(cleanup)
const startDetent = { value: 0, label: 'Off' }
const endDetent = { value: 12, label: 'Any' }
const scale = { min: 2, max: 10.05, step: 0.1, startDetent, endDetent }

describe('endpoint detent transitions', () => {
  it('never emits gaps or off-grid numbers over either pointer direction and all endpoint combinations', () => {
    for (const options of [{ startDetent }, { endDetent }, { startDetent, endDetent }]) {
      for (const max of [2, 2.05, 10.05]) {
        const current: DetentScale = { min: 2, max, step: 0.1, ...options }
        for (const initial of ['start', 'range', 'end'] as const) {
          let phase = initial
          for (const x of [
            ...Array.from({ length: 161 }, (_, i) => i - 30),
            ...Array.from({ length: 161 }, (_, i) => 130 - i),
          ]) {
            const next = detentPointer(x, 100, phase, current)
            phase = next.phase
            expect(
              next.value === options.startDetent?.value ||
                next.value === options.endDetent?.value ||
                isNumberCompatible(next.value, current.min, current.max, current.step),
            ).toBe(true)
            expect(detentValue(detentIndex(next.value, current), current)).toBe(next.value)
          }
        }
      }
    }
  })
  it('does not pull beyond ordinary endpoints without detents', () => {
    expect(detentPointer(500, 100, 'range', { ...scale, endDetent: undefined }).pull).toBe(0)
    expect(detentPointer(-500, 100, 'range', { ...scale, startDetent: undefined }).pull).toBe(0)
  })
  it('resists a short pull and requires a fresh keypress at either boundary', () => {
    expect(detentPointer(14, 100, 'range', scale)).toMatchObject({ value: 2, phase: 'range' })
    expect(detentPointer(7, 100, 'range', scale)).toMatchObject({ value: 0, phase: 'start' })
    expect(detentPointer(12, 100, 'start', scale).value).toBe(0)
    expect(detentPointer(24, 100, 'start', scale).value).toBe(2)
    expect(detentPointer(93, 100, 'range', scale).value).toBe(12)
    expect(detentPointer(88, 100, 'end', scale).value).toBe(12)
    expect(detentPointer(76, 100, 'end', scale).value).toBe(10)
    for (const rtl of [false, true]) {
      const lower = rtl ? 'ArrowRight' : 'ArrowLeft',
        higher = rtl ? 'ArrowLeft' : 'ArrowRight'
      expect(detentKey(2, lower, true, rtl, scale)).toBe(2)
      expect(detentKey(2, lower, false, rtl, scale)).toBe(0)
      expect(detentKey(0, higher, false, rtl, scale)).toBe(2)
      expect(detentKey(2, higher, true, rtl, scale)).toBe(2.1)
      expect(detentKey(10, higher, true, rtl, scale)).toBe(10)
      expect(detentKey(10, higher, false, rtl, scale)).toBe(12)
      expect(detentKey(12, lower, false, rtl, scale)).toBe(10)
    }
  })
})

const make = () =>
  createPicodashNexus({
    valueOwner: 'nexus',
    fields: {
      bore: {
        defaultValue: 2,
        validate: (value: number) =>
          value === 0 || value === 12 || isNumberCompatible(value, 2, 10, 0.1)
            ? []
            : [{ message: 'Invalid size' }],
      },
    },
  })

it('binds numeric detents with rollback, external ownership, changed capacity, hiding and reveal', async () => {
  const nexus = make()
  function View({ max = 10 }: { max?: number }) {
    return (
      <DashStack nexus={nexus} id="detents">
        <DashGroup id="bores" label="Bores">
          <SliderDashlet
            id="bore"
            label="Bore"
            field={nexus.fields.bore}
            min={2}
            max={max}
            step={0.1}
            startDetent={startDetent}
            endDetent={endDetent}
          />
        </DashGroup>
      </DashStack>
    )
  }
  const view = render(<View />)
  let input = screen.getByRole('slider', { name: 'Bore' })
  fireEvent.keyDown(input, { key: 'ArrowLeft' })
  expect(nexus.getState().values.bore).toBe(0)
  expect(input.getAttribute('aria-valuetext')).toBe('Off')
  fireEvent.keyDown(input, { key: 'Escape' })
  expect(nexus.getState().values.bore).toBe(2)
  fireEvent.keyUp(input, { key: 'ArrowLeft' })
  await act(async () => {})
  fireEvent.keyDown(input, { key: 'End' })
  expect(nexus.getState().values.bore).toBe(12)
  act(() => {
    nexus.setValue(nexus.fields.bore, 4)
  })
  fireEvent.keyDown(input, { key: 'Escape' })
  expect(nexus.getState().values.bore).toBe(4)
  fireEvent.keyUp(input, { key: 'End' })
  await act(async () => {})
  fireEvent.keyDown(input, { key: 'ArrowRight' })
  expect(nexus.getState().values.bore).toBe(4.1)
  view.rerender(<View max={5} />)
  expect(nexus.getState().values.bore).toBe(4)
  fireEvent.keyUp(input, { key: 'ArrowRight' })
  await act(async () => {})
  fireEvent.keyDown(input, { key: 'Home' })
  fireEvent.click(screen.getByRole('button', { name: 'Collapse group Bores' }))
  expect(nexus.getState().values.bore).toBe(4)
  await act(async () => {
    expect(await revealDashlet(nexus.scope('detents'), 'bore')).toEqual({ ok: true })
  })
  input = screen.getByRole('slider', { name: 'Bore' })
  expect(document.activeElement).toBe(input)
  view.rerender(<View max={3} />)
  expect(screen.queryByRole('slider')).toBeNull()
  expect(screen.getByRole('note').textContent).toContain('outside')
  expect(nexus.getState().values.bore).toBe(4)
})

it('supports singleton intervals, disabled/read-only policies and native accessibility edits', async () => {
  const onChange = vi.fn()
  const props = {
    min: 2,
    max: 2,
    step: 0.1,
    value: 0,
    onChange,
    startDetent,
    endDetent,
    'aria-label': 'Size',
  }
  const view = render(<Slider {...props} />)
  let input = screen.getByRole('slider')
  fireEvent.keyDown(input, { key: 'ArrowRight' })
  expect(onChange).toHaveBeenLastCalledWith(2)
  fireEvent.keyUp(input, { key: 'ArrowRight' })
  await act(async () => {})
  fireEvent.change(input, { target: { value: '2' } })
  expect(onChange).toHaveBeenLastCalledWith(12)
  onChange.mockClear()
  for (const policy of [{ disabled: true }, { readOnly: true }]) {
    view.rerender(<Slider {...props} {...policy} />)
    input = screen.getByRole('slider')
    fireEvent.keyDown(input, { key: 'ArrowRight' })
    fireEvent.change(input, { target: { value: '1' } })
    expect(onChange).not.toHaveBeenCalled()
  }
})

it('rejects malformed detents and ambiguous constraint combinations', () => {
  for (const detent of [
    { value: 2, label: 'Off' },
    { value: NaN, label: 'Off' },
    { value: 0, label: '' },
  ])
    expect(() =>
      render(<Slider value={2} onChange={() => {}} min={2} max={10} startDetent={detent} />),
    ).toThrow()
  expect(() =>
    render(
      <Slider
        value={2}
        onChange={() => {}}
        min={2}
        max={10}
        startDetent={startDetent}
        allowedRange={{ min: 3, max: 5 }}
      />,
    ),
  ).toThrow()
})

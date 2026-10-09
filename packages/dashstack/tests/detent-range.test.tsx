// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, it, expect, vi } from 'vite-plus/test'
import { createPicodashNexus } from '@picodash/nexus'
import { DashStack, RangeDashlet } from '../src/index.js'
import { RangeSlider } from '../src/ui.js'

afterEach(cleanup)
const endDetent = { value: 13, label: 'Any' },
  startDetent = { value: 0, label: 'Off' }
const create = () =>
  createPicodashNexus({
    valueOwner: 'nexus',
    fields: {
      range: {
        defaultValue: { start: 3, end: 12 },
        validate: (value: { start: number; end: number }) =>
          value.start > value.end ? [{ message: 'Ordered bounds required' }] : [],
      },
    },
  })
it('keeps detents endpoint-specific, announces labels and preserves ordered atomic values', async () => {
  const nexus = create()
  render(
    <DashStack id="range" nexus={nexus}>
      <RangeDashlet
        id="count"
        label="Count"
        field={nexus.fields.range}
        min={2}
        max={12}
        startDetent={startDetent}
        endDetent={endDetent}
      />
    </DashStack>,
  )
  const [start, end] = screen.getAllByRole('slider')
  fireEvent.keyDown(end!, { key: 'ArrowRight', repeat: true })
  expect(nexus.getState().values.range).toEqual({ start: 3, end: 12 })
  fireEvent.keyUp(end!, { key: 'ArrowRight' })
  await act(async () => {})
  fireEvent.keyDown(end!, { key: 'ArrowRight' })
  expect(nexus.getState().values.range).toEqual({ start: 3, end: 13 })
  expect(end?.getAttribute('aria-valuetext')).toBe('Any')
  fireEvent.keyUp(end!, { key: 'ArrowRight' })
  await act(async () => {})
  fireEvent.keyDown(start!, { key: 'End' })
  expect(nexus.getState().values.range).toEqual({ start: 12, end: 13 })
  fireEvent.keyUp(start!, { key: 'End' })
  await act(async () => {})
  fireEvent.keyDown(end!, { key: 'Home' })
  expect(nexus.getState().values.range).toEqual({ start: 12, end: 12 })
  fireEvent.keyUp(end!, { key: 'Home' })
  await act(async () => {})
  fireEvent.keyDown(start!, { key: 'Home' })
  expect(nexus.getState().values.range).toEqual({ start: 0, end: 12 })
  expect(start?.getAttribute('aria-valuetext')).toBe('Off')
  fireEvent.keyDown(start!, { key: 'Escape' })
  expect(nexus.getState().values.range).toEqual({ start: 12, end: 12 })
  cleanup()
  nexus.destroy()
})
it('rolls back only owned compound changes and cancels on scale change and removal', async () => {
  const nexus = create()
  const view = (max = 12) => (
    <DashStack id="range" nexus={nexus}>
      <RangeDashlet
        id="count"
        label="Count"
        field={nexus.fields.range}
        min={2}
        max={max}
        endDetent={endDetent}
      />
    </DashStack>
  )
  const mounted = render(view())
  let end = screen.getAllByRole('slider')[1]!
  fireEvent.keyDown(end, { key: 'End' })
  expect(nexus.getState().values.range.end).toBe(13)
  fireEvent.keyDown(end, { key: 'Escape' })
  expect(nexus.getState().values.range).toEqual({ start: 3, end: 12 })
  fireEvent.keyUp(end, { key: 'End' })
  await act(async () => {})
  fireEvent.keyDown(end, { key: 'End' })
  act(() => {
    nexus.setValue(nexus.fields.range, { start: 4, end: 10 })
    nexus.setValue(nexus.fields.range, { start: 3, end: 13 })
  })
  fireEvent.keyDown(end, { key: 'ArrowLeft', repeat: true })
  fireEvent.keyDown(end, { key: 'Escape' })
  expect(nexus.getState().values.range).toEqual({ start: 3, end: 13 })
  fireEvent.keyUp(end, { key: 'End' })
  await act(async () => {})
  act(() => {
    nexus.setValue(nexus.fields.range, { start: 3, end: 12 })
  })
  end = screen.getAllByRole('slider')[1]!
  fireEvent.keyDown(end, { key: 'ArrowLeft' })
  expect(nexus.getState().values.range.end).toBe(11)
  mounted.rerender(view(11))
  expect(nexus.getState().values.range.end).toBe(12)
  expect(screen.queryAllByRole('slider')).toHaveLength(0)
  mounted.rerender(view())
  end = screen.getAllByRole('slider')[1]!
  fireEvent.keyUp(end, { key: 'ArrowLeft' })
  await act(async () => {})
  fireEvent.keyDown(end, { key: 'End' })
  mounted.unmount()
  expect(nexus.getState().values.range).toEqual({ start: 3, end: 12 })
  nexus.destroy()
})
it('supports native index edits, singleton scales, custom output, disabled and read-only', () => {
  const onChange = vi.fn(),
    props = {
      min: 2,
      max: 2,
      value: { start: 2, end: 3 },
      endDetent: { value: 3, label: 'Any' },
      onChange,
      'aria-label': 'Count',
      formatValue: () => '2–∞',
    }
  const mounted = render(<RangeSlider {...props} />),
    [start, end] = screen.getAllByRole('slider')
  expect(screen.getByText('2–∞')).toBeTruthy()
  fireEvent.change(end!, { target: { value: '0' } })
  expect(onChange).toHaveBeenLastCalledWith({ start: 2, end: 2 })
  fireEvent.keyDown(start!, { key: 'End' })
  expect(onChange).toHaveBeenLastCalledWith({ start: 2, end: 3 })
  for (const policy of [{ disabled: true }, { readOnly: true }]) {
    onChange.mockClear()
    mounted.rerender(<RangeSlider {...props} {...policy} />)
    fireEvent.keyDown(end!, { key: 'Home' })
    fireEvent.change(end!, { target: { value: '0' } })
    expect(onChange).not.toHaveBeenCalled()
  }
})
it('rejects invalid detents while showing incompatible canonical data without repair', () => {
  expect(() =>
    render(
      <RangeSlider
        value={{ start: 2, end: 12 }}
        onChange={() => {}}
        min={2}
        max={12}
        endDetent={{ value: 12, label: 'Any' }}
      />,
    ),
  ).toThrow()
  const nexus = create()
  nexus.setValue(nexus.fields.range, { start: 3, end: 14 })
  render(
    <DashStack id="r" nexus={nexus}>
      <RangeDashlet
        id="r"
        label="Range"
        field={nexus.fields.range}
        min={2}
        max={12}
        endDetent={endDetent}
      />
    </DashStack>,
  )
  expect(screen.queryByRole('slider')).toBeNull()
  expect(nexus.getState().values.range.end).toBe(14)
  cleanup()
  nexus.destroy()
})

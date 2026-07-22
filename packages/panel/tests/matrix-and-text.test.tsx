import { isValidElement } from 'react'
import { expect, test } from 'vite-plus/test'
import {
  findFirstEnabledMatrix2DPosition,
  findMatrix2DValuePosition,
  findNextMatrix2DPosition,
  normalizeMatrix2DValue,
  picodashTextControlKind,
} from '../src/advanced.ts'
import {
  PicodashAlignment,
  PicodashMatrix2D,
  PicodashText,
  type PicodashAlignmentValue,
  type PicodashMatrix2DOption,
} from '../src/index.ts'

const matrixOptions: readonly (readonly PicodashMatrix2DOption<{
  density: string
}>[])[] = [
  [
    {
      'aria-label': 'Compact',
      children: <span>Compact</span>,
      className: 'rounded-l',
      'data-density': 'compact',
      style: { justifyContent: 'start' },
      title: 'Use compact density',
      value: { density: 'compact' },
    },
    {
      'aria-label': 'Comfortable',
      children: <span>Comfortable</span>,
      disabled: true,
      value: { density: 'comfortable' },
    },
    {
      'aria-label': 'Spacious',
      children: <span>Spacious</span>,
      value: { density: 'spacious' },
    },
  ],
  [
    { children: 'Small', value: { density: 'small' } },
    { children: 'Medium', value: { density: 'medium' } },
    { children: 'Large', value: { density: 'large' } },
  ],
]

test('PicodashText selects the input primitive from multiline', () => {
  expect(picodashTextControlKind(undefined)).toBe('input')
  expect(picodashTextControlKind(false)).toBe('input')
  expect(picodashTextControlKind(true)).toBe('textarea')

  const singleLine = <PicodashText field="title" defaultValue="Untitled" />
  const multiline = <PicodashText field="notes" defaultValue="" multiline />
  expect(isValidElement(singleLine)).toBe(true)
  expect(isValidElement(multiline)).toBe(true)
  expect(multiline.props.multiline).toBe(true)
})

test('PicodashMatrix2D exposes controlled values and arbitrary option/container props', () => {
  const element = (
    <PicodashMatrix2D
      containerProps={{
        'aria-label': 'Density',
        className: 'gap-1',
        'data-layout': 'density',
        style: { width: 180 },
      }}
      defaultValue={{ density: 'compact' }}
      field="density"
      options={matrixOptions}
    />
  )

  expect(isValidElement(element)).toBe(true)
  expect(element.props.containerProps).toMatchObject({
    'aria-label': 'Density',
    className: 'gap-1',
    'data-layout': 'density',
  })
  expect(matrixOptions[0][0]).toMatchObject({
    'aria-label': 'Compact',
    className: 'rounded-l',
    'data-density': 'compact',
    title: 'Use compact density',
  })
  expect(normalizeMatrix2DValue({ density: 'compact' }, matrixOptions)).toBe(
    matrixOptions[0][0].value,
  )
  expect(normalizeMatrix2DValue({ density: 'comfortable' }, matrixOptions)).toBe(
    matrixOptions[0][0].value,
  )
  expect(findMatrix2DValuePosition({ density: 'large' }, matrixOptions)).toEqual({
    column: 2,
    row: 1,
  })
  expect(findFirstEnabledMatrix2DPosition(matrixOptions)).toEqual({ column: 0, row: 0 })
})

test('PicodashMatrix2D navigation follows spatial rows and skips disabled options', () => {
  expect(findNextMatrix2DPosition(matrixOptions, { column: 0, row: 0 }, 'right')).toEqual({
    column: 2,
    row: 0,
  })
  expect(findNextMatrix2DPosition(matrixOptions, { column: 2, row: 0 }, 'left')).toEqual({
    column: 0,
    row: 0,
  })
  expect(findNextMatrix2DPosition(matrixOptions, { column: 1, row: 1 }, 'up')).toEqual({
    column: 0,
    row: 0,
  })
  expect(findNextMatrix2DPosition(matrixOptions, { column: 2, row: 1 }, 'down')).toBeUndefined()
})

test('PicodashAlignment remains a styled 3x3 Matrix2D preset', () => {
  const element = PicodashAlignment({ defaultValue: 'bottom-right', field: 'alignment' })
  const props = element.props as {
    containerProps: { 'aria-label': string; className: string }
    defaultValue: PicodashAlignmentValue
    options: readonly (readonly PicodashMatrix2DOption<PicodashAlignmentValue>[])[]
    selectionRole: string
    validationMessage: string
  }

  expect(element.type).toBe(PicodashMatrix2D)
  expect(props.defaultValue).toBe('bottom-right')
  expect(props.options.map((row) => row.length)).toEqual([3, 3, 3])
  expect(props.options[1]?.[1]).toMatchObject({
    'aria-label': 'Middle center',
    'data-alignment-index': 4,
    title: 'Middle center',
    value: 'center',
  })
  expect(props.containerProps['aria-label']).toBe('Alignment')
  expect(props.containerProps.className).toContain('border-picodash-control')
  expect(props.selectionRole).toBe('radio')
  expect(props.validationMessage).toBe('Alignment must be one of the nine supported positions.')
})

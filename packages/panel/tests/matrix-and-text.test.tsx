import { isValidElement } from 'react'
import { expect, test } from 'vite-plus/test'
import {
  findFirstEnabledMatrix2DPosition,
  findMatrix2DValuePosition,
  findNextMatrix2DPosition,
  normalizeMatrix2DValue,
  normalizeTextMinRows,
  tweakerTextControlKind,
} from '../src/advanced.ts'
import {
  TweakerAlignment,
  TweakerMatrix2D,
  TweakerText,
  type TweakerAlignmentValue,
  type TweakerMatrix2DOption,
} from '../src/index.ts'

const matrixOptions: readonly (readonly TweakerMatrix2DOption<{
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

test('TweakerText selects the input primitive from normalized minRows', () => {
  expect(normalizeTextMinRows(undefined)).toBe(1)
  expect(normalizeTextMinRows(0)).toBe(1)
  expect(normalizeTextMinRows(1)).toBe(1)
  expect(normalizeTextMinRows(1.1)).toBe(2)
  expect(normalizeTextMinRows(3.2)).toBe(4)
  expect(normalizeTextMinRows(Number.NaN)).toBe(1)
  expect(tweakerTextControlKind(1)).toBe('input')
  expect(tweakerTextControlKind(2)).toBe('textarea')

  const singleLine = <TweakerText field="title" defaultValue="Untitled" />
  const multiline = <TweakerText field="notes" defaultValue="" minRows={3} />
  expect(isValidElement(singleLine)).toBe(true)
  expect(isValidElement(multiline)).toBe(true)
  expect(multiline.props.minRows).toBe(3)
})

test('TweakerMatrix2D exposes controlled values and arbitrary option/container props', () => {
  const element = (
    <TweakerMatrix2D
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

test('TweakerMatrix2D navigation follows spatial rows and skips disabled options', () => {
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

test('TweakerAlignment remains a styled 3x3 Matrix2D preset', () => {
  const element = TweakerAlignment({ defaultValue: 'bottom-right', field: 'alignment' })
  const props = element.props as {
    containerProps: { 'aria-label': string; className: string }
    defaultValue: TweakerAlignmentValue
    options: readonly (readonly TweakerMatrix2DOption<TweakerAlignmentValue>[])[]
    selectionRole: string
    validationMessage: string
  }

  expect(element.type).toBe(TweakerMatrix2D)
  expect(props.defaultValue).toBe('bottom-right')
  expect(props.options.map((row) => row.length)).toEqual([3, 3, 3])
  expect(props.options[1]?.[1]).toMatchObject({
    'aria-label': 'Centre',
    'data-alignment-index': 4,
    title: 'Centre',
    value: 'center',
  })
  expect(props.containerProps['aria-label']).toBe('Alignment')
  expect(props.containerProps.className).toContain('border-tweaker-control')
  expect(props.selectionRole).toBe('radio')
  expect(props.validationMessage).toBe('Alignment must be one of the nine supported positions.')
})

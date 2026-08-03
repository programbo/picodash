import { TextAlignCenter, TextAlignEnd, TextAlignStart, type LucideIcon } from 'lucide-react'
import type { PicodashInputItemProps } from '../components/panel/PicodashItem.js'
import { cn } from '../utilities/utils.js'
import { PicodashMatrix2D, type PicodashMatrix2DOption } from './matrix-2d.js'

const alignmentRows = [
  { label: 'Top', value: 'top' },
  { label: 'Middle', value: 'middle' },
  { label: 'Bottom', value: 'bottom' },
] as const
const alignmentColumns = [
  { label: 'left', value: 'left' },
  { label: 'center', value: 'center' },
  { label: 'right', value: 'right' },
] as const

type AlignmentRow = (typeof alignmentRows)[number]['value']
type AlignmentColumn = (typeof alignmentColumns)[number]['value']

type AlignmentPosition = `${AlignmentRow}-${AlignmentColumn}`

export type PicodashAlignmentValue = Exclude<AlignmentPosition, 'middle-center'> | 'center'

export interface PicodashAlignmentProps extends Omit<
  PicodashInputItemProps<PicodashAlignmentValue>,
  'children' | 'defaultValue' | 'parse'
> {
  defaultValue?: PicodashAlignmentValue
}

export const picodashAlignmentOptions = alignmentRows.reduce(
  (options, row) => {
    return [
      ...options,
      ...alignmentColumns.map((column) => ({
        label: `${row.label} ${column.label}`,
        value:
          row.value === 'middle' && column.value === 'center'
            ? 'center'
            : (`${row.value}-${column.value}` as PicodashAlignmentValue),
      })),
    ]
  },
  [] as { label: string; value: PicodashAlignmentValue }[],
)

export const picodashAlignmentValues = picodashAlignmentOptions.map(({ value }) => value)

const alignmentColumnIcons = [
  TextAlignStart,
  TextAlignCenter,
  TextAlignEnd,
] as const satisfies readonly [LucideIcon, LucideIcon, LucideIcon]

const alignmentRowClasses = ['items-start', 'items-center', 'items-end'] as const
const alignmentColumnClasses = ['justify-start', 'justify-center', 'justify-end'] as const

export function PicodashAlignment({
  defaultValue = 'center',
  ...controlProps
}: PicodashAlignmentProps) {
  const normalizedDefault = normalizeAlignmentValue(defaultValue)

  return (
    <PicodashMatrix2D<PicodashAlignmentValue>
      {...controlProps}
      containerProps={{
        'aria-label': 'Alignment',
        className:
          'border-picodash-control shadow-picodash-sm rounded-picodash-control overflow-hidden border bg-(--_picodash-choice-background) p-(--picodash-space-0-5)',
      }}
      defaultValue={normalizedDefault}
      options={picodashAlignmentMatrixOptions}
      selectionRole="radio"
      validationMessage="Alignment must be one of the nine supported positions."
    />
  )
}

export function isPicodashAlignmentValue(value: unknown): value is PicodashAlignmentValue {
  return picodashAlignmentOptions.some((option) => option.value === value)
}

export function normalizeAlignmentValue(
  value: unknown,
  fallback: PicodashAlignmentValue = 'center',
): PicodashAlignmentValue {
  return isPicodashAlignmentValue(value) ? value : fallback
}
const columns = alignmentColumns.length
const picodashAlignmentMatrixOptions = Array.from({ length: columns }, (_, rowIndex) =>
  picodashAlignmentOptions
    .slice(rowIndex * columns, rowIndex * columns + columns)
    .map((option, columnIndex) => {
      const AlignmentIcon = alignmentColumnIcons[columnIndex] ?? TextAlignCenter

      return {
        'aria-label': option.label,
        children: (
          <AlignmentIcon aria-hidden="true" className="size-(--picodash-icon-sm)" strokeWidth={2} />
        ),
        className: cn(
          'text-picodash-muted hover:bg-picodash-surface-muted hover:text-picodash-text data-[state=on]:bg-picodash-accent data-[state=on]:text-picodash-accent-text relative flex size-(--picodash-control-height-md) p-(--picodash-space-1) transition-colors duration-(--picodash-duration-fast)',
          columnIndex !== 0 && 'border-picodash-control border-l',
          rowIndex !== 0 && 'border-picodash-control border-t',
          alignmentRowClasses[rowIndex],
          alignmentColumnClasses[columnIndex],
        ),
        'data-alignment-index': rowIndex * columns + columnIndex,
        title: option.label,
        value: option.value,
      }
    }),
) satisfies readonly (readonly PicodashMatrix2DOption<PicodashAlignmentValue>[])[]

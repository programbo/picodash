import { TextAlignCenter, TextAlignEnd, TextAlignStart, type LucideIcon } from 'lucide-react'
import type { TweakerInputItemProps } from '../tweaker-control.js'
import { cn } from '../utils.js'
import { TweakerMatrix2D, type TweakerMatrix2DOption } from './matrix-2d.js'

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

export type TweakerAlignmentValue = `${AlignmentRow}-${AlignmentColumn}`

export interface TweakerAlignmentProps extends Omit<
  TweakerInputItemProps<TweakerAlignmentValue>,
  'children' | 'defaultValue' | 'parse'
> {
  defaultValue?: TweakerAlignmentValue
}

export const tweakerAlignmentOptions = alignmentRows.reduce(
  (options, row) => {
    return [
      ...options,
      ...alignmentColumns.map((column) => ({
        label: `${row.label} ${column.label}`,
        value: `${row.value}-${column.value}` as TweakerAlignmentValue,
      })),
    ]
  },
  [] as { label: string; value: TweakerAlignmentValue }[],
)

export const tweakerAlignmentValues = tweakerAlignmentOptions.map(({ value }) => value)

const alignmentColumnIcons = [
  TextAlignStart,
  TextAlignCenter,
  TextAlignEnd,
] as const satisfies readonly [LucideIcon, LucideIcon, LucideIcon]

const alignmentRowClasses = ['items-start', 'items-center', 'items-end'] as const
const alignmentColumnClasses = ['justify-start', 'justify-center', 'justify-end'] as const

export function TweakerAlignment({
  defaultValue = 'middle-center',
  ...controlProps
}: TweakerAlignmentProps) {
  const normalizedDefault = normalizeAlignmentValue(defaultValue)

  return (
    <TweakerMatrix2D<TweakerAlignmentValue>
      {...controlProps}
      containerProps={{
        'aria-label': 'Alignment',
        className:
          'border-tweaker-control shadow-tweaker-sm rounded-tweaker-control overflow-hidden border bg-(--_tweaker-choice-background) p-(--tweaker-space-0-5)',
      }}
      defaultValue={normalizedDefault}
      options={tweakerAlignmentMatrixOptions}
      selectionRole="radio"
      validationMessage="Alignment must be one of the nine supported positions."
    />
  )
}

export function isTweakerAlignmentValue(value: unknown): value is TweakerAlignmentValue {
  return tweakerAlignmentOptions.some((option) => option.value === value)
}

export function normalizeAlignmentValue(
  value: unknown,
  fallback: TweakerAlignmentValue = 'middle-center',
): TweakerAlignmentValue {
  return isTweakerAlignmentValue(value) ? value : fallback
}
const columns = alignmentColumns.length
const tweakerAlignmentMatrixOptions = Array.from({ length: columns }, (_, rowIndex) =>
  tweakerAlignmentOptions
    .slice(rowIndex * columns, rowIndex * columns + columns)
    .map((option, columnIndex) => {
      const AlignmentIcon = alignmentColumnIcons[columnIndex] ?? TextAlignCenter

      return {
        'aria-label': option.label,
        children: (
          <AlignmentIcon aria-hidden="true" className="size-(--tweaker-icon-sm)" strokeWidth={2} />
        ),
        className: cn(
          'relative flex size-(--tweaker-control-height-md) p-(--tweaker-space-1) text-tweaker-muted transition-colors duration-(--tweaker-duration-fast) hover:bg-tweaker-surface-muted hover:text-tweaker-text data-[state=on]:bg-tweaker-accent data-[state=on]:text-tweaker-accent-text',
          columnIndex !== 0 && 'border-l border-tweaker-control',
          rowIndex !== 0 && 'border-t border-tweaker-control',
          alignmentRowClasses[rowIndex],
          alignmentColumnClasses[columnIndex],
        ),
        'data-alignment-index': rowIndex * columns + columnIndex,
        title: option.label,
        value: option.value,
      }
    }),
) satisfies readonly (readonly TweakerMatrix2DOption<TweakerAlignmentValue>[])[]

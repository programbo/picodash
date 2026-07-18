import { TextAlignCenter, TextAlignEnd, TextAlignStart, type LucideIcon } from 'lucide-react'
import type { TweakerInputItemProps } from '../tweaker-control.js'
import { cn } from '../utils.js'
import { TweakerMatrix2D, type TweakerMatrix2DOption } from './matrix-2d.js'

export type TweakerAlignmentValue =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

export interface TweakerAlignmentProps extends Omit<
  TweakerInputItemProps<TweakerAlignmentValue>,
  'children' | 'defaultValue' | 'parse'
> {
  defaultValue?: TweakerAlignmentValue
}

export const tweakerAlignmentOptions = [
  { label: 'Top left', value: 'top-left' },
  { label: 'Top centre', value: 'top-center' },
  { label: 'Top right', value: 'top-right' },
  { label: 'Middle left', value: 'middle-left' },
  { label: 'Centre', value: 'center' },
  { label: 'Middle right', value: 'middle-right' },
  { label: 'Bottom left', value: 'bottom-left' },
  { label: 'Bottom centre', value: 'bottom-center' },
  { label: 'Bottom right', value: 'bottom-right' },
] as const satisfies readonly { label: string; value: TweakerAlignmentValue }[]

export const tweakerAlignmentValues = tweakerAlignmentOptions.map(({ value }) => value)

const alignmentColumnIcons = [
  TextAlignStart,
  TextAlignCenter,
  TextAlignEnd,
] as const satisfies readonly [LucideIcon, LucideIcon, LucideIcon]

const alignmentRowClasses = ['items-start', 'items-center', 'items-end'] as const
const alignmentColumnClasses = ['justify-start', 'justify-center', 'justify-end'] as const

export function TweakerAlignment({
  defaultValue = 'center',
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
  fallback: TweakerAlignmentValue = 'center',
): TweakerAlignmentValue {
  return isTweakerAlignmentValue(value) ? value : fallback
}

const tweakerAlignmentMatrixOptions = Array.from({ length: 3 }, (_, rowIndex) =>
  tweakerAlignmentOptions.slice(rowIndex * 3, rowIndex * 3 + 3).map((option, columnIndex) => {
    const index = rowIndex * 3 + columnIndex
    const AlignmentIcon = alignmentColumnIcons[columnIndex] ?? TextAlignCenter
    const rowClassName = alignmentRowClasses[rowIndex] ?? 'items-center'
    const columnClassName = alignmentColumnClasses[columnIndex] ?? 'justify-center'

    return {
      'aria-label': option.label,
      children: (
        <AlignmentIcon aria-hidden="true" className="size-(--tweaker-icon-sm)" strokeWidth={2} />
      ),
      className: cn(
        'relative flex size-(--tweaker-control-height-md) p-(--tweaker-space-1) text-tweaker-muted transition-colors duration-(--tweaker-duration-fast) hover:bg-tweaker-surface-muted hover:text-tweaker-text data-[state=on]:bg-tweaker-accent data-[state=on]:text-tweaker-accent-text',
        columnIndex !== 0 && 'border-l border-tweaker-control',
        rowIndex !== 0 && 'border-t border-tweaker-control',
        rowClassName,
        columnClassName,
      ),
      'data-alignment-index': index,
      title: option.label,
      value: option.value,
    }
  }),
) satisfies readonly (readonly TweakerMatrix2DOption<TweakerAlignmentValue>[])[]

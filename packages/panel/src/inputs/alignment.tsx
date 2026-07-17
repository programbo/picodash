import { TextAlignCenter, TextAlignEnd, TextAlignStart, type LucideIcon } from 'lucide-react'
import { ToggleGroup } from 'radix-ui'
import type { KeyboardEvent } from 'react'
import { TweakerControl, type TweakerControlProps } from '../tweaker-control.js'
import { cn } from '../utils.js'

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
  TweakerControlProps<TweakerAlignmentValue>,
  'children' | 'defaultValue'
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
  return (
    <TweakerControl<TweakerAlignmentValue> {...controlProps} defaultValue={defaultValue}>
      {(control) => {
        const value = normalizeAlignmentValue(control.value, defaultValue)

        return (
          <ToggleGroup.Root
            id={control.inputId}
            aria-label="Alignment"
            className="border-input bg-muted/35 col-span-2 grid grid-cols-3 justify-self-start overflow-hidden rounded-md border p-0.5 shadow-sm"
            disabled={control.disabled || control.readOnly}
            type="single"
            value={value}
            onValueChange={(nextValue) => {
              if (isTweakerAlignmentValue(nextValue)) control.setValue(nextValue)
            }}
          >
            {tweakerAlignmentOptions.map((option, index) => {
              const AlignmentIcon = alignmentColumnIcons[index % 3] ?? TextAlignCenter
              const rowClassName = alignmentRowClasses[Math.floor(index / 3)] ?? 'items-center'
              const columnClassName =
                alignmentColumnClasses[Math.floor(index % 3)] ?? 'justify-center'

              return (
                <ToggleGroup.Item
                  key={option.value}
                  id={`${control.inputId}:${option.value}`}
                  aria-label={option.label}
                  className={cn(
                    'text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring data-[state=on]:bg-primary data-[state=on]:text-primary-foreground relative flex size-8 p-1 transition-colors outline-none focus-visible:z-10 focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-45',
                    index % 3 !== 0 && 'border-input border-l',
                    index >= 3 && 'border-input border-t',
                    rowClassName,
                    columnClassName,
                  )}
                  data-alignment-index={index}
                  title={option.label}
                  value={option.value}
                  onKeyDown={moveAlignmentFocusVertically}
                >
                  <AlignmentIcon aria-hidden="true" className="size-3.5" strokeWidth={2} />
                </ToggleGroup.Item>
              )
            })}
          </ToggleGroup.Root>
        )
      }}
    </TweakerControl>
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

function moveAlignmentFocusVertically(event: KeyboardEvent<HTMLButtonElement>) {
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return

  const index = Number(event.currentTarget.dataset.alignmentIndex)
  const nextIndex = index + (event.key === 'ArrowUp' ? -3 : 3)
  const root = event.currentTarget.parentElement
  const nextItem = root?.querySelector<HTMLButtonElement>(`[data-alignment-index="${nextIndex}"]`)
  if (!nextItem) return

  event.preventDefault()
  nextItem.focus()
}

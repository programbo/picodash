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
            className="border-tweaker-control shadow-tweaker-sm col-span-2 grid grid-cols-3 justify-self-start overflow-hidden rounded-(--tweaker-alignment-radius) border bg-(--tweaker-alignment-background) p-(--tweaker-space-0-5)"
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
                    'relative flex size-(--tweaker-alignment-item-size) p-(--tweaker-space-1) text-tweaker-muted transition-colors duration-(--tweaker-duration-fast) outline-none hover:bg-tweaker-surface-muted hover:text-tweaker-text focus-visible:z-(--tweaker-layer-raised) focus-visible:ring-2 focus-visible:ring-tweaker-focus data-[state=on]:bg-tweaker-accent data-[state=on]:text-tweaker-accent-text disabled:pointer-events-none disabled:opacity-(--tweaker-opacity-disabled-soft)',
                    index % 3 !== 0 && 'border-l border-tweaker-control',
                    index >= 3 && 'border-t border-tweaker-control',
                    rowClassName,
                    columnClassName,
                  )}
                  data-alignment-index={index}
                  title={option.label}
                  value={option.value}
                  onKeyDown={moveAlignmentFocusVertically}
                >
                  <AlignmentIcon
                    aria-hidden="true"
                    className="size-(--tweaker-icon-sm)"
                    strokeWidth={2}
                  />
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

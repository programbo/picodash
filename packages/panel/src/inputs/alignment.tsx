import { ToggleGroup } from 'radix-ui'
import type { KeyboardEvent } from 'react'
import { TweakerControl, type TweakerControlProps } from '../tweaker-control.js'

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
            className="border-input bg-border col-span-2 grid grid-cols-3 gap-px justify-self-end overflow-hidden rounded-md border p-px shadow-sm"
            disabled={control.disabled || control.readOnly}
            type="single"
            value={value}
            onValueChange={(nextValue) => {
              if (isTweakerAlignmentValue(nextValue)) control.setValue(nextValue)
            }}
          >
            {tweakerAlignmentOptions.map((option, index) => (
              <ToggleGroup.Item
                key={option.value}
                id={`${control.inputId}:${option.value}`}
                aria-label={option.label}
                className="group/alignment bg-background text-muted-foreground hover:bg-accent focus-visible:ring-ring data-[state=on]:bg-primary/20 data-[state=on]:text-primary relative flex size-5 items-center justify-center transition-colors outline-none focus-visible:z-10 focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-45"
                data-alignment-index={index}
                title={option.label}
                value={option.value}
                onKeyDown={moveAlignmentFocusVertically}
              >
                <span
                  aria-hidden="true"
                  className="size-1 rounded-full bg-current transition-transform group-data-[state=on]/alignment:scale-125"
                />
              </ToggleGroup.Item>
            ))}
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

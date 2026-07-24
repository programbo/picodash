import { useMemo } from 'react'
import { PicodashItem, type PicodashInputItemProps } from '../components/panel/PicodashItem.js'
import { Input } from '../components/ui/input.js'
import { Textarea } from '../components/ui/textarea.js'
import type { PicodashParser } from '../validation/picodash-validation.js'
import { canonicalPicodashValue, invalidPicodashValue } from './internal/built-in-validation.js'

export interface PicodashTextProps extends Omit<
  PicodashInputItemProps<string>,
  'children' | 'defaultValue' | 'parse'
> {
  defaultValue?: string
  multiline?: boolean
  placeholder?: string
}

export function PicodashText({
  defaultValue,
  multiline = false,
  placeholder,
  ...controlProps
}: PicodashTextProps) {
  const normalizedDefault = typeof defaultValue === 'string' ? defaultValue : undefined
  const parse = useMemo<PicodashParser<string>>(
    () => (input, context) => {
      if (typeof input === 'string') return { output: { value: input }, success: true }

      const error = 'Text value must be a string.'
      if (context.source === 'import') return invalidPicodashValue(error)
      return normalizedDefault === undefined
        ? { errors: [error], repair: { unset: true }, success: false }
        : canonicalPicodashValue(input, normalizedDefault, error)
    },
    [normalizedDefault],
  )

  return (
    <PicodashItem<string> {...controlProps} defaultValue={normalizedDefault} parse={parse}>
      {(control) => {
        const draftValue = control.fieldState?.draftValue
        const value =
          typeof draftValue === 'string'
            ? draftValue
            : typeof control.value === 'string'
              ? control.value
              : (normalizedDefault ?? '')
        const inputProps = {
          className: 'col-span-2',
          disabled: control.disabled,
          id: control.inputId,
          placeholder,
          readOnly: control.readOnly,
          value,
          onChange: (
            event: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>,
          ) => {
            control.setInput(event.currentTarget.value)
          },
        }

        return picodashTextControlKind(multiline) === 'textarea' ? (
          <Textarea {...inputProps} />
        ) : (
          <Input {...inputProps} type="text" />
        )
      }}
    </PicodashItem>
  )
}

export function picodashTextControlKind(multiline: boolean | undefined): 'input' | 'textarea' {
  return multiline ? 'textarea' : 'input'
}

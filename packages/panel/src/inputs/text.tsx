import { useMemo } from 'react'
import { TweakerItem, type TweakerInputItemProps } from '../tweaker-control.js'
import { Input, Textarea } from '../ui.js'
import type { TweakerParser } from '../tweaker-validation.js'
import { canonicalTweakerValue, invalidTweakerValue } from './built-in-validation.js'

export interface TweakerTextProps extends Omit<
  TweakerInputItemProps<string>,
  'children' | 'defaultValue' | 'parse'
> {
  defaultValue?: string
  minRows?: number
  placeholder?: string
}

export function TweakerText({
  defaultValue,
  minRows,
  placeholder,
  ...controlProps
}: TweakerTextProps) {
  const normalizedDefault = typeof defaultValue === 'string' ? defaultValue : undefined
  const normalizedMinRows = normalizeTextMinRows(minRows)
  const parse = useMemo<TweakerParser<string>>(
    () => (input, context) => {
      if (typeof input === 'string') return { output: { value: input }, success: true }

      const error = 'Text value must be a string.'
      if (context.source === 'import') return invalidTweakerValue(error)
      return normalizedDefault === undefined
        ? { errors: [error], repair: { unset: true }, success: false }
        : canonicalTweakerValue(input, normalizedDefault, error)
    },
    [normalizedDefault],
  )

  return (
    <TweakerItem<string> {...controlProps} defaultValue={normalizedDefault} parse={parse}>
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

        return tweakerTextControlKind(normalizedMinRows) === 'textarea' ? (
          <Textarea {...inputProps} rows={normalizedMinRows} />
        ) : (
          <Input {...inputProps} type="text" />
        )
      }}
    </TweakerItem>
  )
}

export function normalizeTextMinRows(minRows: number | undefined) {
  if (typeof minRows !== 'number' || !Number.isFinite(minRows)) return 1
  return Math.max(1, Math.ceil(minRows))
}

export function tweakerTextControlKind(minRows: number | undefined): 'input' | 'textarea' {
  return normalizeTextMinRows(minRows) > 1 ? 'textarea' : 'input'
}

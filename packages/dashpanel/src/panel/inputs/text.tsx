import { PicodashItem, type PicodashInputItemProps } from '../components/panel/PicodashItem.js'
import { Input } from '../components/ui/input.js'
import { Textarea } from '../components/ui/textarea.js'
import { picodashStringPresentation } from './internal/presentation-contracts.js'

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

  return (
    <PicodashItem<string> {...controlProps} presentation={picodashStringPresentation}>
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

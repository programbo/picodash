import { useTweakerCustomControls } from '../react/context.js'
import type { JsonValue, NormalizedControl } from '../types.js'
import { usePanelEffects } from './panel-effects-context.js'

interface ControlInputProps {
  control: NormalizedControl
  labelId: string
  descriptionId?: string
  onChange: (value: JsonValue) => void
}

export function ControlInput({ control, labelId, descriptionId, onChange }: ControlInputProps) {
  const controls = useTweakerCustomControls()
  const panel = usePanelEffects()
  const definition = controls[control.rendererType]
  const Control = definition?.component

  if (!Control) {
    return <span className="tw-custom-missing">Missing control: {control.rendererType}</span>
  }

  return (
    <Control
      id={control.domId}
      label={control.label}
      labelId={labelId}
      descriptionId={descriptionId}
      value={control.value}
      defaultValue={control.defaultValue}
      setValue={onChange}
      control={control}
      disabled={control.readOnly}
      readOnly={control.readOnly}
      valueMode={control.valueMode}
      layout={control.layout}
      settings={control.settings ?? {}}
      panel={panel}
    />
  )
}

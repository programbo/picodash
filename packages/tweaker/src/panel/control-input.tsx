import { useState } from "react";
import {
  Button,
  Checkbox,
  Input,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  Slider,
  SliderOutput,
  SliderThumb,
  SliderTrack,
  TextField,
} from "react-aria-components";
import { ChevronDown } from "lucide-react";
import { useTweakerCustomControls } from "../react/context.js";
import type { JsonValue, NormalizedControl } from "../types.js";
import { usePanelEffects, usePanelInteraction } from "./panel-effects-context.js";

interface ControlInputProps {
  control: NormalizedControl;
  labelId: string;
  onChange: (value: JsonValue) => void;
}

export function ControlInput({ control, labelId, onChange }: ControlInputProps) {
  const customControls = useTweakerCustomControls();
  const [draft, setDraft] = useState<string | null>(null);
  const panelEffects = usePanelEffects();
  const setSelectOpenActive = usePanelInteraction(`select:${control.persistId}`);

  function commitNumber(value: string) {
    const parsed = Number(value);
    setDraft(null);
    if (Number.isFinite(parsed)) onChange(parsed);
  }

  if (control.kind === "custom") {
    const CustomControl = customControls[control.type];
    if (!CustomControl) {
      return <span className="tw-custom-missing">Missing control: {control.type}</span>;
    }

    return (
      <CustomControl
        id={control.domId}
        label={control.label}
        value={control.value}
        defaultValue={control.defaultValue}
        setValue={onChange}
        control={control}
      />
    );
  }

  if (control.kind === "checkbox") {
    return (
      <Checkbox
        id={control.domId}
        className="tw-checkbox"
        aria-labelledby={labelId}
        isSelected={Boolean(control.value)}
        onChange={(selected) => onChange(selected)}
      />
    );
  }

  if (control.kind === "select") {
    const selectedKey = typeof control.value === "string" ? control.value : "";

    return (
      <Select
        id={control.domId}
        className="tw-select"
        aria-labelledby={labelId}
        selectedKey={selectedKey}
        onOpenChange={setSelectOpenActive}
        onSelectionChange={(key) => onChange(String(key))}
      >
        <Button className="tw-select__button">
          <SelectValue />
          <ChevronDown aria-hidden size={13} />
        </Button>
        <Popover
          className="tw-select__popover"
          style={panelEffects.style}
          data-theme={panelEffects.theme}
        >
          <ListBox className="tw-select__list">
            {(control.options ?? []).map((option) => (
              <ListBoxItem key={option.value} id={option.value} textValue={option.label}>
                {option.label}
              </ListBoxItem>
            ))}
          </ListBox>
        </Popover>
      </Select>
    );
  }

  if (control.kind === "slider") {
    return (
      <Slider
        className="tw-slider"
        aria-label={control.label}
        minValue={control.min}
        maxValue={control.max}
        step={control.step ?? 0.01}
        value={Number(control.value)}
        onChange={(value) => onChange(value)}
      >
        <SliderTrack className="tw-slider__track">
          <SliderThumb id={control.domId} className="tw-slider__thumb" />
        </SliderTrack>
        <SliderOutput className="tw-slider__value">{Number(control.value).toFixed(2)}</SliderOutput>
      </Slider>
    );
  }

  const numberValue = typeof control.value === "number" ? String(control.value) : "";

  return (
    <TextField
      className="tw-number-field"
      aria-labelledby={labelId}
      value={draft ?? numberValue}
      onChange={(value) => setDraft(value)}
    >
      <Input
        id={control.domId}
        className="tw-number"
        inputMode="decimal"
        onBlur={(event) => commitNumber(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commitNumber(event.currentTarget.value);
            event.currentTarget.blur();
          }
        }}
      />
    </TextField>
  );
}

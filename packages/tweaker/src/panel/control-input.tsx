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
import type { NormalizedControl, PrimitiveValue } from "../types.js";
import { usePanelEffects } from "./panel-effects-context.js";

interface ControlInputProps {
  control: NormalizedControl;
  labelId: string;
  onChange: (value: PrimitiveValue) => void;
}

export function ControlInput({ control, labelId, onChange }: ControlInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const panelEffects = usePanelEffects();

  function commitNumber(value: string) {
    const parsed = Number(value);
    setDraft(null);
    if (Number.isFinite(parsed)) onChange(parsed);
  }

  if (control.kind === "checkbox") {
    return (
      <Checkbox
        id={control.id}
        className="tw-checkbox"
        aria-labelledby={labelId}
        isSelected={Boolean(control.value)}
        onChange={(selected) => onChange(selected)}
      />
    );
  }

  if (control.kind === "select") {
    return (
      <Select
        id={control.id}
        className="tw-select"
        aria-labelledby={labelId}
        selectedKey={String(control.value)}
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
          <SliderThumb id={control.id} className="tw-slider__thumb" />
        </SliderTrack>
        <SliderOutput className="tw-slider__value">{Number(control.value).toFixed(2)}</SliderOutput>
      </Slider>
    );
  }

  return (
    <TextField
      className="tw-number-field"
      aria-labelledby={labelId}
      value={draft ?? String(control.value)}
      onChange={(value) => setDraft(value)}
    >
      <Input
        id={control.id}
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

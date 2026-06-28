import { useEffect, useRef } from "react";
import {
  Button,
  Checkbox,
  Group,
  Input,
  ListBox,
  ListBoxItem,
  NumberField,
  Popover,
  Select,
  SelectValue,
  Slider,
  SliderOutput,
  SliderThumb,
  SliderTrack,
} from "react-aria-components";
import { ChevronDown } from "lucide-react";
import { useTweakerCustomControls } from "../react/context.js";
import { clamp, formatDisplayValue, sliderKeyboardIncrement } from "../control.js";
import type { JsonValue, NormalizedControl } from "../types.js";
import { usePanelEffects, usePanelInteraction } from "./panel-effects-context.js";

interface ControlInputProps {
  control: NormalizedControl;
  labelId: string;
  onChange: (value: JsonValue) => void;
}

export function ControlInput({ control, labelId, onChange }: ControlInputProps) {
  const customControls = useTweakerCustomControls();
  const panelEffects = usePanelEffects();
  const setSelectOpenActive = usePanelInteraction(`select:${control.persistId}`);

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
        readOnly={control.readOnly}
      />
    );
  }

  if (control.kind === "display") {
    return (
      <output id={control.domId} className="tw-display" htmlFor={labelId}>
        {formatDisplayValue(control)}
      </output>
    );
  }

  if (control.kind === "checkbox") {
    return (
      <Checkbox
        id={control.domId}
        className="tw-checkbox"
        aria-labelledby={labelId}
        isReadOnly={control.readOnly}
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
    return <SliderInput control={control} onChange={onChange} />;
  }

  const numberValue = typeof control.value === "number" ? control.value : 0;

  return (
    <NumberField
      className="tw-number-field"
      aria-labelledby={labelId}
      isReadOnly={control.readOnly}
      minValue={control.min}
      maxValue={control.max}
      step={control.step}
      formatOptions={control.formatOptions}
      value={numberValue}
      onChange={(value) => {
        if (Number.isFinite(value)) onChange(value);
      }}
    >
      <Group>
        <Input id={control.domId} className="tw-number" inputMode="decimal" />
      </Group>
    </NumberField>
  );
}

interface SliderInputProps {
  control: NormalizedControl;
  onChange: (value: JsonValue) => void;
}

function SliderInput({ control, onChange }: SliderInputProps) {
  const thumbRef = useRef<HTMLDivElement | null>(null);
  // Keep live values in refs so the keydown listener stays stable and doesn't
  // re-attach on every value change (which could drop key-repeat events).
  const valueRef = useRef(control.value);
  const onChangeRef = useRef(onChange);
  valueRef.current = control.value;
  onChangeRef.current = onChange;

  useEffect(() => {
    const thumb = thumbRef.current;
    if (!thumb) return;
    const increments = sliderKeyboardIncrement(control.step);

    function handleKeyDown(event: KeyboardEvent) {
      // ArrowUp/ArrowRight increment, ArrowDown/ArrowLeft decrement. Left/right
      // are mapped to the same magnitudes as up/down so nudging feels consistent
      // regardless of slider orientation. Captured in the capture phase and
      // stopped so React Aria's default step/pageSize arrow handling is skipped.
      const incrementsUp = event.key === "ArrowUp" || event.key === "ArrowRight";
      const decrementsDown = event.key === "ArrowDown" || event.key === "ArrowLeft";
      if (!incrementsUp && !decrementsDown) return;

      const magnitude = event.shiftKey ? increments.shiftStep : increments.step;
      const current = typeof valueRef.current === "number" ? valueRef.current : 0;
      const next = clamp(
        current + (decrementsDown ? -magnitude : magnitude),
        control.min,
        control.max,
      );
      onChangeRef.current(next);
      event.preventDefault();
      event.stopPropagation();
    }

    thumb.addEventListener("keydown", handleKeyDown, true);
    return () => thumb.removeEventListener("keydown", handleKeyDown, true);
  }, [control.step, control.min, control.max]);

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
        <SliderThumb ref={thumbRef} id={control.domId} className="tw-slider__thumb" />
      </SliderTrack>
      <SliderOutput className="tw-slider__value">{Number(control.value).toFixed(2)}</SliderOutput>
    </Slider>
  );
}

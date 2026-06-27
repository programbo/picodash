import { useState } from "react";
import { useTweakerCustomControls } from "../react/context.js";
import type { JsonValue, NormalizedControl } from "../types.js";

interface ControlInputProps {
  control: NormalizedControl;
  onChange: (value: JsonValue) => void;
}

export function ControlInput({ control, onChange }: ControlInputProps) {
  const customControls = useTweakerCustomControls();
  const [draft, setDraft] = useState<string | null>(null);

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
      <input
        id={control.domId}
        className="tw-checkbox"
        type="checkbox"
        checked={Boolean(control.value)}
        onChange={(event) => onChange(event.target.checked)}
      />
    );
  }

  if (control.kind === "select") {
    return (
      <select
        id={control.domId}
        className="tw-select"
        value={typeof control.value === "string" ? control.value : ""}
        onChange={(event) => onChange(event.target.value)}
      >
        {(control.options ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (control.kind === "slider") {
    return (
      <div className="tw-slider">
        <input
          id={control.domId}
          type="range"
          min={control.min}
          max={control.max}
          step={control.step ?? 0.01}
          value={Number(control.value)}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span>{Number(control.value).toFixed(2)}</span>
      </div>
    );
  }

  return (
    <input
      id={control.domId}
      className="tw-number"
      type="text"
      inputMode="decimal"
      value={draft ?? (typeof control.value === "number" ? String(control.value) : "")}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => commitNumber(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          commitNumber(event.currentTarget.value);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

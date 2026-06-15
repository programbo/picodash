import { useState } from "react";
import type { NormalizedControl, PrimitiveValue } from "../types.js";

interface ControlInputProps {
  control: NormalizedControl;
  onChange: (value: PrimitiveValue) => void;
}

export function ControlInput({ control, onChange }: ControlInputProps) {
  const [draft, setDraft] = useState<string | null>(null);

  function commitNumber(value: string) {
    const parsed = Number(value);
    setDraft(null);
    if (Number.isFinite(parsed)) onChange(parsed);
  }

  if (control.kind === "checkbox") {
    return (
      <input
        id={control.id}
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
        id={control.id}
        className="tw-select"
        value={String(control.value)}
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
          id={control.id}
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
      id={control.id}
      className="tw-number"
      type="text"
      inputMode="decimal"
      value={draft ?? String(control.value)}
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

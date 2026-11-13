import type { ReactNode } from 'react'
import {
  RESIZE_TARGETS,
  resizeRecipes,
  type ResizeLabConfiguration,
  type ResizeRecipeId,
} from './resize-lab-model'

export const resizeButtonClass =
  'min-h-11 rounded-md border border-(--picodash-color-control-border) bg-(--picodash-color-surface) px-3 py-2 text-sm text-(--picodash-color-text) hover:bg-(--picodash-color-surface-muted) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--picodash-color-focus) disabled:cursor-not-allowed disabled:opacity-50'
const inputClass =
  'min-h-11 w-full min-w-0 rounded-md border border-(--picodash-color-control-border) bg-(--picodash-color-well) px-3 py-2 text-sm text-(--picodash-color-text) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--picodash-color-focus)'

export function ResizeField({
  label,
  value,
  onChange,
  type = 'text',
  min,
  max,
}: {
  readonly label: string
  readonly value: string | number
  readonly onChange: (value: string) => void
  readonly type?: 'text' | 'number'
  readonly min?: number
  readonly max?: number
}) {
  return (
    <label className="grid min-w-0 gap-1.5 text-sm text-(--picodash-color-text-muted)">
      {label}
      <input
        className={inputClass}
        value={typeof value === 'number' && !Number.isFinite(value) ? '' : value}
        type={type}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

export function ResizeSelect<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  readonly label: string
  readonly value: Value
  readonly options: readonly { readonly value: Value; readonly label: string }[]
  readonly onChange: (value: Value) => void
}) {
  return (
    <label className="grid min-w-0 gap-1.5 text-sm text-(--picodash-color-text-muted)">
      {label}
      <select
        className={inputClass}
        value={value}
        onChange={(event) => {
          const selected = options.find((option) => option.value === event.target.value)
          if (selected) onChange(selected.value)
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function Check({
  label,
  checked,
  onChange,
}: {
  readonly label: string
  readonly checked: boolean
  readonly onChange: (value: boolean) => void
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-(--picodash-color-accent) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--picodash-color-focus)"
      />
      {label}
    </label>
  )
}

function ConfigurationGroup({
  title,
  children,
  open = false,
}: {
  readonly title: string
  readonly children: ReactNode
  readonly open?: boolean
}) {
  return (
    <details
      open={open}
      className="border-t border-(--picodash-color-border) py-3 first:border-t-0"
    >
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--picodash-color-focus)">
        {title}
      </summary>
      <div className="grid gap-3 pt-2">{children}</div>
    </details>
  )
}

const targetLabels = {
  n: 'North edge',
  ne: 'North-east corner',
  e: 'East edge',
  se: 'South-east corner',
  s: 'South edge',
  sw: 'South-west corner',
  w: 'West edge',
  nw: 'North-west corner',
} as const

export interface ResizeLabControlsProps {
  readonly recipe: ResizeRecipeId | 'custom'
  readonly draft: ResizeLabConfiguration
  readonly error: string | null
  readonly onEdit: <Key extends keyof ResizeLabConfiguration>(
    key: Key,
    value: ResizeLabConfiguration[Key],
  ) => void
  readonly onApply: () => void
  readonly onHandleAppearanceChange: (
    appearance: Pick<ResizeLabConfiguration, 'edgeHandles' | 'cornerHandles'>,
  ) => void
  readonly onRecipe: (id: ResizeRecipeId) => void
  readonly onReset: () => void
  readonly onAddItem: (paragraphs: number) => void
  readonly onRemoveItem: () => void
  readonly onSetAllItems: (open: boolean) => void
  readonly onInvalidProbe: () => void
}

export function ResizeLabControls({
  recipe,
  draft,
  error,
  onEdit,
  onApply,
  onHandleAppearanceChange,
  onRecipe,
  onReset,
  onAddItem,
  onRemoveItem,
  onSetAllItems,
  onInvalidProbe,
}: ResizeLabControlsProps) {
  return (
    <section
      aria-label="Resize configuration"
      className="min-w-0 border-b border-(--picodash-color-border) bg-(--picodash-color-surface-muted)/40 p-4 xl:max-h-[calc(100svh-11rem)] xl:overflow-y-auto xl:border-r xl:border-b-0"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-56 flex-1">
          <ResizeSelect<ResizeRecipeId | 'custom'>
            label="Resize recipe"
            value={recipe}
            onChange={(id) => {
              if (id !== 'custom') onRecipe(id)
            }}
            options={[
              { value: 'custom', label: 'Custom configuration' },
              ...Object.entries(resizeRecipes).map(([value, recipe]) => ({
                value: value as ResizeRecipeId,
                label: recipe.label,
              })),
            ]}
          />
        </div>
        <button className={resizeButtonClass} onClick={onReset} type="button">
          Reset resize example
        </button>
      </div>
      <fieldset className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <legend className="mb-3 text-sm font-semibold">Handle appearance</legend>
        <ResizeSelect
          label="Edge handle style"
          value={draft.edgeHandles}
          options={[
            { value: 'single', label: 'Single line' },
            { value: 'parallel', label: 'Parallel lines' },
            { value: 'external-single', label: 'External single line' },
            { value: 'external-parallel', label: 'External parallel lines' },
          ]}
          onChange={(edgeHandles) =>
            onHandleAppearanceChange({ edgeHandles, cornerHandles: draft.cornerHandles })
          }
        />
        <ResizeSelect
          label="Corner handle style"
          value={draft.cornerHandles}
          options={[
            { value: 'single', label: 'Single line' },
            { value: 'external', label: 'External perpendicular lines' },
            { value: 'internal', label: 'Internal asymmetric lines' },
          ]}
          onChange={(cornerHandles) =>
            onHandleAppearanceChange({ edgeHandles: draft.edgeHandles, cornerHandles })
          }
        />
      </fieldset>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onApply()
        }}
        className="mt-4"
      >
        <ConfigurationGroup title="Panel dimensions and input">
          <p className="text-sm text-(--picodash-color-text-muted)">
            Dimensions are outer CSS pixels, px, rem, or %. Leave a bound empty for its default.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-2">
            {(
              [
                ['width', 'Preferred width'],
                ['height', 'Preferred height'],
                ['minWidth', 'Minimum width'],
                ['maxWidth', 'Maximum width'],
                ['minHeight', 'Minimum height'],
                ['maxHeight', 'Maximum height'],
              ] as const
            ).map(([key, label]) => (
              <ResizeField
                key={key}
                label={label}
                value={draft[key]}
                onChange={(value) => onEdit(key, value)}
              />
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Check
              label="Enable resizing"
              checked={draft.enabled}
              onChange={(value) => onEdit('enabled', value)}
            />
            <ResizeSelect
              label="Resize grips"
              value={draft.handles}
              options={[
                { value: 'auto', label: 'On hover or focus' },
                { value: 'always', label: 'Always visible' },
                { value: 'hidden', label: 'Decoration hidden' },
              ]}
              onChange={(value) => onEdit('handles', value)}
            />
            <ResizeSelect
              label="Move handle"
              value={draft.moveHandle}
              options={[
                { value: 'header', label: 'Header' },
                { value: 'grip', label: 'Dedicated grip' },
                { value: 'both', label: 'Header and grip' },
              ]}
              onChange={(value) => onEdit('moveHandle', value)}
            />
            <ResizeSelect
              label="Declared placement"
              value={draft.placement}
              options={[
                { value: 'free', label: 'Free floating' },
                { value: 'snap-top-right', label: 'Snapped top-right' },
                { value: 'snap-top', label: 'Snapped top center' },
                { value: 'dock-top-right', label: 'Docked top-right' },
                { value: 'dock-right', label: 'Full-right dock' },
                { value: 'dock-top', label: 'Full-top dock' },
              ]}
              onChange={(value) => onEdit('placement', value)}
            />
          </div>
          <fieldset>
            <legend className="text-sm text-(--picodash-color-text-muted)">
              Allowed resize targets
            </legend>
            <div className="grid grid-cols-2 gap-x-3 sm:grid-cols-4">
              {RESIZE_TARGETS.map((target) => (
                <Check
                  key={target}
                  label={targetLabels[target]}
                  checked={draft.targets.includes(target)}
                  onChange={(checked) =>
                    onEdit(
                      'targets',
                      checked
                        ? [...draft.targets, target]
                        : draft.targets.filter((candidate) => candidate !== target),
                    )
                  }
                />
              ))}
            </div>
          </fieldset>
        </ConfigurationGroup>
        <ConfigurationGroup title="Boundary and appearance">
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <ResizeSelect
              label="Geometry boundary"
              value={draft.boundary}
              options={[
                { value: 'element', label: 'Visible container' },
                { value: 'viewport', label: 'Visual viewport' },
              ]}
              onChange={(value) => onEdit('boundary', value)}
            />
            <ResizeField
              label="Container width"
              value={draft.boundaryWidth}
              type="number"
              min={100}
              onChange={(value) => onEdit('boundaryWidth', Number(value))}
            />
            <ResizeField
              label="Container height"
              value={draft.boundaryHeight}
              type="number"
              min={100}
              onChange={(value) => onEdit('boundaryHeight', Number(value))}
            />
            <ResizeField
              label="Boundary inset"
              value={draft.boundaryInset}
              type="number"
              min={0}
              onChange={(value) => onEdit('boundaryInset', Number(value))}
            />
            <ResizeSelect
              label="Resize theme"
              value={draft.theme}
              options={[
                { value: 'system', label: 'System' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'ocean', label: 'Ocean' },
              ]}
              onChange={(value) => onEdit('theme', value)}
            />
            <ResizeSelect
              label="Resize density"
              value={draft.density}
              options={[
                { value: 'regular', label: 'Regular' },
                { value: 'compact', label: 'Compact' },
              ]}
              onChange={(value) => onEdit('density', value)}
            />
          </div>
        </ConfigurationGroup>
        <ConfigurationGroup title="Content and accordion">
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <ResizeSelect
              label="Panel content"
              value={draft.content}
              options={[
                { value: 'fixed', label: 'Fixed-size content' },
                { value: 'text', label: 'Wrapping text' },
                { value: 'accordion', label: 'Dynamic accordion' },
                { value: 'list', label: 'DashStack with pinned bands' },
              ]}
              onChange={(value) => onEdit('content', value)}
            />
            <ResizeField
              label="Fixed content width"
              value={draft.fixedWidth}
              type="number"
              min={1}
              onChange={(value) => onEdit('fixedWidth', Number(value))}
            />
            <ResizeField
              label="Fixed content height"
              value={draft.fixedHeight}
              type="number"
              min={1}
              onChange={(value) => onEdit('fixedHeight', Number(value))}
            />
            <ResizeField
              label="Text paragraphs"
              value={draft.textParagraphs}
              type="number"
              min={1}
              max={30}
              onChange={(value) => onEdit('textParagraphs', Number(value))}
            />
            <Check
              label="Animate accordion disclosure"
              checked={draft.transition}
              onChange={(value) => onEdit('transition', value)}
            />
            <ResizeField
              label="Accordion duration (ms)"
              value={draft.transitionDuration}
              type="number"
              min={0}
              max={2000}
              onChange={(value) => onEdit('transitionDuration', Number(value))}
            />
          </div>
          <div aria-label="Accordion content actions" role="group" className="flex flex-wrap gap-2">
            <button
              className={resizeButtonClass}
              type="button"
              disabled={draft.items.length >= 50}
              onClick={() => onAddItem(1)}
            >
              Add short item
            </button>
            <button
              className={resizeButtonClass}
              type="button"
              disabled={draft.items.length >= 50}
              onClick={() => onAddItem(4)}
            >
              Add tall item
            </button>
            <button
              className={resizeButtonClass}
              type="button"
              disabled={draft.items.length === 0}
              onClick={onRemoveItem}
            >
              Remove last item
            </button>
            <button className={resizeButtonClass} type="button" onClick={() => onSetAllItems(true)}>
              Open all items
            </button>
            <button
              className={resizeButtonClass}
              type="button"
              onClick={() => onSetAllItems(false)}
            >
              Close all items
            </button>
          </div>
        </ConfigurationGroup>
        <ConfigurationGroup title="Content constraints and explicit metrics">
          <div className="grid gap-x-3 sm:grid-cols-2 xl:grid-cols-1">
            <Check
              label="Content minimum width"
              checked={draft.contentMinWidth}
              onChange={(value) => onEdit('contentMinWidth', value)}
            />
            <Check
              label="Content maximum width"
              checked={draft.contentMaxWidth}
              onChange={(value) => onEdit('contentMaxWidth', value)}
            />
            <Check
              label="Content minimum height"
              checked={draft.contentMinHeight}
              onChange={(value) => onEdit('contentMinHeight', value)}
            />
            <Check
              label="Content maximum height"
              checked={draft.contentMaxHeight}
              onChange={(value) => onEdit('contentMaxHeight', value)}
            />
          </div>
          <Check
            label="Use explicit content metrics"
            checked={draft.explicitMetrics}
            onChange={(value) => onEdit('explicitMetrics', value)}
          />
          <p className="text-sm text-(--picodash-color-text-muted)">
            Use explicit metrics for canvas or virtual content. Empty fields retain automatic
            measurement.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ['metricMinWidth', 'Content metric minimum width'],
                ['metricMaxWidth', 'Content metric maximum width'],
                ['metricMinHeight', 'Content metric minimum height'],
                ['metricMaxHeight', 'Content metric maximum height'],
              ] as const
            ).map(([key, label]) => (
              <ResizeField
                key={key}
                label={label}
                value={draft[key]}
                onChange={(value) => onEdit(key, value)}
              />
            ))}
          </div>
          <button className={resizeButtonClass} type="button" onClick={onInvalidProbe}>
            Probe invalid configuration
          </button>
        </ConfigurationGroup>
        {error ? (
          <p role="alert" className="my-3 text-sm text-(--picodash-color-danger)">
            {error} The running configuration is unchanged.
          </p>
        ) : null}
        <button className={resizeButtonClass} type="submit">
          Apply configuration
        </button>
      </form>
    </section>
  )
}

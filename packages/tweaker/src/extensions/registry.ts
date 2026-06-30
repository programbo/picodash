import type {
  CustomControl,
  JsonValue,
  TweakerControlComponent,
  TweakerControlDefinition,
  TweakerControlRegistry,
} from '../types.js'

type AnyControlDefinition = TweakerControlDefinition<any, any>

type RegistryInput =
  | AnyControlDefinition
  | TweakerControlRegistry
  | Record<string, TweakerControlComponent<any>>
  | undefined
  | null

function isDefinition(value: unknown): value is AnyControlDefinition {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as AnyControlDefinition).type === 'string' &&
    typeof (value as AnyControlDefinition).component === 'function'
  )
}

function componentDefinition(
  type: string,
  component: TweakerControlComponent<any>,
): AnyControlDefinition {
  return {
    type,
    component,
    valueMode: 'input',
    layout: 'inline',
  }
}

function warnDuplicateType(type: string) {
  const nodeEnv = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
    ?.NODE_ENV
  if (nodeEnv === 'production') return
  console.warn(
    `[tweaker] Duplicate control type "${type}" registered; the later definition will replace the earlier one.`,
  )
}

export function defineTweakerControl<
  TValue extends JsonValue = JsonValue,
  TConfig extends CustomControl<TValue> = CustomControl<TValue>,
>(
  definition: Omit<TweakerControlDefinition<TValue, TConfig>, 'config'>,
): TweakerControlDefinition<TValue, TConfig> & {
  controls: TweakerControlRegistry
  config: (config: Omit<TConfig, 'type'>) => TConfig
} {
  const normalized = {
    valueMode: 'input',
    layout: 'inline',
    ...definition,
    config(config: Omit<TConfig, 'type'>) {
      return { ...config, type: definition.type } as TConfig
    },
  }
  const controlDefinition = normalized as TweakerControlDefinition<TValue, TConfig> & {
    config: (config: Omit<TConfig, 'type'>) => TConfig
  }

  return {
    ...controlDefinition,
    controls: { [definition.type]: controlDefinition as AnyControlDefinition },
  }
}

export function mergeTweakerControls(...inputs: RegistryInput[]): TweakerControlRegistry {
  const registry: TweakerControlRegistry = {}

  for (const input of inputs) {
    if (!input) continue

    if (isDefinition(input)) {
      if (registry[input.type]) warnDuplicateType(input.type)
      registry[input.type] = input
      continue
    }

    for (const [type, value] of Object.entries(input)) {
      if (registry[type]) warnDuplicateType(type)
      registry[type] = isDefinition(value) ? value : componentDefinition(type, value)
    }
  }

  return registry
}

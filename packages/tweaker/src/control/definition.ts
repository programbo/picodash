import type {
  NormalizedControl,
  TweakerControlDefinition,
  TweakerControlRegistry,
} from '../types.js'

export function definitionForControl(
  control: NormalizedControl,
  registry: TweakerControlRegistry | undefined,
): TweakerControlDefinition | undefined {
  return registry?.[control.rendererType] ?? registry?.[control.type]
}

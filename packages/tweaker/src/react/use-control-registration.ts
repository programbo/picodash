import { useEffect } from 'react'
import type {
  RegisterOptions,
  SectionConfig,
  TweakerControlRegistry,
  TweakerSchema,
  TweakerStore,
} from '../types.js'

export function useControlRegistration(
  store: TweakerStore,
  schema: TweakerSchema,
  schemaSignature: string,
  panelId: string,
  section: SectionConfig,
  reorderable: boolean,
  registry: TweakerControlRegistry,
) {
  useEffect(
    () =>
      store.getState().register(schema, {
        panel: panelId,
        section,
        reorderable,
        registry,
      } as RegisterOptions & {
        registry: TweakerControlRegistry
      }),
    [
      store,
      schemaSignature,
      panelId,
      section.id,
      section.label,
      section.hidden,
      reorderable,
      registry,
    ],
  )
}

export function useLegacyPanelEffects(
  store: TweakerStore,
  schema: TweakerSchema,
  schemaSignature: string,
  panelId: string,
  section: SectionConfig,
  opacity: number | undefined,
  hoverOpacity: number | undefined,
  backgroundBlur: number | undefined,
  hoverBackgroundBlur: number | undefined,
) {
  useEffect(
    () =>
      store.getState().updatePanelEffects(schema, {
        panel: panelId,
        section,
        opacity,
        hoverOpacity,
        backgroundBlur,
        hoverBackgroundBlur,
      }),
    [
      store,
      schemaSignature,
      panelId,
      section.id,
      section.label,
      section.hidden,
      opacity,
      hoverOpacity,
      backgroundBlur,
      hoverBackgroundBlur,
    ],
  )
}

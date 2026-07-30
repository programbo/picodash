import type { PicodashProviderStore } from './picodash-provider.js'

interface PicodashPanelTriggerRegistration {
  lastUsed: HTMLButtonElement | null
  triggers: Set<HTMLButtonElement>
}

const triggersByProvider = new WeakMap<
  PicodashProviderStore,
  Map<string, PicodashPanelTriggerRegistration>
>()

export function registerPicodashPanelTrigger(
  providerStore: PicodashProviderStore,
  panelId: string,
  trigger: HTMLButtonElement,
) {
  let providerTriggers = triggersByProvider.get(providerStore)
  if (!providerTriggers) {
    providerTriggers = new Map()
    triggersByProvider.set(providerStore, providerTriggers)
  }
  let registration = providerTriggers.get(panelId)
  if (!registration) {
    registration = { lastUsed: null, triggers: new Set() }
    providerTriggers.set(panelId, registration)
  }
  registration.triggers.add(trigger)

  return () => {
    registration.triggers.delete(trigger)
    if (registration.lastUsed === trigger) registration.lastUsed = null
    if (registration.triggers.size === 0) providerTriggers.delete(panelId)
    if (providerTriggers.size === 0) triggersByProvider.delete(providerStore)
  }
}

export function hasPicodashPanelTrigger(
  providerStore: PicodashProviderStore,
  panelId: string,
): boolean {
  return (triggersByProvider.get(providerStore)?.get(panelId)?.triggers.size ?? 0) > 0
}

export function markPicodashPanelTriggerUsed(
  providerStore: PicodashProviderStore,
  panelId: string,
  trigger: HTMLButtonElement,
) {
  const registration = triggersByProvider.get(providerStore)?.get(panelId)
  if (registration?.triggers.has(trigger)) registration.lastUsed = trigger
}

export function focusPicodashPanelTrigger(
  providerStore: PicodashProviderStore,
  panelId: string,
): boolean {
  const registration = triggersByProvider.get(providerStore)?.get(panelId)
  if (!registration) return false

  const connected = [...registration.triggers].filter((trigger) => trigger.isConnected)
  const trigger =
    registration.lastUsed?.isConnected === true ? registration.lastUsed : connected.at(-1)
  trigger?.focus()
  return trigger !== undefined
}

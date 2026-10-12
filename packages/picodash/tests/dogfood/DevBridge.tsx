import type { PicodashDevBridgeObservationSource } from '@picodash/dev-bridge/browser'
import type { createSettings } from './Controls.js'

/** Keep the application model as the observation authority; construct this source once. */
export async function connectDevelopmentBridge(
  nexus: ReturnType<typeof createSettings>,
  observations: PicodashDevBridgeObservationSource,
  options: {
    readonly development: boolean
    readonly brokerUrl?: string
    readonly signal: AbortSignal
  },
) {
  if (!options.development || !options.brokerUrl)
    return { status: 'disabled' as const, close: async () => {} }
  const { connectPicodashDevBridgeFromBroker } = await import('@picodash/dev-bridge/browser')
  return connectPicodashDevBridgeFromBroker({
    ...options,
    nexus,
    registrationId: 'settings-example',
    label: 'Settings example',
    buildId: 'development',
    disclosure: {
      valueFields: ['enabled'],
      scopeIds: [],
      diagnostics: false,
      observationNames: ['solver', 'solverSettledRevision'],
    },
    permissions: { writableFields: ['enabled'] },
    observations,
  })
}

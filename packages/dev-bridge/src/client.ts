import type {
  PicodashDevBridgeClientCredential,
  PicodashDevBridgeError,
  PicodashDevBridgeCommandResult,
  PicodashDevBridgeSessionDescriptor,
  PicodashDevBridgeSessionRef,
  PicodashDevBridgeSnapshot,
  PicodashDevBridgeSetValuesCommand,
  PicodashDevBridgeWaitCommand,
  PicodashDevBridgeWaitResult,
} from './types.js'
export type PicodashDevBridgeClient = Readonly<{
  listSessions(
    options?: Readonly<{ signal?: AbortSignal }>,
  ): Promise<readonly PicodashDevBridgeSessionDescriptor[]>
  inspect(session: PicodashDevBridgeSessionRef): Promise<
    Readonly<{
      type: 'snapshot'
      session: PicodashDevBridgeSessionDescriptor
      snapshot: PicodashDevBridgeSnapshot
    }>
  >
  setValues(
    session: PicodashDevBridgeSessionRef,
    command: PicodashDevBridgeSetValuesCommand,
  ): Promise<PicodashDevBridgeCommandResult | PicodashDevBridgeError>
  wait(
    session: PicodashDevBridgeSessionRef,
    command: PicodashDevBridgeWaitCommand,
    options?: Readonly<{ signal?: AbortSignal }>,
  ): Promise<PicodashDevBridgeWaitResult | PicodashDevBridgeError>
}>
export function createPicodashDevBridgeClient(
  credential: PicodashDevBridgeClientCredential,
): PicodashDevBridgeClient {
  async function request(path: string, init: RequestInit = {}) {
    const response = await fetch(`${credential.baseUrl}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${credential.token}`,
        'content-type': 'application/json',
        ...(init.headers instanceof Headers
          ? Object.fromEntries(init.headers.entries())
          : Array.isArray(init.headers)
            ? Object.fromEntries(init.headers)
            : (init.headers ?? {})),
      },
    })
    return { response, body: (await response.json()) as unknown }
  }
  const pathFor = (session: PicodashDevBridgeSessionRef, suffix: string) =>
    `/v1/sessions/${encodeURIComponent(session.sessionId)}/generations/${session.generation}/${suffix}`
  return {
    async listSessions(options) {
      const r = await request('/v1/sessions', { signal: options?.signal })
      if (!r.response.ok) throw bridgeError(r.body)
      return (
        r.body as { type: 'sessions'; sessions: readonly PicodashDevBridgeSessionDescriptor[] }
      ).sessions
    },
    async inspect(session) {
      const r = await request(pathFor(session, 'snapshot'))
      if (!r.response.ok) throw bridgeError(r.body)
      return r.body as {
        type: 'snapshot'
        session: PicodashDevBridgeSessionDescriptor
        snapshot: PicodashDevBridgeSnapshot
      }
    },
    async setValues(session, command) {
      const r = await request(pathFor(session, 'commands'), {
        method: 'POST',
        body: JSON.stringify(command),
      })
      return r.body as PicodashDevBridgeCommandResult | PicodashDevBridgeError
    },
    async wait(session, command, options) {
      const r = await request(pathFor(session, 'wait'), {
        method: 'POST',
        body: JSON.stringify(command),
        signal: options?.signal,
      })
      return r.body as PicodashDevBridgeWaitResult | PicodashDevBridgeError
    },
  }
}
function bridgeError(value: unknown): PicodashDevBridgeError {
  if (value && typeof value === 'object' && (value as any).type === 'bridge_error')
    return value as PicodashDevBridgeError
  return {
    type: 'bridge_error',
    error: { code: 'internal_error', message: 'Bridge request failed.' },
  }
}

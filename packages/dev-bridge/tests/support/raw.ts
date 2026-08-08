import WebSocket from 'ws'

export const protocol = 'picodash.dev-bridge.v1'

export type RawFrame = Record<string, any>

export function openSocket(url: string, origin: string) {
  return new WebSocket(url, protocol, { headers: { Origin: origin } })
}

export function frame(socket: WebSocket, value: RawFrame) {
  socket.send(JSON.stringify(value))
}

export function readFrame(socket: WebSocket): Promise<RawFrame> {
  return new Promise((resolve, reject) => {
    const onMessage = (raw: WebSocket.RawData) => {
      cleanup()
      try {
        resolve(
          JSON.parse(
            Buffer.isBuffer(raw)
              ? raw.toString('utf8')
              : Buffer.from(raw as ArrayBuffer).toString('utf8'),
          ) as RawFrame,
        )
      } catch (error) {
        reject(error)
      }
    }
    const onError = (error: Error) => {
      cleanup()
      reject(error)
    }
    const onClose = () => {
      cleanup()
      reject(new Error('socket closed'))
    }
    const cleanup = () => {
      socket.off('message', onMessage)
      socket.off('error', onError)
      socket.off('close', onClose)
    }
    socket.once('message', onMessage)
    socket.once('error', onError)
    socket.once('close', onClose)
  })
}

export async function waitOpen(socket: WebSocket) {
  if (socket.readyState === WebSocket.OPEN) return
  await new Promise<void>((resolve, reject) => {
    socket.once('open', resolve)
    socket.once('error', reject)
  })
}

export async function closeSocket(socket: WebSocket | undefined) {
  if (!socket || socket.readyState === WebSocket.CLOSED) return
  await new Promise<void>((resolve) => {
    socket.once('close', () => resolve())
    socket.close()
  })
}

export function registerFrame(
  token: string,
  registrationId = 'registration',
  browserTabId = 'tab',
  overrides: Record<string, unknown> = {},
): RawFrame {
  return {
    type: 'register',
    protocolVersion: 1,
    token,
    registration: {
      registrationId,
      browserTabId,
      fieldKeys: ['count', 'secret'],
      disclosure: { valueFields: ['count'], scopeIds: [], diagnostics: false },
      permissions: { writableFields: ['count'] },
      ...overrides,
    },
  }
}

export function snapshotFrame(session: RawFrame, sequence: number, snapshot: RawFrame) {
  return {
    type: 'snapshot',
    session: { sessionId: session.sessionId, generation: session.generation, sequence },
    sequence,
    snapshot,
  }
}

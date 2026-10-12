import { expect, it } from 'vite-plus/test'
import { createSettings } from './Controls.js'
import { connectDevelopmentBridge } from './DevBridge.js'
it('installed development recipe is quiet without a broker and while production is disabled', async () => {
  const nexus = createSettings()
  const source = {
    getSnapshot: () => ({
      solver: { status: 'ready', requestRevision: 1 },
      solverSettledRevision: 1,
    }),
    subscribe: () => () => {},
  }
  try {
    for (const options of [
      { development: false, brokerUrl: 'http://127.0.0.1:1/v1/browser-credential' },
      { development: true },
    ]) {
      const connection = await connectDevelopmentBridge(nexus, source, {
        ...options,
        signal: new AbortController().signal,
      })
      expect(connection.status).toBe('disabled')
      await connection.close()
    }
  } finally {
    nexus.destroy()
  }
})

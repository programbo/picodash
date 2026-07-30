import { defineConfig } from '@playwright/test'

const port = 4310

export default defineConfig({
  testDir: '.',
  testMatch: 'creative-controls.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    reducedMotion: 'reduce',
  },
  webServer: {
    command: `bun run dev`,
    port,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NODE_ENV: 'development',
      PORT: String(port),
    },
  },
})

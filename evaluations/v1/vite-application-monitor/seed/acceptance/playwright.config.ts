import { defineConfig } from '@playwright/test'

const port = 4311

export default defineConfig({
  testDir: '.',
  testMatch: 'application-monitor.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    reducedMotion: 'reduce',
  },
  webServer: {
    command: 'bun run dev',
    port,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { PORT: String(port) },
  },
})

import { defineConfig, devices } from '@playwright/test'

const demoPort = process.env.DEMO_PORT ?? '6032'
const demoURL = `http://127.0.0.1:${demoPort}`

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  use: {
    baseURL: demoURL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm --filter demo dev',
    url: demoURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})

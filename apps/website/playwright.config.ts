import { defineConfig, devices } from '@playwright/test'

const websitePort = process.env.WEBSITE_PORT ?? '6030'
const websiteURL = `http://127.0.0.1:${websitePort}`

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  use: {
    baseURL: websiteURL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'bun run --filter website dev',
    url: websiteURL,
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

import { defineConfig, devices } from '@playwright/test'

const websitePort = servicePort('WEBSITE_PORT', '6035')
const websiteURL = `http://127.0.0.1:${websitePort}`
const labPort = servicePort('LAB_PORT', '6034')
const labURL = `http://127.0.0.1:${labPort}`

function servicePort(name: string, fallback: string) {
  const port = process.env[name] ?? fallback
  if (!/^603[0-9]$/.test(port)) {
    throw new Error(`${name} must be an allocated port in the 6030-6039 range`)
  }
  return port
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  use: {
    baseURL: websiteURL,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'bun run --filter @picodash/web dev',
      url: websiteURL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'bun run --filter @picodash/lab dev',
      url: `${labURL}/lab/state`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})

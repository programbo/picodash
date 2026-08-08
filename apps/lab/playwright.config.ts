import { defineConfig, devices } from '@playwright/test'

const labPort = servicePort('LAB_PORT', '6032')
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
  reporter: [['list'], ['./tests/test-budget-reporter.ts']],
  use: {
    baseURL: labURL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `LAB_PORT=${labPort} node scripts/dev.mjs`,
    url: `${labURL}/lab`,
    reuseExistingServer: false,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    timeout: 60_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})

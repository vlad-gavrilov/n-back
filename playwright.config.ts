import { mkdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { defineConfig, devices } from '@playwright/test'
const firefoxHome = resolve('.cache/firefox-home')
const port = 4187
const baseURL = `http://127.0.0.1:${port}`
// Workers inherit this run's ID when they reload the config.
process.env.NBACK_E2E_RUN_ID ??= randomUUID()
if (process.platform === 'darwin') mkdirSync(firefoxHome, { recursive: true })
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: true, retries: process.env.CI ? 1 : 0,
  use: { baseURL, trace: 'retain-on-failure' },
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,
    // Only the Vite process spawned by this test run can announce its bound port.
    wait: { stdout: new RegExp(`Local:\\s+\\S+:${port}/`) },
    reuseExistingServer: false,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], launchOptions: process.platform === 'darwin' ? { env: { ...process.env, CFFIXED_USER_HOME: firefoxHome } } : {} } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})

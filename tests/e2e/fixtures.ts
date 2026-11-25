import { test as base, type Page } from '@playwright/test'

export async function freezeClock(page: Page) {
  const noon = new Date('2026-11-04T12:00:00Z')
  // The clock runs between the two commands, so start an hour before the pause.
  await page.clock.install({ time: noon.getTime() - 60 * 60 * 1000 })
  await page.clock.pauseAt(noon)
}

// Replace the output context so browser tests can exercise the player silently.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      class SilentAudioContext {
        state = 'running'
        destination = {}
        onstatechange: (() => void) | null = null
        constructor() {
          Object.defineProperty(window, '__testAudioContext', { value: this, configurable: true })
        }
        async resume() { this.state = 'running' }
        async suspend() { this.state = 'suspended'; this.onstatechange?.() }
        async close() { this.state = 'closed'; this.onstatechange?.() }
        async decodeAudioData() { return {} }
        createBufferSource() {
          return { buffer: null, onended: null, connect() {}, disconnect() {}, start() {}, stop() {} }
        }
      }
      Object.defineProperty(window, 'AudioContext', { value: SilentAudioContext, configurable: true, writable: true })
      Object.defineProperty(window, 'webkitAudioContext', { value: SilentAudioContext, configurable: true, writable: true })
    })
    await use(page)
  },
})

export { expect, type Page } from '@playwright/test'

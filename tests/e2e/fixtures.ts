import { test as base } from '@playwright/test'

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

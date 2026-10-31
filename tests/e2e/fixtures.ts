import { test as base } from '@playwright/test'

// UI tests never create a real audio context or send sound to the speakers
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
        async decodeAudioData() { return {} }
        createBufferSource() {
          return { buffer: null, onended: null, connect() {}, start() {}, stop() {} }
        }
      }
      Object.defineProperty(window, 'AudioContext', { value: SilentAudioContext, configurable: true, writable: true })
      Object.defineProperty(window, 'webkitAudioContext', { value: SilentAudioContext, configurable: true, writable: true })
    })
    await use(page)
  },
})

export { expect, type Page } from '@playwright/test'

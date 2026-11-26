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
        startedSamples = 0
        onstatechange: (() => void) | null = null
        constructor() {
          Object.defineProperty(window, '__testAudioContext', { value: this, configurable: true })
        }
        async resume() { this.state = 'running' }
        async suspend() { this.state = 'suspended'; this.onstatechange?.() }
        async close() { this.state = 'closed'; this.onstatechange?.() }
        async decodeAudioData() { return { duration: 0.1 } }
        createBufferSource() {
          let timer: number | undefined
          const source = {
            buffer: null as { duration: number } | null,
            onended: null as (() => void) | null,
            connect() {}, disconnect() {},
            start: () => {
              if (!source.buffer) throw new Error('Missing sample')
              this.startedSamples++
              timer = window.setTimeout(() => source.onended?.(), source.buffer.duration * 1000)
            },
            stop() { window.clearTimeout(timer) },
          }
          return source
        }
      }
      Object.defineProperty(window, 'AudioContext', { value: SilentAudioContext, configurable: true, writable: true })
      Object.defineProperty(window, 'webkitAudioContext', { value: SilentAudioContext, configurable: true, writable: true })
    })
    await use(page)
  },
})

export { expect, type Page } from '@playwright/test'

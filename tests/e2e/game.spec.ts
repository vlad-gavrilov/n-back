import { expect, freezeClock, test, type Page } from './fixtures'
import { dictionaries, localeNames, locales, type Locale } from '../../src/i18n'
async function selectLocale(page: Page, locale: Locale) {
  await expect(page.locator('.topbar')).toBeVisible()
  const useSettings = !await page.locator('.topbar .language-switch').isVisible()
  if (useSettings) await page.locator('.mobile-settings').click()
  await page.getByRole('button', { name: localeNames[locale], exact: true }).click()
  if (useSettings) await page.getByRole('dialog').locator('.icon-button').click()
}
test('tutorial, theme persistence and a complete visual round', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button', { name: 'How to play' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Ready to begin' }).click()
  const themeButton = page.getByRole('button', { name: /Switch to .* theme/ })
  const name = await themeButton.getAttribute('aria-label')
  await themeButton.click()
  await page.reload()
  await expect(themeButton).not.toHaveAttribute('aria-label', name!)
  await page.getByRole('button', { name: 'Begin session' }).click()
  await page.clock.runFor(3000)
  await expect(page.getByText(/Warm-up 1/)).toBeVisible()
  await page.clock.runFor(6000)
  await expect(page.getByText('Trial 1 of 20', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Position/ }).click()
  await page.clock.runFor(60000)
  await expect(page.getByRole('heading', { name: 'Round complete' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Continue at/ })).toBeVisible()
  const nextButton = page.getByRole('button', { name: /Continue at/ })
  const nextN = Number((await nextButton.innerText()).match(/(\d)-back/)![1])
  await nextButton.click()
  await expect(page.getByLabel(/^Game controls/)).toBeFocused()
  await page.clock.runFor(3000 + nextN * 3000)
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: /Position/ })).toContainText(/Correct|False alarm/)
  await page.getByRole('button', { name: 'Stop round' }).click()
  await expect(page.getByText('This round was not scored.')).toBeVisible()
})
test('a two-second stimulus interval paces the whole round', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  const decrease = page.getByRole('button', { name: 'Decrease interval' })
  await decrease.click(); await decrease.click()
  await expect(decrease).toBeDisabled()
  await expect(page.getByText('20 trials at 1 s each.')).toBeVisible()
  await page.getByRole('button', { name: 'Increase interval' }).click()
  await expect(page.getByText('20 trials at 2 s each.')).toBeVisible()
  await page.getByRole('button', { name: 'Begin session' }).click()
  await page.clock.runFor(3000)
  await expect(page.getByText(/Warm-up 1/)).toBeVisible()
  await page.clock.runFor(2 * 2000)
  await expect(page.getByText('Trial 1 of 20', { exact: true })).toBeVisible()
  await page.clock.runFor(20 * 2000 + 1000)
  await expect(page.getByRole('heading', { name: 'Round complete' })).toBeVisible()
})

test('turning off live feedback confirms a Dual response neutrally and credits the hit', async ({ page }) => {
  await freezeClock(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Dual', exact: true }).click()
  await page.getByRole('checkbox', { name: /Live feedback/ }).uncheck()
  await page.getByRole('button', { name: 'Begin session' }).click()
  await expect(page.getByRole('heading', { name: 'Get ready' })).toBeVisible()
  const positions: number[] = []
  let answered = false
  const positionButton = page.getByRole('button', { name: /^Position/ })
  for (let trial = 0; trial < 22; trial++) {
    await page.clock.runFor(3000)
    const position = await page.locator('.field-cell.lit').evaluate(cell =>
      Array.from(cell.parentElement!.children).indexOf(cell),
    )
    if (!answered && position === positions[trial - 2]) {
      await page.keyboard.press('f')
      await expect(positionButton.locator('small')).toHaveText('Registered')
      await expect(positionButton.locator('small')).toBeVisible()
      await expect(positionButton).toHaveClass(/\bregistered\b/)
      answered = true
    }
    positions.push(position)
  }
  expect(answered).toBe(true)
  await page.clock.runFor(3000)
  const stats = page.locator('.channel-stats').filter({ has: page.getByRole('heading', { name: 'Position' }) })
  await expect(stats.getByText('Hits', { exact: true }).locator('+ dd')).toHaveText('1')
  await expect(stats.getByText('False alarms', { exact: true }).locator('+ dd')).toHaveText('0')
})
test('dual sound failure is explicit and visual mode remains available', async ({ page }) => {
  await page.route('**/audio/*.wav*', route => route.abort())
  await page.goto('/')
  await page.getByRole('button', { name: 'Dual', exact: true }).click()
  await page.getByRole('button', { name: 'Begin session' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await page.getByRole('button', { name: 'Use visual mode' }).click()
  await expect(page.getByRole('button', { name: 'Visual', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('the Dual sound test decodes all eight bundled recordings in the browser', async ({ page }) => {
  await page.goto('/')
  const durations = await page.evaluateHandle(() => {
    const clips: number[] = []
    const decoder = new OfflineAudioContext(1, 1, 22050)
    AudioContext.prototype.decodeAudioData = async data => {
      const buffer = await decoder.decodeAudioData(data)
      clips.push(buffer.duration)
      return buffer
    }
    return clips
  })
  await page.getByRole('button', { name: 'Dual', exact: true }).click()
  await page.getByRole('button', { name: 'Test sound', exact: true }).click()
  await expect(page.getByText('Test sound played.', { exact: true })).toBeVisible()
  const decoded = await durations.jsonValue()
  expect(decoded).toHaveLength(8)
  expect(Math.min(...decoded)).toBeGreaterThan(0)
})

for (const locale of locales) for (const width of [320, 430, 744, 756, 1024, 1440]) test(`layout at ${width}px in both themes (${locale})`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 430 ? 932 : 850 })
  await page.goto('/')
  if (locale !== 'en') await selectLocale(page, locale)
  for (let theme = 0; theme < 2; theme++) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(page.getByRole('button', { name: dictionaries[locale].begin })).toBeInViewport()
    const field = (await page.locator('.field').boundingBox())!
    const heading = (await page.locator('.training-heading').boundingBox())!
    expect(heading.x).toBeCloseTo(field.x, 0)
    expect(heading.width).toBeCloseTo(field.width, 0)
    await page.locator('.theme-toggle').click()
  }
})

for (const locale of locales) {
  for (const [width, height] of [[1716, 1026], [1440, 900], [1366, 768]]) {
    test(`desktop start screen fits at ${width}×${height} (${locale})`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await page.addInitScript(value => localStorage.setItem('nback-locale', value), locale)
      await page.goto('/')

      const start = page.getByRole('button', { name: dictionaries[locale].begin, exact: true })
      await start.waitFor()
      const pageHeight = await page.evaluate(async () => {
        await document.fonts.ready
        return document.documentElement.scrollHeight
      })

      expect(pageHeight).toBeLessThanOrEqual(height)
      await expect(start).toBeInViewport({ ratio: 1 })
      await expect(page.getByRole('contentinfo')).toBeInViewport({ ratio: 1 })
      const heading = (await page.locator('.training-heading').boundingBox())!
      const field = (await page.locator('.field').boundingBox())!
      expect(field.width).toBeGreaterThanOrEqual(Math.floor(Math.min(640, height * .64) * .92))
      expect(field.width).toBeLessThanOrEqual(640)
      expect(heading.x).toBeCloseTo(field.x, 0)
      expect(heading.width).toBeCloseTo(field.width, 0)
      expect((await start.boundingBox())!.x).toBeCloseTo(field.x, 0)
      expect(field.height).toBeCloseTo(field.width, 1)
    })
  }
}

test('stop cancels the round and restart starts with a fresh countdown', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Begin session' }).click()
  await page.getByRole('button', { name: 'Stop round' }).click()
  await expect(page.getByText('This round was not scored.')).toBeVisible()
  await page.getByRole('button', { name: 'Start fresh' }).click()
  await expect(page.getByRole('heading', { name: 'Get ready' })).toBeVisible()
})
test('dual mode accepts both touch channels and ends cleanly on audio interruption', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button', { name: 'Dual', exact: true }).click()
  await page.getByRole('button', { name: 'Begin session' }).click()
  await expect(page.getByRole('heading', { name: 'Get ready' })).toBeVisible()
  await page.clock.runFor(9000)
  for (const [name, pointerId] of [['Position', 1], ['Audio', 2]] as const) {
    await page.getByRole('button', { name: new RegExp(`^${name}`) }).dispatchEvent('pointerdown', { pointerType: 'touch', pointerId, button: 0 })
  }
  for (const name of ['Position', 'Audio']) await expect(page.getByRole('button', { name: new RegExp(`^${name}`) })).toContainText(/Correct|False alarm/)
  await page.evaluate(async () => { await (window as unknown as { __testAudioContext: AudioContext }).__testAudioContext.suspend() })
  await expect(page.getByText('This round was not scored.')).toBeVisible()
})
for (const reason of ['visibility', 'orientation']) test(`${reason} interrupts without a score`, async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Begin session' }).click()
  if (reason === 'orientation') {
    await page.evaluate(() => window.dispatchEvent(new Event('orientationchange')))
    await expect(page.getByRole('heading', { name: 'Get ready' })).toBeVisible()
  }
  await page.evaluate(reason => {
    if (reason === 'visibility') { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')) }
    else screen.orientation.dispatchEvent(new Event('change'))
  }, reason)
  await expect(page.getByText('This round was not scored.')).toBeVisible()
  await expect(page.getByText('Session score', { exact: true })).toHaveCount(0)
})
test('legacy mobile rotation interrupts the round when screen.orientation is unavailable', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(screen, 'orientation', { value: undefined, configurable: true }))
  await page.goto('/')
  await page.getByRole('button', { name: 'Begin session' }).click()
  await page.evaluate(() => window.dispatchEvent(new Event('resize')))
  await expect(page.getByRole('heading', { name: 'Get ready' })).toBeVisible()
  await page.evaluate(() => window.dispatchEvent(new Event('orientationchange')))
  await expect(page.getByText('The screen orientation changed. Start a fresh round in this layout.')).toBeVisible()
  await expect(page.getByText('This round was not scored.')).toBeVisible()
})

for (const locale of locales) for (const [width, height] of [[1200, 683], [932, 430], [1133, 744]]) test(`short and landscape layout ${width}×${height} (${locale})`, async ({ page }) => {
  await page.setViewportSize({ width, height }); await page.goto('/')
  if (locale !== 'en') await selectLocale(page, locale)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expect(page.getByRole('button', { name: dictionaries[locale].begin })).toBeInViewport({ ratio: 1 })
  const title = (await page.locator('.training-heading h1').boundingBox())!
  expect(title.x).toBeCloseTo((await page.locator('.field').boundingBox())!.x, 0)
})

import { expect, test, type Page } from '@playwright/test'
import { dictionaries, localeNames, locales } from '../../src/i18n'

async function dualSettings(page: Page) {
  await page.setViewportSize({ width: 430, height: 932 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Session settings' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Dual', exact: true }).click()
  return page.getByRole('dialog')
}

test('sound test error and retry stay inside mobile settings', async ({ page }) => {
  await page.route('**/audio/*.wav*', route => route.fulfill({ status: 503, body: 'Unavailable' }))
  const dialog = await dualSettings(page)
  await dialog.getByRole('button', { name: 'Test sound', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Sounds could not be loaded')
  await expect(page.getByRole('alert')).toHaveCount(1)
  await page.unrouteAll()
  await dialog.getByRole('button', { name: 'Test sound', exact: true }).click()
  await expect(dialog.getByRole('status').filter({ hasText: /Preparing test sound|Test sound played/ })).toContainText('Test sound played')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Get ready', exact: true })).toHaveCount(0)
})

test('pending sound test moves to main screen when settings close', async ({ page }) => {
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  await page.route('**/audio/*.wav*', async route => { await pending; await route.continue() })
  try {
    const dialog = await dualSettings(page)
    await dialog.getByRole('button', { name: 'Test sound', exact: true }).click()
    await expect(dialog.getByRole('status').filter({ hasText: /Preparing test sound|Test sound played/ })).toContainText('Preparing test sound')
    await expect(dialog.getByRole('button', { name: 'Русский', exact: true })).toBeDisabled()
    await dialog.getByRole('button', { name: 'Close dialog' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
    await expect(page.getByRole('status').filter({ hasText: /Preparing test sound|Test sound played/ })).toContainText('Preparing test sound')
    release()
    await expect(page.getByRole('status').filter({ hasText: /Preparing test sound|Test sound played/ })).toContainText('Test sound played')
    await expect(page.getByRole('button', { name: 'Begin session', exact: true })).toBeEnabled()
    await expect(page.getByRole('heading', { name: 'Get ready', exact: true })).toHaveCount(0)
  } finally { release() }
})

test('sound test timeout is visible, translates and offers visual mode', async ({ page }) => {
  await page.clock.install()
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  await page.route('**/audio/*.wav*', async route => { await pending; await route.abort() })
  try {
    const dialog = await dualSettings(page)
    await dialog.getByRole('button', { name: 'Test sound', exact: true }).click()
    await expect(dialog.getByRole('status').filter({ hasText: /Preparing test sound|Test sound played/ })).toContainText('Preparing test sound')
    await page.clock.runFor(8001)
    await expect(dialog.getByRole('alert')).toContainText('Sound loading timed out')
    await dialog.getByRole('button', { name: 'Русский', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('Истекло время подготовки звука')
    await dialog.getByRole('button', { name: 'Выбрать визуальный режим' }).click()
    await expect(dialog.getByRole('button', { name: 'Визуальный', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(dialog.getByRole('alert')).toHaveCount(0)
  } finally { release() }
})

test('A/V work after Tab onto either response button', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button', { name: 'Dual', exact: true }).click()
  await page.getByRole('button', { name: 'Begin session', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Get ready', exact: true })).toBeVisible()
  await page.clock.runFor(9000)
  const position = page.getByRole('button', { name: /^Position/ })
  const audio = page.getByRole('button', { name: /^Audio/ })
  await page.keyboard.press('Tab')
  await expect(position).toBeFocused()
  for (const key of ['v', 'a']) await page.keyboard.press(key)
  for (const button of [position, audio]) await expect(button).toContainText(/Correct|False alarm/)
  await page.clock.runFor(3000)
  await page.keyboard.press('Tab')
  await expect(audio).toBeFocused()
  for (const key of ['v', 'a']) await page.keyboard.press(key)
  for (const button of [position, audio]) await expect(button).toContainText(/Correct|False alarm/)
})

test('native response keys act once and held Enter does not answer later trials', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button', { name: 'Begin session', exact: true }).click()
  await page.clock.runFor(9000)
  const position = page.getByRole('button', { name: /^Position/ })
  await page.keyboard.press('Tab')
  await expect(position).toBeFocused()
  await page.keyboard.down('Enter')
  await expect(position).toContainText(/Correct|False alarm/)
  await page.clock.runFor(3000)
  await page.keyboard.down('Enter')
  await expect(position.locator('small')).toHaveText('Match')
  await page.keyboard.up('Enter')
  await page.keyboard.press('Space')
  await expect(position).toContainText(/Correct|False alarm/)
  await page.clock.runFor(3000)
  await page.keyboard.press('Control+Space')
  await expect(position.locator('small')).toHaveText('Match')
  await page.keyboard.press('Enter')
  await expect(position).toContainText(/Correct|False alarm/)
})

for (const mobile of [false, true]) test(`adjust settings preserves results until a real change (mobile=${mobile})`, async ({ page }) => {
  await page.clock.install()
  await page.setViewportSize({ width: mobile ? 430 : 1440, height: mobile ? 932 : 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Begin session', exact: true }).click()
  await page.clock.runFor(69000)
  const score = page.locator('.score-banner strong')
  const result = await score.textContent()
  await page.getByRole('button', { name: 'Adjust session', exact: true }).click()
  const settings = page.getByRole('dialog')
  await expect(settings).toBeVisible()
  await settings.getByRole('button', { name: 'Visual', exact: true }).click()
  await settings.getByRole('button', { name: 'Close dialog' }).click()
  await expect(score).toHaveText(result!)
  await page.getByRole('button', { name: /Switch to .* theme/ }).click()
  await expect(score).toHaveText(result!)
  await page.getByRole('button', { name: 'Adjust session', exact: true }).click()
  await settings.getByRole('button', { name: 'Русский', exact: true }).click()
  await settings.getByRole('button', { name: 'Закрыть окно' }).click()
  await expect(score).toHaveText(result!)
  await page.getByRole('button', { name: 'Изменить настройки', exact: true }).click()
  await settings.getByRole('button', { name: 'Увеличить N' }).click()
  await settings.getByRole('button', { name: 'Закрыть окно' }).click()
  await expect(page.locator('.results')).toHaveCount(0)
})

for (const [width, height] of [[320,850],[430,700],[430,932],[568,320],[932,430],[744,1133],[1133,744],[1440,900]]) test(`interruption card layout and focus at ${width}×${height} in both languages/themes`, async ({ page }) => {
  await page.setViewportSize({ width, height })
  await page.goto('/')
  for (const locale of locales) {
    const t = dictionaries[locale]
    if (locale !== 'en') {
      const mobile = await page.locator('.mobile-settings').isVisible()
      if (mobile) await page.locator('.mobile-settings').click()
      await page.getByRole('button', { name: localeNames[locale], exact: true }).click()
      if (mobile) await page.getByRole('dialog').locator('.icon-button').click()
    }
    for (let theme = 0; theme < 2; theme++) {
      const begin = page.getByRole('button', { name: t.begin, exact: true }).or(page.getByRole('button', { name: t.startFresh, exact: true }))
      await begin.click()
      await page.evaluate(() => screen.orientation.dispatchEvent(new Event('change')))
      const card = page.locator('.interruption-card')
      await expect(card).toBeVisible()
      await expect(card.getByRole('heading')).toBeFocused()
      await expect(page.locator('.field, .answer-button')).toHaveCount(0)
      await expect(card.getByRole('button')).toHaveCount(1)
      const layout = await page.evaluate(() => {
        const card = document.querySelector('.interruption-card')!.getBoundingClientRect()
        return { headingBottom: document.querySelector('.training-heading')!.getBoundingClientRect().bottom, cardTop: card.top, cardBottom: card.bottom, footerTop: document.querySelector('footer')!.getBoundingClientRect().top, overflow: document.documentElement.scrollWidth > innerWidth }
      })
      expect(layout.overflow).toBe(false)
      expect(layout.cardTop).toBeGreaterThanOrEqual(layout.headingBottom)
      expect(layout.footerTop).toBeGreaterThanOrEqual(layout.cardBottom)
      await page.locator('.theme-toggle').click()
    }
  }
  await page.getByRole('button', { name: dictionaries.ru.startFresh, exact: true }).click()
  await expect(page.locator('.game-region')).toBeFocused()
})

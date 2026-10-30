import { expect, test, type Page } from '@playwright/test'

async function startDual(page: Page) {
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button', { name: 'Dual', exact: true }).click()
  await page.getByRole('button', { name: 'Begin session', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Get ready', exact: true })).toBeVisible()
  await page.clock.runFor(9000)
}

async function expectBothAnswers(page: Page) {
  for (const label of ['Position', 'Audio']) await expect(page.getByRole('button', { name: new RegExp(`^${label}`) })).toContainText(/Correct|False alarm/)
}

async function dispatchKeys(page: Page, keys: Array<{ key: string; code: string; repeat?: boolean; isComposing?: boolean; ctrlKey?: boolean }>) {
  return page.evaluate(keys => keys.map(key => document.dispatchEvent(new KeyboardEvent('keydown', { ...key, bubbles: true, cancelable: true }))), keys)
}

test('A/V work on the page background, theme button and heading', async ({ page }) => {
  await startDual(page)
  for (const target of ['body', '.theme-toggle', '.training-heading h1']) {
    if (target === 'body') await page.evaluate(() => { (document.activeElement as HTMLElement)?.blur() })
    else await page.locator(target).focus()
    await page.keyboard.press('a'); await page.keyboard.press('v')
    await expectBothAnswers(page)
    await page.clock.runFor(3000)
  }
})

test('Russian characters use physical A/V and incomplete codes have a fallback', async ({ page }) => {
  await startDual(page)
  await page.locator('.theme-toggle').focus()
  for (const code of ['physical', '', 'Unidentified']) {
    const prevented = await dispatchKeys(page, [{ key: 'ф', code: code === 'physical' ? 'KeyA' : code }, { key: 'м', code: code === 'physical' ? 'KeyV' : code }])
    expect(prevented).toEqual([false, false])
    await expectBothAnswers(page)
    await page.clock.runFor(3000)
  }
  await dispatchKeys(page, [{ key: 'а', code: 'KeyF' }])
  for (const button of await page.locator('.answer-button small').all()) await expect(button).toHaveText('Match')
})

test('global responses ignore editing, composition, modifiers, repeats and consumed events', async ({ page }) => {
  await startDual(page)
  await page.evaluate(() => {
    const input = document.createElement('input'); input.setAttribute('aria-label', 'Keyboard test input'); document.querySelector('main')!.append(input); input.focus()
  })
  await page.keyboard.press('a'); await page.keyboard.press('v')
  await page.evaluate(() => {
    const editor = document.createElement('div'); editor.contentEditable = 'true'; editor.setAttribute('role', 'textbox'); document.querySelector('main')!.append(editor); editor.focus()
  })
  await page.keyboard.press('a'); await page.keyboard.press('v')
  await page.locator('.theme-toggle').focus()
  await dispatchKeys(page, [{ key: 'ф', code: 'KeyA', isComposing: true }, { key: 'м', code: 'KeyV', ctrlKey: true }, { key: 'a', code: 'KeyA', repeat: true }])
  await page.evaluate(() => { const event = new KeyboardEvent('keydown', { key: 'v', code: 'KeyV', bubbles: true, cancelable: true }); event.preventDefault(); document.dispatchEvent(event) })
  for (const button of await page.locator('.answer-button small').all()) await expect(button).toHaveText('Match')
  await page.keyboard.press('a'); await page.keyboard.press('v')
  await expectBothAnswers(page)
})

test('global Space answers on background but retains button actions', async ({ page }) => {
  await page.clock.install(); await page.goto('/')
  await page.getByRole('button', { name: 'Begin session', exact: true }).click()
  await page.clock.runFor(9000)
  await page.getByRole('heading', { level: 1 }).focus()
  const result = await page.evaluate(() => ({ cancelled: !document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true })), scroll: scrollY }))
  expect(result.cancelled).toBe(true)
  await expect(page.getByRole('button', { name: /^Position/ })).toContainText(/Correct|False alarm/)
  await page.clock.runFor(3000)
  const theme = await page.locator('html').getAttribute('data-theme')
  await page.locator('.theme-toggle').focus(); await page.keyboard.press('Space')
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', theme!)
  await expect(page.locator('.answer-button small')).toHaveText('Match')
  await page.getByRole('button', { name: 'Stop round' }).focus(); await page.keyboard.press('Enter')
  await expect(page.locator('.interruption-card')).toBeVisible()
})

test('subscriptions follow the active phase and mode across a restart', async ({ page }) => {
  await page.clock.install(); await page.goto('/')
  const audioKey = [{ key: 'ф', code: 'KeyA' }]
  expect(await dispatchKeys(page, audioKey)).toEqual([true])
  await page.getByRole('button', { name: 'How to play' }).click()
  expect(await dispatchKeys(page, audioKey)).toEqual([true])
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await page.getByRole('button', { name: 'Dual', exact: true }).click()
  await page.getByRole('button', { name: 'Begin session', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Get ready', exact: true })).toBeVisible()
  expect(await dispatchKeys(page, audioKey)).toEqual([true])
  await page.clock.runFor(3000)
  expect(await dispatchKeys(page, audioKey)).toEqual([true])
  await page.clock.runFor(6000)
  expect(await dispatchKeys(page, audioKey)).toEqual([false])
  await page.getByRole('button', { name: 'Stop round' }).click()
  expect(await dispatchKeys(page, audioKey)).toEqual([true])
  await page.getByRole('button', { name: 'Visual', exact: true }).click()
  await page.getByRole('button', { name: 'Begin session', exact: true }).click()
  await page.clock.runFor(9000)
  expect(await dispatchKeys(page, audioKey)).toEqual([true])
  expect(await dispatchKeys(page, [{ key: ' ', code: 'Space' }])).toEqual([false])
  await page.clock.runFor(60000)
  await expect(page.getByRole('heading', { name: 'Round complete', exact: true })).toBeVisible()
  expect(await dispatchKeys(page, [{ key: ' ', code: 'Space' }])).toEqual([true])
})

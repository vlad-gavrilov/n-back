import { expect, test } from './fixtures'

test.use({ hasTouch: true, viewport: { width: 360, height: 800 } })

test('touch dialogs return focus quietly and keyboard restores the indicator', async ({ page }) => {
  await page.goto('/')
  const help = page.getByRole('button', { name: 'How to play', exact: true })
  await help.tap()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { level: 2 })).toBeFocused()
  expect(await dialog.getByRole('heading', { level: 2 }).evaluate(el => getComputedStyle(el).outlineStyle)).toBe('none')
  await page.keyboard.press('Tab')
  const english = dialog.getByRole('button', { name: 'English', exact: true })
  await expect(english).toBeFocused()
  expect(await english.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid')
  await dialog.getByRole('button', { name: 'Close dialog' }).tap()
  await expect(help).toBeFocused()
  expect(await help.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('none')
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)).toBe('solid')
})

test('touching the field and starting a round leave no container outline', async ({ page }) => {
  await page.goto('/')
  const board = page.locator('.game-region')
  await page.locator('.field').tap()
  expect(await board.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('none')
  await page.getByRole('button', { name: 'Begin session', exact: true }).tap()
  await expect(board).toBeFocused()
  expect(await board.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('none')
})

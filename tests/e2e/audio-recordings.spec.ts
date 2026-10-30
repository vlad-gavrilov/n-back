import { expect, test } from '@playwright/test'

test('versioned letter recordings decode and complete a Dual round', async ({ page }) => {
  const loaded: string[] = []
  page.on('response', response => {
    const url = new URL(response.url())
    if (/\/audio\/[BFHJMQRW]\.wav$/.test(url.pathname) && response.ok()) loaded.push(url.pathname + url.search)
  })
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button', { name: 'Dual', exact: true }).click()
  await page.getByRole('button', { name: 'Begin session', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Get ready', exact: true })).toBeVisible()
  expect(loaded.sort()).toEqual(['B','F','H','J','M','Q','R','W'].map(letter => `/audio/${letter}.wav?v=letters-v2`))
  await page.clock.runFor(9000)
  await page.locator('.theme-toggle').focus()
  await page.keyboard.press('a'); await page.keyboard.press('v')
  for (const label of ['Audio', 'Position']) await expect(page.getByRole('button', { name: new RegExp(`^${label}`) })).toContainText(/Correct|False alarm/)
  await page.clock.runFor(60000)
  await expect(page.getByRole('heading', { name: 'Round complete', exact: true })).toBeVisible()
  await expect(page.locator('.results .channel-stats')).toHaveCount(2)
  for (const label of ['Audio', 'Position']) await expect(page.locator('.results').getByRole('heading', { name: label, exact: true })).toBeVisible()
})

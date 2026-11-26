import { expect, test } from './fixtures'

test('uses the system theme on each visit until a manual choice is saved', async ({ page }) => {
  const root = page.locator('html')
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await expect(root).toHaveAttribute('data-theme', 'dark')
  expect(await page.evaluate(() => localStorage.getItem('nback-theme'))).toBeNull()

  await page.emulateMedia({ colorScheme: 'light' })
  await page.reload()
  await expect(root).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: 'Switch to dark theme' }).click()
  await expect(root).toHaveAttribute('data-theme', 'dark')
  expect(await page.evaluate(() => localStorage.getItem('nback-theme'))).toBe('dark')
  await page.reload()
  await expect(root).toHaveAttribute('data-theme', 'dark')
})

for (const saved of ['dark', 'light'] as const) {
  test(`honors a previously saved ${saved} theme`, async ({ page }) => {
    await page.addInitScript(value => localStorage.setItem('nback-theme', value), saved)
    await page.emulateMedia({ colorScheme: saved === 'dark' ? 'light' : 'dark' })
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-theme', saved)
  })
}

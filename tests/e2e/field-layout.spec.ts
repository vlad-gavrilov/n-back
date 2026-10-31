import { expect, test, type Page } from './fixtures'

async function fieldGeometry(page: Page) {
  return page.locator('.field').evaluate(field => {
    const box = field.getBoundingClientRect()
    return {
      width: box.width, height: box.height,
      cells: [...field.querySelectorAll('.field-cell')].map(cell => {
        const rect = cell.getBoundingClientRect(), dot = cell.querySelector('span')!.getBoundingClientRect()
        return { x: rect.x - box.x, y: rect.y - box.y, width: rect.width, height: rect.height, centerX: dot.x + dot.width / 2 - box.x, centerY: dot.y + dot.height / 2 - box.y }
      }),
    }
  })
}

function expectStableGeometry(actual: Awaited<ReturnType<typeof fieldGeometry>>, expected: Awaited<ReturnType<typeof fieldGeometry>>) {
  expect(Math.abs(actual.width - expected.width)).toBeLessThanOrEqual(0.1)
  expect(Math.abs(actual.height - expected.height)).toBeLessThanOrEqual(0.1)
  expect(actual.cells).toHaveLength(expected.cells.length)
  for (let index = 0; index < actual.cells.length; index++) {
    for (const key of ['x', 'y', 'width', 'height', 'centerX', 'centerY'] as const) {
      expect(Math.abs(actual.cells[index][key] - expected.cells[index][key]), `cell ${index}, ${key}`).toBeLessThanOrEqual(0.1)
    }
  }
}

for (const width of [430, 1440]) for (const theme of ['light', 'dark']) test(`stimulus leaves every cell and marker center fixed (${width}px, ${theme})`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 430 ? 932 : 900 })
  await page.clock.install()
  await page.goto('/')
  if (await page.locator('html').getAttribute('data-theme') !== theme) await page.locator('.theme-toggle').click()
  for (const size of [2, 3, 4, 5, 6]) {
    if (width === 430) await page.getByRole('button', { name: 'Session settings' }).click()
    await page.getByRole('combobox', { name: 'Field size' }).selectOption(String(size))
    if (width === 430) await page.getByRole('button', { name: 'Close dialog' }).click()
    const baseline = await fieldGeometry(page)
    await page.getByRole('button', { name: 'Begin session', exact: true }).click()
    await page.clock.runFor(3000)
    await expect(page.locator('.field-cell.lit')).toHaveCount(1)
    expectStableGeometry(await fieldGeometry(page), baseline)
    await page.clock.runFor(500)
    await expect(page.locator('.field-cell.lit')).toHaveCount(0)
    expectStableGeometry(await fieldGeometry(page), baseline)
    await page.clock.runFor(2500)
    await expect(page.locator('.field-cell.lit')).toHaveCount(1)
    expectStableGeometry(await fieldGeometry(page), baseline)
    await page.getByRole('button', { name: 'Stop round' }).click()
  }
})

for (const width of [430, 1440]) test(`theme control and its artwork are centered in both themes (${width}px)`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 430 ? 932 : 900 })
  await page.goto('/')
  const button = page.locator('.theme-toggle')
  for (let theme = 0; theme < 2; theme++) {
    const box = (await button.boundingBox())!
    expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(0.1)
    const icon = (await button.locator('svg').boundingBox())!
    expect(Math.abs(icon.x + icon.width / 2 - box.x - box.width / 2)).toBeLessThanOrEqual(0.1)
    expect(Math.abs(icon.y + icon.height / 2 - box.y - box.height / 2)).toBeLessThanOrEqual(0.1)
    await button.click()
  }
})

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

for (const colorScheme of ['light', 'dark'] as const) for (const theme of ['light', 'dark']) test(`forced colors preserve visible markers, native select arrows and keyboard input (${theme} theme, ${colorScheme} palette)`, async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit does not emulate forced colors')
  await page.clock.install()
  await page.emulateMedia({ forcedColors: 'active', colorScheme })
  await page.goto('/')
  if (await page.locator('html').getAttribute('data-theme') !== theme) await page.locator('.theme-toggle').click()
  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true)
  const colors = await page.locator('.field').evaluate(field => ({
    background: getComputedStyle(field).backgroundColor,
    idle: getComputedStyle(field.querySelector('.field-cell:not(.fixation) span')!).backgroundColor,
    fixation: getComputedStyle(field.querySelector('.fixation span')!).backgroundColor,
  }))
  expect(colors.idle).not.toBe(colors.background)
  expect(colors.fixation).not.toBe(colors.background)
  await page.getByRole('button', { name: 'How to play' }).click()
  const exampleColors = await page.locator('.example-field').first().evaluate(field => ({
    background: getComputedStyle(field).backgroundColor,
    idle: getComputedStyle(field.querySelector('i:not(.on)')!).backgroundColor,
    active: getComputedStyle(field.querySelector('i.on')!).backgroundColor,
  }))
  expect(exampleColors.idle).not.toBe(exampleColors.background)
  expect(exampleColors.active).not.toBe(exampleColors.background)
  expect(exampleColors.active).not.toBe(exampleColors.idle)
  await page.getByRole('button', { name: 'Close dialog' }).click()
  const fieldSize = page.getByRole('combobox', { name: 'Field size' })
  await expect(fieldSize).toHaveCSS('appearance', 'auto')
  await expect(fieldSize).toHaveCSS('background-image', 'none')
  await fieldSize.focus()
  await fieldSize.press('4')
  await fieldSize.press('Enter')
  await expect(fieldSize).toHaveValue('4')
  await expect(page.locator('.field-cell')).toHaveCount(16)
  await page.getByRole('button', { name: 'Begin session', exact: true }).click()
  await page.clock.runFor(3000)
  const stimulus = page.locator('.field-cell.lit span')
  await expect(stimulus).toBeVisible()
  const stimulusColor = await stimulus.evaluate(marker => getComputedStyle(marker).backgroundColor)
  expect(stimulusColor).not.toBe(colors.background)
  expect(stimulusColor).not.toBe(colors.idle)
})

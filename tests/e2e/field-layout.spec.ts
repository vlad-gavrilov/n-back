import { expect, freezeClock, test, type Page } from './fixtures'

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

function desktopFrame(page: Page) {
  return page.locator('.workspace > .settings').evaluate(sidebar => {
    const divider = sidebar.getBoundingClientRect()
    return { top: divider.top, bottom: divider.bottom, footer: document.querySelector('footer')!.getBoundingClientRect().top }
  })
}

for (const [width, height] of [[1716, 1026], [1366, 768]]) test(`the desktop divider and footer stay fixed when starting or restarting at ${width}×${height}`, async ({ page }) => {
  await page.setViewportSize({ width, height })
  await freezeClock(page)
  await page.goto('/')
  const start = page.getByRole('button', { name: 'Begin session' })
  await start.waitFor()
  await page.evaluate(() => document.fonts.ready)
  const frame = await desktopFrame(page)
  const field = await page.locator('.field').boundingBox()

  await start.click()
  await expect(page.getByRole('heading', { name: 'Get ready' })).toBeVisible()
  expect(await desktopFrame(page)).toEqual(frame)
  expect(await page.locator('.field').boundingBox()).toEqual(field)
  await page.clock.runFor(3000)
  await expect(page.getByText(/Warm-up 1/)).toBeVisible()
  expect(await desktopFrame(page)).toEqual(frame)
  await page.clock.runFor(6000)
  await page.getByRole('button', { name: /^Position/ }).click()
  expect(await desktopFrame(page)).toEqual(frame)

  await page.getByRole('button', { name: 'Stop round' }).click()
  const restart = page.getByRole('button', { name: 'Start fresh' })
  await expect(restart).toBeVisible()
  expect(await desktopFrame(page)).toEqual(frame)
  await restart.click()
  await expect(page.getByRole('heading', { name: 'Get ready' })).toBeVisible()
  expect(await desktopFrame(page)).toEqual(frame)
  await page.clock.runFor(69000)
  const next = page.getByRole('button', { name: /Continue at/ })
  await expect(next).toBeVisible()
  expect(await desktopFrame(page)).toEqual(frame)
  await next.click()
  await expect(page.getByRole('heading', { name: 'Get ready' })).toBeVisible()
  expect(await desktopFrame(page)).toEqual(frame)
  expect(await page.locator('.field').boundingBox()).toEqual(field)
})

test('both correct and incorrect feedback have space below the response button', async ({ page }) => {
  await page.setViewportSize({ width: 1716, height: 1026 })
  await freezeClock(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Begin session' }).click()
  await page.clock.runFor(9000)
  const answer = page.getByRole('button', { name: /^Position/ })
  const label = answer.locator('small')
  const seen = new Set<string>()
  for (let trial = 0; trial < 20 && seen.size < 2; trial++) {
    await answer.click()
    await expect(label).toBeVisible()
    seen.add(await label.innerText())
    const button = (await answer.boundingBox())!
    const feedback = (await label.boundingBox())!
    expect(feedback.y - (button.y + button.height)).toBeGreaterThanOrEqual(8)
    await page.clock.runFor(3000)
  }
  expect(seen).toEqual(new Set(['Correct', 'False alarm']))
})

test('preparing sound uses the same desktop frame as the countdown', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await freezeClock(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Dual', exact: true }).click()
  await page.evaluate(() => document.fonts.ready)
  const frame = await desktopFrame(page)
  const field = await page.locator('.field').boundingBox()
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  await page.route('**/audio/*.wav*', async route => { await pending; await route.continue() })
  try {
    await page.getByRole('button', { name: 'Begin session' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Preparing sound' })).toBeVisible()
    expect(await desktopFrame(page)).toEqual(frame)
    expect(await page.locator('.field').boundingBox()).toEqual(field)
  } finally {
    release()
  }
  await expect(page.getByRole('heading', { name: 'Get ready' })).toBeVisible()
  expect(await desktopFrame(page)).toEqual(frame)
  expect(await page.locator('.field').boundingBox()).toEqual(field)
})

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

for (const [width, height] of [[667, 280], [568, 260], [320, 256]]) test(`a 6×6 cue and both responses remain usable at ${width}×${height}`, async ({ page }) => {
  await page.setViewportSize({ width, height })
  await freezeClock(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Session settings' }).click()
  const settings = page.getByRole('dialog')
  await settings.getByRole('button', { name: 'Dual', exact: true }).click()
  await settings.getByRole('combobox', { name: 'Field size' }).selectOption('6')
  await settings.getByRole('button', { name: 'Close dialog' }).click()
  await page.getByRole('button', { name: 'Begin session' }).click()
  await expect(page.getByRole('heading', { name: 'Get ready' })).toBeVisible()
  await page.clock.runFor(9000)
  await expect(page.locator('.field-cell.lit span')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  for (const label of ['Position', 'Audio']) {
    const response = page.getByRole('button', { name: new RegExp(`^${label}`) })
    await expect(response).toBeInViewport({ ratio: 1 })
    await response.click()
    await expect(response.locator('small')).toHaveText(/Correct|False alarm/)
    await expect(response.locator('small')).toBeInViewport({ ratio: 1 })
  }
  if (width === 320) {
    const positionFeedback = (await page.getByRole('button', { name: /^Position/ }).locator('small').boundingBox())!
    const audioButton = (await page.getByRole('button', { name: /^Audio/ }).boundingBox())!
    expect(audioButton.y - (positionFeedback.y + positionFeedback.height)).toBeGreaterThanOrEqual(8)
  }
})

for (const layout of [
  { width: 1366, height: 768, compact: false, minFrameSide: 500, flank: false },
  { width: 768, height: 1024, compact: true, minFrameSide: 550, flank: false },
  { width: 375, height: 667, compact: true, minFrameSide: 330, flank: false },
  { width: 844, height: 390, compact: true, minFrameSide: 300, flank: true },
  { width: 480, height: 190, compact: true, minFrameSide: 110, flank: true },
]) test(`round controls and field fit without scrolling at ${layout.width}×${layout.height}`, async ({ page }) => {
  const { width, height, compact, minFrameSide, flank } = layout
  await page.setViewportSize({ width, height })
  await freezeClock(page)
  await page.goto('/')
  const settings = page.getByRole('button', { name: 'Session settings' })
  if (compact) await settings.click()
  await page.getByRole('button', { name: 'Dual', exact: true }).click()
  if (compact) await page.getByRole('button', { name: 'Close dialog' }).click()
  await page.evaluate(() => document.fonts.ready)
  const position = page.getByRole('button', { name: /^Position/ })
  const audio = page.getByRole('button', { name: /^Audio/ })
  const field = page.locator('.field')
  await expect(position).toBeHidden()
  await page.getByRole('button', { name: 'Begin session' }).click()
  const stop = page.getByRole('button', { name: 'Stop round' })
  await expect(stop).toBeVisible()
  const frame = (await page.locator('.field-frame').boundingBox())!
  const initial = (await field.boundingBox())!
  expect(frame.width).toBeGreaterThanOrEqual(minFrameSide)
  expect(frame.height).toBeCloseTo(frame.width, 1)
  const inset = frame.width * (compact ? .03 : .04)
  for (const gap of [
    initial.x - frame.x, frame.x + frame.width - initial.x - initial.width,
    initial.y - frame.y, frame.y + frame.height - initial.y - initial.height,
  ]) expect(gap).toBeCloseTo(inset, 1)
  expect((await stop.boundingBox())!.y).toBeLessThan(initial.y)
  await page.clock.runFor(3000)
  await expect(page.getByText(/Warm-up 1/)).toBeVisible()
  await expect(position).toBeHidden()
  expect(await field.boundingBox()).toEqual(initial)
  await page.clock.runFor(6000)
  for (const target of [field, stop, position, audio]) await expect(target).toBeInViewport({ ratio: 1 })
  expect(await field.boundingBox()).toEqual(initial)
  expect(await page.evaluate(() => scrollY)).toBe(0)
  const first = (await position.boundingBox())!, second = (await audio.boundingBox())!
  if (flank) {
    expect(first.x + first.width).toBeLessThan(initial.x)
    expect(second.x).toBeGreaterThan(initial.x + initial.width)
  } else {
    expect(first.y).toBeGreaterThanOrEqual(initial.y + initial.height)
    expect(second.y).toBeCloseTo(first.y, 1)
    expect(first.x + first.width).toBeLessThan(second.x)
  }
})

test.describe('touch response feedback', () => {
  test.use({ hasTouch: true })

  for (const [width, height] of [[1000, 561], [430, 430], [480, 190]]) test(`both inputs and their feedback fit at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await freezeClock(page)
    await page.goto('/')
    const settings = page.getByRole('button', { name: 'Session settings' })
    if (await settings.isVisible()) await settings.tap()
    await page.getByRole('button', { name: 'Dual', exact: true }).tap()
    const close = page.getByRole('button', { name: 'Close dialog' })
    if (await close.isVisible()) await close.tap()
    await page.getByRole('button', { name: 'Begin session' }).tap()
    await expect(page.getByRole('heading', { name: 'Get ready', exact: true })).toBeVisible()
    await expect(page.locator('.game-region')).toBeFocused()
    await page.clock.runFor(9000)
    const position = page.getByRole('button', { name: /^Position/ })
    const audio = page.getByRole('button', { name: /^Audio/ })
    const heading = page.getByRole('heading', { name: 'Trial 1 of 20' })
    const stop = page.getByRole('button', { name: 'Stop round' })
    for (const target of [heading, stop, page.locator('.field'), position, audio]) {
      await expect(target).toBeInViewport({ ratio: 1 })
    }
    for (const control of [position, audio]) expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(56)
    expect(await page.evaluate(() => scrollY)).toBe(0)
    await position.tap()
    await audio.tap()
    for (const control of [position, audio]) {
      const feedback = control.locator('small')
      await expect(feedback).toHaveText(/Correct|False alarm/)
      await expect(feedback).toBeVisible()
      await expect(feedback).toBeInViewport({ ratio: 1 })
    }
    expect(await page.evaluate(() => scrollY)).toBe(0)
  })
})

test('continuing from scrolled results brings the whole round back into view', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 561 })
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button', { name: 'Begin session' }).click()
  await page.clock.runFor(69000)
  const next = page.getByRole('button', { name: /Continue at/ })
  await next.scrollIntoViewIfNeeded()
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0)
  await next.click()
  await expect(page.getByRole('heading', { name: 'Get ready' })).toBeVisible()
  await expect(page.locator('.game-region')).toBeFocused()
  await expect(page.getByRole('button', { name: 'Stop round' })).toBeInViewport({ ratio: 1 })
  await expect(page.locator('.field')).toBeInViewport({ ratio: 1 })
  await page.clock.runFor(12000)
  await expect(page.getByRole('button', { name: /^Position/ })).toBeInViewport({ ratio: 1 })
})

for (const [width, height] of [[500, 390], [320, 256]]) test(`the Russian Space shortcut fits inside its response at ${width}×${height}`, async ({ page }) => {
  await page.setViewportSize({ width, height })
  await page.addInitScript(() => localStorage.setItem('nback-locale', 'ru'))
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button', { name: 'Начать раунд' }).click()
  await page.clock.runFor(9000)
  const answer = page.getByRole('button', { name: /^Позиция/ })
  const bounds = (await answer.boundingBox())!
  for (const label of [answer.locator('kbd'), answer.locator('span')]) {
    await expect(label).toBeVisible()
    const box = (await label.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(bounds.x)
    expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width)
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

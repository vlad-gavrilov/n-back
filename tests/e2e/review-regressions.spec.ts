import { expect, test, type Page } from './fixtures'

type TestAudioWindow = {
  __testAudioContext: AudioContext
  __releaseAudioResume?: () => void
}

async function freezeClock(page: Page) {
  const time = new Date('2026-11-04T12:00:00Z')
  await page.clock.install({ time })
  await page.clock.pauseAt(time)
}

async function startRound(page: Page, mode: 'visual' | 'dual') {
  await freezeClock(page)
  await page.goto('/')
  if (mode === 'dual') await page.getByRole('button', { name: 'Dual', exact: true }).click()
  await page.getByRole('button', { name: 'Begin session', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Get ready', exact: true })).toBeVisible()
  await page.clock.runFor(9000)
  await expect(page.getByText('Trial 1 of 20', { exact: true })).toBeVisible()
}

for (const { mode, channel, key } of [
  { mode: 'visual', channel: 'Position', key: 'Space' },
  { mode: 'dual', channel: 'Audio', key: 'Space' },
  { mode: 'dual', channel: 'Audio', key: 'Enter' },
  { mode: 'dual', channel: 'Audio', key: 'NumpadEnter' },
] as const) test(`focused ${mode} ${channel} answers on ${key} down without answering the next trial on release`, async ({ page }) => {
  await startRound(page, mode)
  const response = page.getByRole('button', { name: new RegExp(`^${channel}`) })
  await response.focus()
  await page.clock.runFor(2950)
  await page.keyboard.down(key)
  await expect(response.locator('small')).toHaveText(/Correct|False alarm/)
  await page.clock.runFor(100)
  await expect(page.getByText('Trial 2 of 20', { exact: true })).toBeVisible()
  await expect(response.locator('small')).toHaveText('Match')
  await page.keyboard.down(key)
  await expect(response.locator('small')).toHaveText('Match')
  await page.keyboard.up(key)
  await expect(response.locator('small')).toHaveText('Match')
  if (mode === 'dual') await expect(page.getByRole('button', { name: /^Position/ }).locator('small')).toHaveText('Match')
})

test('retrying a failed mobile Dual session closes settings before preparation and focuses the round', async ({ page }) => {
  await freezeClock(page)
  await page.setViewportSize({ width: 430, height: 932 })
  await page.route('**/audio/*.wav*', route => route.fulfill({ status: 503, body: 'Unavailable' }))
  await page.goto('/')
  await page.getByRole('button', { name: 'Session settings', exact: true }).click()
  const settings = page.getByRole('dialog')
  await settings.getByRole('button', { name: 'Dual', exact: true }).click()
  await settings.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await page.getByRole('button', { name: 'Begin session', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Sounds could not be loaded')
  await page.getByRole('button', { name: 'Session settings', exact: true }).click()
  await expect(settings.getByRole('alert')).toContainText('Sounds could not be loaded')

  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  await page.unrouteAll()
  await page.route('**/audio/*.wav*', async route => { await pending; await route.continue() })
  try {
    await settings.getByRole('button', { name: 'Try again', exact: true }).click()
    await expect(settings).toHaveCount(0)
    await expect(page.getByRole('status').filter({ hasText: 'Preparing sound' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Get ready', exact: true })).toHaveCount(0)
    release()
    await expect(page.getByRole('heading', { name: 'Get ready', exact: true })).toBeVisible()
    await expect(page.locator('.game-region')).toBeFocused()
    await page.clock.runFor(9000)
    await page.keyboard.press('v')
    await page.keyboard.press('a')
    for (const channel of ['Position', 'Audio']) await expect(page.getByRole('button', { name: new RegExp(`^${channel}`) }).locator('small')).toHaveText(/Correct|False alarm/)
  } finally { release() }
})

test('completed Dual results stay locked while Continue prepares sound and then focus the countdown', async ({ page }) => {
  await startRound(page, 'dual')
  await page.clock.runFor(60000)
  await expect(page.getByRole('heading', { name: 'Round complete', exact: true })).toBeVisible()
  const actions = page.locator('.result-actions')
  const adjust = actions.getByRole('button', { name: 'Adjust session', exact: true })
  await expect(actions.getByRole('button', { name: /^Repeat / })).toBeVisible()
  await page.evaluate(() => {
    const testWindow = window as unknown as TestAudioWindow
    const context = testWindow.__testAudioContext
    const resume = context.resume.bind(context)
    context.resume = async () => {
      await new Promise<void>(resolve => { testWindow.__releaseAudioResume = resolve })
      await resume()
    }
  })
  try {
    await actions.getByRole('button', { name: /Continue at/ }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Preparing sound' })).toBeVisible()
    for (const button of await actions.getByRole('button').all()) await expect(button).toBeDisabled()
    await adjust.evaluate(button => (button as HTMLButtonElement).click())
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.evaluate(() => { (window as unknown as TestAudioWindow).__releaseAudioResume?.() })
    await expect(page.getByRole('heading', { name: 'Get ready', exact: true })).toBeVisible()
    await expect(page.locator('.game-region')).toBeFocused()
  } finally {
    await page.evaluate(() => { (window as unknown as TestAudioWindow).__releaseAudioResume?.() })
  }
})

for (const phase of ['countdown', 'running']) test(`suspending a prepared Dual context does not interrupt a Visual ${phase}`, async ({ page }) => {
  await freezeClock(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Dual', exact: true }).click()
  await page.getByRole('button', { name: 'Test sound', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Test sound played' })).toBeVisible()
  await page.getByRole('button', { name: 'Visual', exact: true }).click()
  await page.getByRole('button', { name: 'Begin session', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Get ready', exact: true })).toBeVisible()
  if (phase === 'running') await page.clock.runFor(9000)
  await page.evaluate(async () => { await (window as unknown as TestAudioWindow).__testAudioContext.suspend() })
  await expect(page.locator('.interruption-card')).toHaveCount(0)
  if (phase === 'countdown') {
    await expect(page.getByRole('heading', { name: 'Get ready', exact: true })).toBeVisible()
    await page.clock.runFor(9000)
  }
  await expect(page.getByText('Trial 1 of 20', { exact: true })).toBeVisible()
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: /^Position/ }).locator('small')).toHaveText(/Correct|False alarm/)
})

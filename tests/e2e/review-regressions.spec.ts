import { expect, freezeClock, test, type Page } from './fixtures'
import { tabToNextControl } from './keyboard-navigation'

type TestAudioWindow = {
  __testAudioContext: AudioContext & { startedSamples: number }
  __releaseAudioResume?: () => void
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

test('Space answers without outlining the board and Tab highlights the response button', async ({ page, browserName }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await startRound(page, 'visual')
  const board = page.locator('.game-region')
  const answer = page.getByRole('button', { name: /^Position/ })
  await expect(board).toBeFocused()

  await page.keyboard.press('Space')
  await expect(answer.locator('small')).toHaveText(/Correct|False alarm/)
  await expect(board).toBeFocused()
  await expect(board).toHaveCSS('outline-style', 'none')

  await tabToNextControl(page, browserName)
  await expect(answer).toBeFocused()
  await expect(answer).toHaveCSS('outline-style', 'solid')
})

test('repeated positions have blank frames between them after two delayed timers', async ({ page }) => {
  await freezeClock(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Decrease N', exact: true }).click()
  const faster = page.getByRole('button', { name: 'Decrease interval', exact: true })
  await faster.click()
  await faster.click()
  // Leave the target list in order so the first scored position repeats the warm-up.
  await page.evaluate(() => { Math.random = () => 0.999 })
  // Offset the start so a 12 ms gap falls between two animation frames.
  await page.clock.runFor(13)
  await page.getByRole('button', { name: 'Begin session', exact: true }).click()
  await page.clock.runFor(2990)
  await page.clock.fastForward(250)
  const lit = page.locator('.field-cell.lit')
  const position = () => lit.evaluate(cell => [...cell.parentElement!.children].indexOf(cell))
  await expect(lit).toHaveCount(1)
  const warmupPosition = await position()

  await page.clock.runFor(499)
  await page.clock.fastForward(249)
  await expect(lit).toHaveCount(0)
  const frames = await page.evaluateHandle(() => {
    const markerVisible: boolean[] = []
    function sample() {
      markerVisible.push(Boolean(document.querySelector('.field-cell.lit')))
      if (markerVisible.length < 2) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
    return markerVisible
  })
  await page.clock.runFor(250)
  await expect(page.getByText('Trial 1 of 20', { exact: true })).toBeVisible()
  expect(await position()).toBe(warmupPosition)
  await page.keyboard.press('Space')
  await page.clock.runFor(20000)
  await expect(page.getByRole('heading', { name: 'Round complete' })).toBeVisible()
  await expect(page.getByText('Hits', { exact: true }).locator('..').locator('dd')).toHaveText('1')
  expect(await frames.jsonValue()).toEqual([false, false])
})

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
    await page.keyboard.press('f')
    await page.keyboard.press('j')
    for (const channel of ['Position', 'Audio']) await expect(page.getByRole('button', { name: new RegExp(`^${channel}`) }).locator('small')).toHaveText(/Correct|False alarm/)
  } finally { release() }
})

async function delayResume(page: Page) {
  await page.evaluate(() => {
    const testWindow = window as unknown as TestAudioWindow
    const context = testWindow.__testAudioContext
    const resume = context.resume.bind(context)
    context.resume = async () => {
      await new Promise<void>(resolve => { testWindow.__releaseAudioResume = resolve })
      await resume()
    }
  })
}

async function releaseResume(page: Page) {
  await page.evaluate(() => { (window as unknown as TestAudioWindow).__releaseAudioResume?.() })
}

test('Start fresh changes its label only while preparing a new round', async ({ page }) => {
  await startRound(page, 'dual')
  await page.getByRole('button', { name: 'Stop round' }).click()
  const restart = page.locator('.interruption-card button')
  await delayResume(page)
  await page.getByRole('button', { name: 'Test sound', exact: true }).click()
  await expect(restart).toBeDisabled()
  await expect(restart).toHaveText('Start fresh')
  await releaseResume(page)
  await expect(restart).toBeEnabled()
  await restart.click()
  await expect(restart).toBeDisabled()
  await expect(restart).toHaveText('Preparing sound…')
  await releaseResume(page)
  await expect(page.getByRole('heading', { name: 'Get ready' })).toBeVisible()
})

test('completed Dual results stay locked while Continue prepares sound and then focus the countdown', async ({ page }) => {
  await startRound(page, 'dual')
  await page.clock.runFor(60000)
  await expect(page.getByRole('heading', { name: 'Round complete', exact: true })).toBeVisible()
  const actions = page.locator('.result-actions')
  const adjust = actions.getByRole('button', { name: 'Adjust session', exact: true })
  await expect(actions.getByRole('button', { name: /^Repeat / })).toBeVisible()
  await delayResume(page)
  try {
    await actions.getByRole('button', { name: /Continue at/ }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Preparing sound' })).toBeVisible()
    for (const button of await actions.getByRole('button').all()) await expect(button).toBeDisabled()
    await adjust.evaluate(button => (button as HTMLButtonElement).click())
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await releaseResume(page)
    await expect(page.getByRole('heading', { name: 'Get ready', exact: true })).toBeVisible()
    await expect(page.locator('.game-region')).toBeFocused()
  } finally {
    await releaseResume(page)
  }
})

test('retry starts the recommended level selected on the results screen', async ({ page }) => {
  await startRound(page, 'dual')
  await page.clock.runFor(60000)
  const next = page.getByRole('button', { name: 'Continue at 1-back' })
  await expect(next).toBeVisible()
  await page.evaluate(() => {
    const context = (window as unknown as TestAudioWindow).__testAudioContext
    const resume = context.resume.bind(context)
    context.resume = async () => {
      context.resume = resume
      throw new DOMException('Audio is unavailable', 'NotAllowedError')
    }
  })
  await next.click()
  const alert = page.getByRole('alert')
  await expect(alert).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Round complete' })).toBeVisible()
  await alert.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('heading', { name: 'Get ready' })).toBeVisible()
  await expect(page.locator('.training-heading .mode-label')).toHaveText('Position + sound / 1-back')
  await page.clock.runFor(6000)
  await expect(page.getByText('Trial 1 of 20', { exact: true })).toBeVisible()
})

test('queued key and touch answers count for the trial during which they were pressed', async ({ page }) => {
  await startRound(page, 'dual')
  await page.clock.runFor(2990)
  const pressedAt = await page.evaluate(() => performance.now())
  await page.clock.runFor(20)
  await expect(page.getByText('Trial 2 of 20', { exact: true })).toBeVisible()

  await page.evaluate(at => {
    // Deliver retained input events after the boundary, with their original press times.
    const key = new KeyboardEvent('keydown', { key: 'j', code: 'KeyJ', bubbles: true, cancelable: true })
    Object.defineProperty(key, 'timeStamp', { value: at })
    document.dispatchEvent(key)
    const touch = new PointerEvent('pointerdown', { pointerType: 'touch', button: 0, bubbles: true, cancelable: true })
    Object.defineProperty(touch, 'timeStamp', { value: performance.timeOrigin + at })
    document.querySelector('button[data-channel="visual"]')!.dispatchEvent(touch)
  }, pressedAt)

  for (const answer of await page.locator('.answer-button small').all()) await expect(answer).toHaveText('Match')
  await page.clock.runFor(57000)
  await expect(page.getByRole('heading', { name: 'Round complete' })).toBeVisible()
  const channels = page.locator('.channel-stats')
  await expect(channels).toHaveCount(2)
  for (const channel of await channels.all()) {
    const hits = await channel.getByText('Hits', { exact: true }).locator('..').locator('dd').innerText()
    const falseAlarms = await channel.getByText('False alarms', { exact: true }).locator('..').locator('dd').innerText()
    expect(Number(hits) + Number(falseAlarms)).toBe(1)
  }
})

for (const phase of ['countdown', 'running']) test(`a queued event from the closed Dual context does not interrupt a Visual ${phase}`, async ({ page }) => {
  await freezeClock(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Dual', exact: true }).click()
  await page.getByRole('button', { name: 'Test sound', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as TestAudioWindow).__testAudioContext.startedSamples)).toBe(1)
  await page.clock.runFor(100)
  await expect(page.getByRole('status').filter({ hasText: 'Test sound played' })).toBeVisible()
  const staleEvent = await page.evaluateHandle(() => {
    const context = (window as unknown as TestAudioWindow).__testAudioContext
    return context.onstatechange!.bind(context)
  })
  await page.getByRole('button', { name: 'Visual', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as TestAudioWindow).__testAudioContext.state)).toBe('closed')
  await page.getByRole('button', { name: 'Begin session', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Get ready', exact: true })).toBeVisible()
  if (phase === 'running') await page.clock.runFor(9000)
  await staleEvent.evaluate(notify => notify(new Event('statechange')))
  await expect(page.locator('.interruption-card')).toHaveCount(0)
  if (phase === 'countdown') {
    await expect(page.getByRole('heading', { name: 'Get ready', exact: true })).toBeVisible()
    await page.clock.runFor(9000)
  }
  await expect(page.getByText('Trial 1 of 20', { exact: true })).toBeVisible()
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: /^Position/ }).locator('small')).toHaveText(/Correct|False alarm/)
})

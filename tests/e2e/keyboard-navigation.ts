import type { Page } from '@playwright/test'

export function tabToNextControl(page: Page, browserName: string) {
  // The default macOS WebKit profile includes buttons in keyboard navigation with Option+Tab.
  // https://github.com/microsoft/playwright/issues/5609
  const key = browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab'
  return page.keyboard.press(key)
}

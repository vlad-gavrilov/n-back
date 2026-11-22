import { useEffect, useState } from 'react'
import { dictionaries, initialLocale, saveLocale } from '../i18n'
import { readPreference, writePreference } from './storage'

type Theme = 'light' | 'dark'

function initialTheme(): Theme {
  const saved = readPreference('nback-theme')
  if (saved === 'light' || saved === 'dark') return saved
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function usePreferences() {
  const [locale, setLocale] = useState(initialLocale)
  const [theme, setTheme] = useState(initialTheme)
  const t = dictionaries[locale]

  useEffect(() => {
    document.documentElement.lang = locale
    document.title = t.title
    document.querySelector('meta[name="description"]')?.setAttribute('content', t.description)
    saveLocale(locale)
  }, [locale, t])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    const color = theme === 'light' ? '#F5F6F8' : '#151820'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
    writePreference('nback-theme', theme)
  }, [theme])

  function toggleTheme(): void {
    setTheme(current => current === 'light' ? 'dark' : 'light')
  }
  return { locale, setLocale, t, theme, toggleTheme }
}

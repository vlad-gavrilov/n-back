import { readPreference, writePreference } from '../preferences/storage'
import { en, type Messages } from './en'
import { ru } from './ru'

export type { Messages } from './en'
export const locales = ['en', 'ru'] as const
export type Locale = typeof locales[number]
export const localeNames: Record<Locale, string> = { en: 'English', ru: 'Русский' }
export const dictionaries: Record<Locale, Messages> = { en, ru }

export function initialLocale(): Locale {
  const saved = readPreference('nback-locale')
  return locales.find(locale => locale === saved) ?? 'en'
}

export function saveLocale(locale: Locale): void {
  writePreference('nback-locale', locale)
}

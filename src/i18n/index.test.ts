import { afterEach, expect, it, vi } from 'vitest'
import { dictionaries, initialLocale, saveLocale } from './index'
afterEach(() => vi.unstubAllGlobals())
it('has matching complete dictionaries', () => {
  expect(Object.keys(dictionaries.ru).sort()).toEqual(Object.keys(dictionaries.en).sort())
  for (const value of Object.values(dictionaries.ru)) if (typeof value === 'string') { expect(value.length).toBeGreaterThan(0); expect(value).not.toMatch(/[ёЁ]/) }
})
it('formats Russian step forms and parameters', () => {
  expect([1,2,5,9].map(n => dictionaries.ru.stepUnit(n))).toEqual([' шаг',' шага',' шагов',' шагов'])
  expect(dictionaries.en.stepUnit(1)).toBe(' step')
  expect(dictionaries.ru.trial(7)).toBe('Показ 7 из 20')
  expect(dictionaries.ru.milliseconds(123)).toBe('123 мс')
})
it('defaults to English and restores only valid saved locales', () => {
  for (const [value, expected] of [[null,'en'],['fr','en'],['ru','ru'],['en','en']]) {
    vi.stubGlobal('localStorage', { getItem: () => value }); expect(initialLocale()).toBe(expected)
  }
})
it('tolerates inaccessible storage for reading and writing', () => {
  vi.stubGlobal('localStorage', { getItem: () => { throw Error() }, setItem: () => { throw Error() } })
  expect(initialLocale()).toBe('en'); expect(() => saveLocale('ru')).not.toThrow()
})

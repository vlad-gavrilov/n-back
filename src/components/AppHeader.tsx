import type { ReactNode } from 'react'
import { localeNames, locales, type Locale, type Messages } from '../i18n'

interface LanguageSwitchProps {
  locale: Locale
  onChange: (locale: Locale) => void
  disabled: boolean
  label: string
}

export function LanguageSwitch({ locale, onChange, disabled, label }: LanguageSwitchProps) {
  return (
    <div className="language-switch" role="group" aria-label={label}>
      {locales.map(language => (
        <button key={language} lang={language} aria-label={localeNames[language]} aria-pressed={locale === language}
          disabled={disabled} onClick={() => onChange(language)}>
          {language.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

interface AppHeaderProps {
  t: Messages
  locked: boolean
  theme: 'light' | 'dark'
  toggleTheme: () => void
  languageControl: ReactNode
  onHelp: (opener: HTMLButtonElement) => void
}

export function AppHeader({ t, locked, theme, toggleTheme, languageControl, onHelp }: AppHeaderProps) {
  const light = theme === 'light'
  return (
    <header className="topbar">
      <a className="wordmark" href="./" aria-label={t.home}>
        <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
        N-back<span className="brand-caption">{t.caption}</span>
      </a>
      <nav aria-label={t.navigation}>
        <button disabled={locked} onClick={event => onHelp(event.currentTarget)}>{t.help}</button>
        {languageControl}
        <button className="theme-toggle" aria-label={t.theme(light ? 'dark' : 'light')} onClick={toggleTheme}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d={light ? 'M12 3a9 9 0 0 0 0 18Z' : 'M12 3a9 9 0 0 1 0 18Z'} fill="currentColor" />
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </button>
      </nav>
    </header>
  )
}

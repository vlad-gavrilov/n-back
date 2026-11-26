import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { AppHeader, LanguageSwitch } from './components/AppHeader'
import { AudioFeedback } from './components/AudioFeedback'
import { Research, Tutorial } from './components/Help'
import { Modal } from './components/Modal'
import { SessionSettings } from './components/SessionSettings'
import { TrainingPanel } from './components/TrainingPanel'
import { isSessionActive } from './game/session'
import { installFocusModality } from './input/focus'
import { usePreferences } from './preferences/usePreferences'
import { useTraining } from './training/useTraining'

type Dialog = 'help' | 'settings' | 'research'

// A 240px sidebar and the page gutters leave about 520px for the field at 864px.
const compactSettingsQuery = '(max-width:864px), (orientation:landscape) and (max-height:560px)'
const compactSettings = () => matchMedia(compactSettingsQuery).matches
function subscribeToLayout(onChange: () => void) {
  const media = matchMedia(compactSettingsQuery)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

export default function App() {
  const { t, locale, setLocale, theme, toggleTheme } = usePreferences()
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const { controller, state } = useTraining(dialog !== null)
  const { config, view, audio } = state
  const compact = useSyncExternalStore(subscribeToLayout, compactSettings)
  const heading = useRef<HTMLHeadingElement>(null)
  const active = isSessionActive(view.phase)
  const locked = active || audio.phase === 'loading'
  useEffect(installFocusModality, [])

  function openDialog(next: Dialog, opener: HTMLButtonElement) {
    opener.focus({ preventScroll: true })
    setDialog(next)
  }

  function retryAudio() {
    if (audio.phase === 'error' && audio.purpose === 'session') setDialog(null)
    void controller.retry()
  }

  const feedback = <AudioFeedback audio={audio} t={t} onRetry={retryAudio}
    onUseVisual={() => controller.configure({ ...config, mode: 'visual' })} />
  const testFeedback = audio.phase !== 'idle' && audio.purpose === 'test'
  const feedbackInSidebar = dialog !== 'settings' && testFeedback && !compact
  const settingsProps = { config, locked, onChange: controller.configure, onTestSound: controller.testSound, t }
  const languageControl = <LanguageSwitch locale={locale} onChange={setLocale} disabled={locked} label={t.language} />
  const titles = { help: t.helpTitle, settings: t.settings, research: t.researchTitle }

  return (
    <div className="app-shell" data-compact={compact || undefined} data-round-active={active || undefined}>
      <AppHeader t={t} locked={locked} theme={theme} toggleTheme={toggleTheme} languageControl={languageControl}
        onHelp={opener => openDialog('help', opener)} />
      <main className="workspace">
        <aside className="settings">
          <div className="section-heading"><h2>{t.settings}</h2><span aria-hidden="true">↙</span></div>
          <SessionSettings {...settingsProps} feedback={feedbackInSidebar && feedback} />
        </aside>
        <TrainingPanel state={state} controller={controller} headingRef={heading} t={t}
          openSettings={opener => openDialog('settings', opener)}
          feedback={dialog !== 'settings' && !feedbackInSidebar && feedback} />
      </main>
      <footer>
        <span>{t.footer}</span>
        <button disabled={locked} onClick={event => openDialog('research', event.currentTarget)}>
          {t.research} <span aria-hidden="true">↗</span>
        </button>
        <a href={`${import.meta.env.BASE_URL}licenses/robotnick2-CC-BY-SA.txt`}>{t.voiceCredit}</a>
        <a href="https://vlad-gavrilov.dev/">{t.byAuthor}</a>
      </footer>
      {dialog && (
        <Modal title={titles[dialog]} close={() => setDialog(null)} t={t}
          languageControl={languageControl} fallbackFocusRef={heading}>
          {dialog === 'settings' && <SessionSettings {...settingsProps} feedback={feedback} />}
          {dialog === 'research' && <Research t={t} />}
          {dialog === 'help' && <Tutorial t={t} trialMs={config.trialMs} onClose={() => setDialog(null)} />}
        </Modal>
      )}
    </div>
  )
}

import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { AudioPlayer, AudioPreparationError, type AudioErrorCode } from './audio/player'
import { type Channel, type ChannelResult, type SessionConfig } from './game/engine'
import { Session, type SessionView, type InterruptionReason } from './game/session'
import { dictionaries, initialLocale, localeNames, locales, saveLocale, type Locale, type Messages } from './i18n'
import { Modal } from './components/Modal'
import { getResponseChannel } from './input/keyboard'
const initial: SessionView = { phase: 'idle', countdown: 3, index: -1, cue: null, answered: {} }
const compactSettingsQuery = '(max-width:650px), (orientation:landscape) and (max-height:560px)'
type AudioState = { phase: 'idle' } | { phase: 'loading'; purpose: 'test' | 'session' } | { phase: 'success'; purpose: 'test' } | { phase: 'error'; purpose: 'test' | 'session'; code: AudioErrorCode }
function initialTheme(): 'light' | 'dark' { try { const saved = localStorage.getItem('nback-theme'); if (saved === 'light' || saved === 'dark') return saved } catch { /* Browser storage is optional */ } return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light' }
function ChannelStats({ label, result, t }: { label: string; result: ChannelResult; t: Messages }) {
  return <section className="channel-stats"><h3>{label}</h3><dl>{[[t.hits, t.number(result.hits)], [t.misses, t.number(result.misses)], [t.falseAlarms, t.number(result.falseAlarms)], [t.hitRate, t.percent(result.hitRate)], [t.falseAlarmRate, t.percent(result.falseAlarmRate)], [t.meanReaction, result.meanHitReactionMs === null ? '—' : t.milliseconds(result.meanHitReactionMs)]].map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}</dl></section>
}
export default function App() {
  const [locale, setLocale] = useState<Locale>(initialLocale)
  const t = dictionaries[locale]
  const [config, setConfig] = useState<SessionConfig>({ mode: 'visual', n: 2, gridSize: 3, liveFeedback: true })
  const [view, setView] = useState<SessionView>(initial)
  const [theme, setTheme] = useState(initialTheme)
  const [modal, setModal] = useState<'help' | 'research' | 'settings' | null>(null)
  const [lesson, setLesson] = useState(0)
  const [audioState, setAudioState] = useState<AudioState>({ phase: 'idle' })
  const [compactSettings, setCompactSettings] = useState(() => matchMedia(compactSettingsQuery).matches)
  const session = useRef<Session | null>(null), audio = useRef(new AudioPlayer()), board = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null), interruptionHeading = useRef<HTMLHeadingElement>(null)
  const operation = useRef(0)
  const busy = audioState.phase === 'loading'
  const active = ['countdown', 'warmup', 'running'].includes(view.phase)
  const languageControl = <div className="language-switch" role="group" aria-label={t.language}>{locales.map(language => <button key={language} lang={language} aria-label={localeNames[language]} aria-pressed={locale === language} disabled={active || busy} onClick={() => setLocale(language)}>{language.toUpperCase()}</button>)}</div>
  useEffect(() => { document.documentElement.lang = locale; document.title = t.title; document.querySelector('meta[name="description"]')?.setAttribute('content', t.description); saveLocale(locale) }, [locale, t])
  useEffect(() => { document.documentElement.dataset.theme = theme; document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#F5F6F8' : '#151820'); try { localStorage.setItem('nback-theme', theme) } catch { /* Theme still works without persistence */ } }, [theme])
  useEffect(() => { const media = matchMedia(compactSettingsQuery); const update = () => setCompactSettings(media.matches); media.addEventListener('change', update); update(); return () => media.removeEventListener('change', update) }, [])
  useEffect(() => {
    const interrupt = (reason: InterruptionReason) => { operation.current++; session.current?.interrupt(reason); audio.current.stop(); setAudioState({ phase: 'idle' }) }
    const visibility = () => { if (document.hidden) interrupt('hidden') }
    const orientation = () => interrupt('orientation')
    audio.current.onInterrupted = () => interrupt('audio')
    document.addEventListener('visibilitychange', visibility); screen.orientation?.addEventListener('change', orientation)
    const player = audio.current
    return () => { operation.current++; session.current?.stop(); player.stop(); document.removeEventListener('visibilitychange', visibility); screen.orientation?.removeEventListener('change', orientation) }
  }, [])
  useEffect(() => { if (view.phase === 'countdown') board.current?.focus(); else if (view.phase === 'interrupted') interruptionHeading.current?.focus() }, [view.phase])
  useEffect(() => {
    if (view.phase !== 'running' || modal) return
    function gameKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) return
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('input,select,textarea,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')) return
      const nativeActivation = event.code === 'Space' || event.code === 'Enter' || (!event.code || event.code === 'Unidentified') && [' ', 'Spacebar', 'Enter'].includes(event.key)
      const responseButton = target?.closest('.answer-button')
      if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) { if (responseButton && nativeActivation) event.preventDefault(); return }
      const channel = getResponseChannel(event, config.mode)
      if (event.repeat) { if (channel || responseButton && nativeActivation) event.preventDefault(); return }
      if (nativeActivation && target?.closest('button,a[href],summary,[role="button"],[role="link"]')) return
      if (channel) { event.preventDefault(); session.current?.respond(channel) }
    }
    document.addEventListener('keydown', gameKeyDown)
    return () => document.removeEventListener('keydown', gameKeyDown)
  }, [view.phase, config.mode, modal])
  function configure(next: SessionConfig) {
    if (next.mode === config.mode && next.n === config.n && next.gridSize === config.gridSize && next.liveFeedback === config.liveFeedback) return
    operation.current++; session.current?.stop(); setAudioState({ phase: 'idle' }); setConfig(next); setView(initial)
  }
  async function start(n = config.n) {
    const token = ++operation.current
    session.current?.stop(); setAudioState({ phase: 'loading', purpose: 'session' })
    try {
      if (config.mode === 'dual') await audio.current.prepare()
      if (token !== operation.current) return
      const next = { ...config, n }; setConfig(next)
      session.current = new Session(next, setView, letter => audio.current.play(letter), () => audio.current.stop())
      session.current.start(); setAudioState({ phase: 'idle' })
    } catch (e) { if (token === operation.current) setAudioState({ phase: 'error', purpose: 'session', code: e instanceof AudioPreparationError ? e.code : 'unknown' }) }
  }
  async function testSound() {
    const token = ++operation.current; setAudioState({ phase: 'loading', purpose: 'test' })
    try {
      await audio.current.prepare()
      if (token !== operation.current) return
      audio.current.play('B')
      if (token === operation.current) setAudioState({ phase: 'success', purpose: 'test' })
    } catch (e) { if (token === operation.current) setAudioState({ phase: 'error', purpose: 'test', code: e instanceof AudioPreparationError ? e.code : 'unknown' }) }
  }
  function answer(channel: Channel) { session.current?.respond(channel) }
  function openModal(next: 'help' | 'research' | 'settings', opener: HTMLElement) { opener.focus({ preventScroll: true }); setModal(next) }
  function adjust(e: MouseEvent<HTMLButtonElement>) { openModal('settings', e.currentTarget) }
  const testFeedback = audioState.phase !== 'idle' && audioState.purpose === 'test'
  const audioFeedback = audioState.phase === 'idle' ? null : audioState.phase === 'error' ? <div className="audio-feedback error-message" role="alert">{t.error[audioState.code]}<button onClick={() => audioState.purpose === 'test' ? testSound() : start()}>{t.retrySound}</button>{config.mode === 'dual' && <button onClick={() => configure({ ...config, mode: 'visual' })}>{t.useVisual}</button>}</div> : <p className="audio-feedback" role="status">{audioState.phase === 'success' ? t.soundTestPlayed : testFeedback ? t.soundTestPreparing : t.preparing}</p>
  const controls = <>
    <fieldset disabled={active || busy}><legend>{t.exercise}</legend><div className="segmented">{(['visual', 'dual'] as const).map(mode => <button key={mode} aria-pressed={config.mode === mode} onClick={() => configure({ ...config, mode })}>{mode === 'visual' ? t.visual : t.dual}</button>)}</div></fieldset>
    <fieldset disabled={active || busy}><legend>{t.lookBack}</legend><div className="stepper"><button aria-label={t.decrease} disabled={config.n === 1} onClick={() => configure({ ...config, n: config.n - 1 })}>−</button><output aria-label={t.level}>{t.number(config.n)}<small>{t.stepUnit(config.n)}</small></output><button aria-label={t.increase} disabled={config.n === 9} onClick={() => configure({ ...config, n: config.n + 1 })}>+</button></div></fieldset>
    <label className="select-label">{t.fieldSize}<select disabled={active || busy} value={config.gridSize} onChange={e => configure({ ...config, gridSize: Number(e.target.value) })}>{[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} × {n}</option>)}</select></label>
    <label className="check-label"><input type="checkbox" disabled={active || busy} checked={config.liveFeedback} onChange={e => configure({ ...config, liveFeedback: e.target.checked })} /><span>{t.liveFeedback}<small>{t.feedbackHint}</small></span></label>
    {config.mode === 'dual' && <button className="text-button" disabled={busy || active} onClick={testSound}><span aria-hidden="true">♫ </span>{t.testSound}</button>}
    {(modal === 'settings' || !compactSettings && testFeedback) && audioFeedback}
    <div className="settings-note"><strong>{t.smallSteps}</strong><p>{t.settingsHint(config.n)}</p></div>
  </>
  const status = view.phase === 'countdown' ? t.countdown : view.phase === 'warmup' ? t.warmup : view.phase === 'running' ? t.running : view.phase === 'complete' ? t.complete : view.phase === 'interrupted' ? t.interrupted : t.idle
  return <div className="app-shell">
    <header className="topbar"><a className="wordmark" href="./" aria-label={t.home}><span className="brand-mark" aria-hidden="true"><i/><i/><i/></span>N-back<span className="brand-caption">{t.caption}</span></a><nav aria-label={t.navigation}><button disabled={active || busy} onClick={e => { setLesson(0); openModal('help', e.currentTarget) }}>{t.help}</button>{languageControl}<button className="theme-toggle" aria-label={t.theme(theme === 'light' ? 'dark' : 'light')} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={theme === 'light' ? 'M12 3a9 9 0 0 0 0 18Z' : 'M12 3a9 9 0 0 1 0 18Z'} fill="currentColor"/><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8"/></svg></button></nav></header>
    <main className="workspace"><aside className="settings"><div className="section-heading"><h2>{t.settings}</h2><span aria-hidden="true">↙</span></div>{controls}</aside>
      <section className="training" aria-label={t.trainer}><div className="training-heading"><div><p className="mode-label">{t.modeLabel(config.mode === 'dual', config.n)}</p><h1 ref={heading} tabIndex={-1}>{status}</h1></div><button className="mobile-settings icon-button" disabled={active || busy} aria-label={t.sessionSettings} onClick={e => openModal('settings', e.currentTarget)}>☷</button></div>
        {modal !== 'settings' && (compactSettings || !testFeedback) && audioFeedback}
        {view.phase === 'complete' && view.result ? <div className="results" aria-live="polite"><div className="score-banner"><span>{t.score}</span><strong>{t.number(view.result.score)}<small>/ 100</small></strong><p>{t.scoreHint}</p></div><div className="stats-grid"><ChannelStats t={t} label={t.position} result={view.result.visual}/>{view.result.audio && <ChannelStats t={t} label={t.audio} result={view.result.audio}/>}</div><div className="result-actions"><button className="primary-button" onClick={() => start(view.result!.nextN)}>{t.continueAt(view.result.nextN)} <span aria-hidden="true">↗</span></button>{view.result.nextN !== config.n && <button className="secondary-button" onClick={() => start()}>{t.repeat(config.n)}</button>}<button className="text-button" onClick={adjust}>{t.adjust}</button></div></div> : view.phase === 'interrupted' ? <section className="interruption-card" aria-labelledby="interruption-title"><span aria-hidden="true">↺</span><h2 id="interruption-title" ref={interruptionHeading} tabIndex={-1}>{t.roundInterrupted}</h2><p>{view.reason && t.reason[view.reason]}</p><p className="interruption-score">{t.notScored}</p><button className="primary-button" disabled={busy} onClick={() => start()}>{busy ? t.preparing : t.startFresh}</button></section> : <>
          <div className="game-region" ref={board} tabIndex={-1} aria-label={t.gameControls}>
            <div className={`field ${active ? 'is-active' : ''}`} style={{ '--grid': config.gridSize } as React.CSSProperties} aria-label={t.field(config.gridSize)}>
              {Array.from({ length: config.gridSize ** 2 }, (_, i) => <div key={i} className={`field-cell ${config.gridSize === 3 && i === 4 ? 'fixation' : ''} ${view.cue === i ? 'lit' : ''}`} data-active={view.cue === i ? 'true' : undefined} aria-hidden="true"><span/></div>)}
              {view.phase === 'countdown' && <div className="countdown" role="status">{t.number(view.countdown)}</div>}
            </div>
            <div className="round-status" aria-live="polite">{view.phase === 'warmup' ? t.warmupProgress(view.index + 1, config.n) : view.phase === 'running' ? t.trial(view.index - config.n + 1) : view.phase === 'countdown' ? t.settle : t.duration}</div>
            <div className="answers">{(['visual', ...(config.mode === 'dual' ? ['audio'] : [])] as Channel[]).map(channel => <button key={channel} className={`answer-button ${view.answered[channel] !== undefined ? config.liveFeedback ? view.answered[channel] ? 'correct' : 'incorrect' : 'registered' : ''}`} disabled={view.phase !== 'running'} onPointerDown={e => { if (e.button !== 0) return; e.preventDefault(); answer(channel) }} onClick={e => { if (e.detail === 0) answer(channel) }}><span>{channel === 'visual' ? t.position : t.audio}</span><kbd>{channel === 'audio' ? 'A' : config.mode === 'dual' ? 'V' : t.space}</kbd><small>{view.answered[channel] === undefined ? t.match : config.liveFeedback ? view.answered[channel] ? t.correct : t.falseAlarm : t.registered}</small></button>)}</div>
          </div>
          <div className="start-row">{active ? <button className="secondary-button" onClick={() => session.current?.interrupt('stopped')}>{t.stop}</button> : <button className="primary-button" disabled={busy} onClick={() => start()}>{busy && !testFeedback ? t.preparing : t.begin}<span aria-hidden="true">↗</span></button>}<p>{config.mode === 'dual' ? t.dualHint : t.visualHint}</p></div>
        </>}
      </section>
    </main>
    <footer><span>{t.footer}</span><button disabled={active || busy} onClick={e => openModal('research', e.currentTarget)}>{t.research} <span aria-hidden="true">↗</span></button><a href="https://vlad-gavrilov.dev/">{t.byAuthor}</a></footer>
    {modal && <Modal title={modal === 'help' ? t.helpTitle : modal === 'research' ? t.researchTitle : t.settings} close={() => setModal(null)} t={t} languageControl={languageControl} fallbackFocusRef={heading}>{modal === 'settings' ? controls : modal === 'research' ? <div className="research-links"><p>{t.researchIntro}</p><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC2383929/" target="_blank" rel="noreferrer">{t.authors('Jaeggi', 2008)}<span>{t.jaeggi}</span></a><a href="https://pubmed.ncbi.nlm.nih.gov/28116702/" target="_blank" rel="noreferrer">{t.authors('Soveri', 2017)}<span>{t.soveri}</span></a><a href="https://www.nature.com/articles/s41746-026-02478-9" target="_blank" rel="noreferrer">{t.authors('Li', 2026)}<span>{t.li}</span></a></div> : <div className="lesson"><p className="mode-label">{t.lessonStep(lesson + 1)}</p><h3>{[t.lessonTitle0, t.lessonTitle1, t.lessonTitle2][lesson]}</h3><p>{[t.lessonText0, t.lessonText1, t.lessonText2][lesson]}</p>{lesson === 0 && <div className="example-sequence" aria-label={t.example}>{[0, 8, 0].map((position, i) => <div key={i}><div className="example-field">{Array.from({ length: 9 }, (_, j) => <i key={j} className={position === j ? 'on' : ''}/>)}</div><small>{i === 2 ? `${t.match} ↶` : t.exampleStep(i + 1)}</small></div>)}</div>}<button className="primary-button" onClick={() => lesson === 2 ? setModal(null) : setLesson(lesson + 1)}>{lesson === 2 ? t.ready : t.next}<span aria-hidden="true">↗</span></button></div>}</Modal>}
  </div>
}

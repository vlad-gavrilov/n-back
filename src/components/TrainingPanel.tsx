import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import type { SessionConfig } from '../game/config'
import { isSessionActive, type SessionView } from '../game/session'
import type { Messages } from '../i18n'
import type { TrainingController, TrainingState } from '../training/controller'
import { GameBoard } from './GameBoard'
import { InterruptionCard, RoundResult } from './RoundResult'

interface TrainingPanelProps {
  state: TrainingState
  controller: TrainingController
  headingRef: RefObject<HTMLHeadingElement | null>
  openSettings: (opener: HTMLButtonElement) => void
  feedback: ReactNode
  t: Messages
}

function roundTitle(view: SessionView, config: SessionConfig, t: Messages) {
  switch (view.phase) {
    case 'idle': return t.duration(config.trialMs)
    case 'warmup': return t.warmupProgress(view.index + 1, config.n)
    case 'running': return t.trial(view.index - config.n + 1)
    default: return t[view.phase]
  }
}

export function TrainingPanel({ state, controller, headingRef, openSettings, feedback, t }: TrainingPanelProps) {
  const { config, view, audio } = state
  const active = isSessionActive(view.phase)
  const hasField = active || view.phase === 'idle'
  const busy = audio.phase === 'loading'
  const panel = useRef<HTMLElement>(null)
  const board = useRef<HTMLDivElement>(null)
  const interruptionHeading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (view.phase === 'countdown') {
      panel.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      board.current?.focus({ preventScroll: true })
    }
    if (view.phase === 'interrupted') interruptionHeading.current?.focus()
  }, [view.phase])

  function roundContent() {
    if (view.phase === 'complete') {
      return <RoundResult config={config} result={view.result} busy={busy} onStart={controller.start} onAdjust={openSettings} t={t} />
    }
    if (view.phase === 'interrupted') {
      return <InterruptionCard reason={view.reason} headingRef={interruptionHeading} busy={busy} onStart={controller.start} t={t} />
    }
    return (
      <GameBoard config={config} view={view} boardRef={board} onAnswer={controller.respond} t={t}>
        <button className="primary-button" disabled={busy} onClick={() => controller.start()}>
          {busy && audio.purpose === 'session' ? t.preparing : t.begin}<span aria-hidden="true">↗</span>
        </button>
      </GameBoard>
    )
  }

  return (
    <section ref={panel} className="training" data-field-layout={hasField || undefined} aria-label={t.trainer}>
      <div className="training-heading">
        <div>
          <p className="mode-label">{t.modeLabel(config.mode === 'dual', config.n)}</p>
          <h1 ref={headingRef} tabIndex={-1} aria-live="polite">{roundTitle(view, config, t)}</h1>
        </div>
        {active ? (
          <button className="round-stop secondary-button" aria-label={t.stop} onClick={() => controller.interrupt('stopped')}>
            {t.stopShort}
          </button>
        ) : (
          <button className="mobile-settings icon-button" disabled={busy} aria-label={t.sessionSettings}
            onClick={event => openSettings(event.currentTarget)}>☷</button>
        )}
      </div>
      {feedback}
      {roundContent()}
    </section>
  )
}

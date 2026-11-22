import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { isSessionActive } from '../game/session'
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

export function TrainingPanel({ state, controller, headingRef, openSettings, feedback, t }: TrainingPanelProps) {
  const { config, view, audio } = state
  const active = isSessionActive(view.phase)
  const busy = audio.phase === 'loading'
  const board = useRef<HTMLDivElement>(null)
  const interruptionHeading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (view.phase === 'countdown') board.current?.focus()
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
      <>
        <GameBoard config={config} view={view} boardRef={board} onAnswer={controller.respond} t={t} />
        <div className="start-row">
          {active ? (
            <button className="secondary-button" onClick={() => controller.interrupt('stopped')}>{t.stop}</button>
          ) : (
            <button className="primary-button" disabled={busy} onClick={() => controller.start()}>
              {busy && audio.purpose === 'session' ? t.preparing : t.begin}<span aria-hidden="true">↗</span>
            </button>
          )}
          <p>{config.mode === 'dual' ? t.dualHint : t.visualHint}</p>
        </div>
      </>
    )
  }

  return (
    <section className="training" aria-label={t.trainer}>
      <div className="training-heading">
        <div>
          <p className="mode-label">{t.modeLabel(config.mode === 'dual', config.n)}</p>
          <h1 ref={headingRef} tabIndex={-1}>{t[view.phase]}</h1>
        </div>
        <button className="mobile-settings icon-button" disabled={active || busy} aria-label={t.sessionSettings}
          onClick={event => openSettings(event.currentTarget)}>☷</button>
      </div>
      {feedback}
      {roundContent()}
    </section>
  )
}

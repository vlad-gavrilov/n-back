import type { CSSProperties, RefObject } from 'react'
import { isFixationCell, type Channel, type SessionConfig } from '../game/config'
import { isSessionActive, type SessionView } from '../game/session'
import type { Messages } from '../i18n'

interface GameBoardProps {
  config: SessionConfig
  view: SessionView
  boardRef: RefObject<HTMLDivElement | null>
  onAnswer: (channel: Channel) => void
  t: Messages
}

function roundStatus(view: SessionView, config: SessionConfig, t: Messages) {
  switch (view.phase) {
    case 'warmup': return t.warmupProgress(view.index + 1, config.n)
    case 'running': return t.trial(view.index - config.n + 1)
    case 'countdown': return t.settle
    default: return t.duration(config.trialMs)
  }
}

function answerFeedback(answer: boolean | undefined, liveFeedback: boolean, t: Messages) {
  if (answer === undefined) return { className: '', label: t.match }
  if (!liveFeedback) return { className: 'registered', label: t.registered }
  return answer
    ? { className: 'correct', label: t.correct }
    : { className: 'incorrect', label: t.falseAlarm }
}

export function GameBoard({ config, view, boardRef, onAnswer, t }: GameBoardProps) {
  const { gridSize, mode } = config
  const active = isSessionActive(view.phase)
  const channels: Channel[] = mode === 'dual' ? ['visual', 'audio'] : ['visual']
  const visualShortcut = mode === 'dual' ? 'V' : t.space

  return (
    <div className="game-region" ref={boardRef} tabIndex={-1} aria-label={t.gameControls}>
      <div className={`field ${active ? 'is-active' : ''}`} style={{ '--grid': gridSize } as CSSProperties} aria-label={t.field(gridSize)}>
        {Array.from({ length: gridSize ** 2 }, (_, index) => {
          const fixation = isFixationCell(gridSize, index)
          const lit = view.cue === index
          return (
            <div
              key={index}
              className={`field-cell ${fixation ? 'fixation' : ''} ${lit ? 'lit' : ''}`}
              data-active={lit ? 'true' : undefined}
              aria-hidden="true"
            >
              <span />
            </div>
          )
        })}
        {view.phase === 'countdown' && <div className="countdown" role="status">{t.number(view.countdown)}</div>}
      </div>

      <div className="round-status" aria-live="polite">{roundStatus(view, config, t)}</div>
      <div className="answers">
        {channels.map(channel => {
          const feedback = answerFeedback(view.answered[channel], config.liveFeedback, t)
          return (
            <button
              key={channel}
              data-channel={channel}
              className={`answer-button ${feedback.className}`}
              disabled={view.phase !== 'running'}
              onPointerDown={event => {
                if (event.button !== 0) return
                event.preventDefault()
                onAnswer(channel)
              }}
              onClick={event => {
                // Pointer responses are timed on press. Keyboard and assistive clicks have detail zero.
                if (event.detail === 0) onAnswer(channel)
              }}
            >
              <span>{channel === 'visual' ? t.position : t.audio}</span>
              <kbd>{channel === 'visual' ? visualShortcut : 'A'}</kbd>
              <small>{feedback.label}</small>
            </button>
          )
        })}
      </div>
    </div>
  )
}

import type { CSSProperties, KeyboardEvent, ReactNode, RefObject } from 'react'
import { isFixationCell, type Channel, type SessionConfig } from '../game/config'
import type { SessionView } from '../game/session'
import type { Messages } from '../i18n'
import { getResponseChannel } from '../input/keyboard'
import { inputTime } from '../input/time'

interface GameBoardProps {
  config: SessionConfig
  view: SessionView
  boardRef: RefObject<HTMLDivElement | null>
  onAnswer: (channel: Channel, occurredAt: number) => void
  t: Messages
  children: ReactNode
}

function answerFeedback(answer: boolean | undefined, liveFeedback: boolean, t: Messages) {
  if (answer === undefined) return { className: '', label: t.match }
  if (!liveFeedback) return { className: 'registered', label: t.registered }
  return answer
    ? { className: 'correct', label: t.correct }
    : { className: 'incorrect', label: t.falseAlarm }
}

function preventEarlySpaceScroll(event: KeyboardEvent<HTMLDivElement>) {
  if (event.target !== event.currentTarget || event.nativeEvent.isComposing) return
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
  if (getResponseChannel(event, 'visual') === 'visual') event.preventDefault()
}

export function GameBoard({ config, view, boardRef, onAnswer, t, children }: GameBoardProps) {
  const { gridSize, mode } = config
  const observing = view.phase === 'countdown' || view.phase === 'warmup'
  const channels: Channel[] = mode === 'dual' ? ['visual', 'audio'] : ['visual']
  const visualShortcut = mode === 'dual' ? 'F' : t.space

  return (
    <div className="game-region" role="group" ref={boardRef} tabIndex={-1} aria-label={t.gameControls}
      onKeyDown={observing && mode === 'visual' ? preventEarlySpaceScroll : undefined}>
      <div className="field-frame">
        <div className="field" style={{ '--grid': gridSize } as CSSProperties} aria-label={t.field(gridSize)}>
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
      </div>

      {view.phase === 'idle' ? (
        <div className="start-row">
          {children}
          <p className="shortcut-hint">
            <span><kbd>{visualShortcut}</kbd> {t.position}</span>
            {mode === 'dual' && <span><kbd>J</kbd> {t.audio}</span>}
          </p>
          <p className="touch-hint">{mode === 'dual' ? t.touchDual : t.touchVisual}</p>
        </div>
      ) : (
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
                  onAnswer(channel, inputTime(event.nativeEvent))
                }}
                onClick={event => {
                  // Pointer responses are timed on press. Keyboard and assistive clicks have detail zero.
                  if (event.detail === 0) onAnswer(channel, inputTime(event.nativeEvent))
                }}
              >
                <span>{channel === 'visual' ? t.position : t.audio}</span>
                <kbd>{channel === 'visual' ? visualShortcut : 'J'}</kbd>
                <small>{feedback.label}</small>
              </button>
            )
          })}
        </div>
      )}
      {observing && (
        <p className="observation-hint">{view.phase === 'countdown' ? t.settle : t.observe}</p>
      )}
    </div>
  )
}

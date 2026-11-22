import type { RefObject } from 'react'
import type { SessionConfig } from '../game/config'
import type { ChannelResult, SessionResult } from '../game/scoring'
import type { InterruptionReason } from '../game/session'
import type { Messages } from '../i18n'

interface RoundResultProps {
  config: SessionConfig
  result: SessionResult
  busy: boolean
  onStart: (n?: number) => void
  onAdjust: (opener: HTMLButtonElement) => void
  t: Messages
}

function ChannelStats({ label, result, t }: { label: string; result: ChannelResult; t: Messages }) {
  const stats = [
    [t.hits, t.number(result.hits)],
    [t.misses, t.number(result.misses)],
    [t.falseAlarms, t.number(result.falseAlarms)],
    [t.hitRate, t.percent(result.hitRate)],
    [t.falseAlarmRate, t.percent(result.falseAlarmRate)],
    [t.meanReaction, result.meanHitReactionMs === null ? '—' : t.milliseconds(result.meanHitReactionMs)],
  ]

  return (
    <section className="channel-stats">
      <h3>{label}</h3>
      <dl>
        {stats.map(([term, value]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function RoundResult({ config, result, busy, onStart, onAdjust, t }: RoundResultProps) {
  return (
    <div className="results" aria-live="polite">
      <div className="score-banner">
        <span>{t.score}</span>
        <strong>{t.number(result.score)}<small>/ 100</small></strong>
        <p>{t.scoreHint}</p>
      </div>
      <div className="stats-grid">
        <ChannelStats label={t.position} result={result.visual} t={t} />
        {result.audio && <ChannelStats label={t.audio} result={result.audio} t={t} />}
      </div>
      <div className="result-actions">
        <button className="primary-button" disabled={busy} onClick={() => onStart(result.nextN)}>
          {t.continueAt(result.nextN)} <span aria-hidden="true">↗</span>
        </button>
        {result.nextN !== config.n && (
          <button className="secondary-button" disabled={busy} onClick={() => onStart()}>{t.repeat(config.n)}</button>
        )}
        <button className="text-button" disabled={busy} onClick={event => onAdjust(event.currentTarget)}>{t.adjust}</button>
      </div>
    </div>
  )
}

interface InterruptionCardProps {
  reason: InterruptionReason
  headingRef: RefObject<HTMLHeadingElement | null>
  busy: boolean
  onStart: () => void
  t: Messages
}

export function InterruptionCard({ reason, headingRef, busy, onStart, t }: InterruptionCardProps) {
  return (
    <section className="interruption-card" aria-labelledby="interruption-title">
      <span aria-hidden="true">↺</span>
      <h2 id="interruption-title" ref={headingRef} tabIndex={-1}>{t.roundInterrupted}</h2>
      <p>{t.reason[reason]}</p>
      <p className="interruption-score">{t.notScored}</p>
      <button className="primary-button" disabled={busy} onClick={() => onStart()}>{busy ? t.preparing : t.startFresh}</button>
    </section>
  )
}

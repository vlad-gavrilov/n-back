import type { ReactNode } from 'react'
import { GRID_SIZES, MAX_N, MIN_N, TRIAL_MS_OPTIONS, type SessionConfig } from '../game/config'
import type { Messages } from '../i18n'

interface SessionSettingsProps {
  config: SessionConfig
  locked: boolean
  onChange: (next: SessionConfig) => void
  onTestSound: () => void
  feedback: ReactNode
  t: Messages
}

interface StepperProps {
  decreaseLabel: string
  increaseLabel: string
  onDecrease?: () => void
  onIncrease?: () => void
  children: ReactNode
}

function Stepper({ decreaseLabel, increaseLabel, onDecrease, onIncrease, children }: StepperProps) {
  return (
    <div className="stepper">
      <button aria-label={decreaseLabel} disabled={!onDecrease} onClick={onDecrease}>−</button>
      {children}
      <button aria-label={increaseLabel} disabled={!onIncrease} onClick={onIncrease}>+</button>
    </div>
  )
}

export function SessionSettings({ config, locked, onChange, onTestSound, feedback, t }: SessionSettingsProps) {
  const intervalIndex = TRIAL_MS_OPTIONS.indexOf(config.trialMs)
  const previousInterval = TRIAL_MS_OPTIONS[intervalIndex - 1]
  const nextInterval = TRIAL_MS_OPTIONS[intervalIndex + 1]
  const seconds = config.trialMs / 1000

  return (
    <>
      <fieldset disabled={locked}>
        <legend>{t.exercise}</legend>
        <div className="segmented">
          {(['visual', 'dual'] as const).map(mode => (
            <button key={mode} aria-pressed={config.mode === mode} onClick={() => onChange({ ...config, mode })}>
              {mode === 'visual' ? t.visual : t.dual}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset disabled={locked}>
        <legend>{t.lookBack}</legend>
        <Stepper
          decreaseLabel={t.decrease}
          increaseLabel={t.increase}
          onDecrease={config.n === MIN_N ? undefined : () => onChange({ ...config, n: config.n - 1 })}
          onIncrease={config.n === MAX_N ? undefined : () => onChange({ ...config, n: config.n + 1 })}
        >
          <output aria-label={t.level}>{t.number(config.n)}<small>{t.stepUnit(config.n)}</small></output>
        </Stepper>
      </fieldset>

      <label className="select-label">
        {t.fieldSize}
        <select
          disabled={locked}
          value={config.gridSize}
          onChange={event => onChange({ ...config, gridSize: Number(event.currentTarget.value) })}
        >
          {GRID_SIZES.map(size => <option key={size} value={size}>{size} × {size}</option>)}
        </select>
      </label>

      <fieldset disabled={locked}>
        <legend>{t.interval}</legend>
        <Stepper
          decreaseLabel={t.decreaseInterval}
          increaseLabel={t.increaseInterval}
          onDecrease={previousInterval === undefined ? undefined : () => onChange({ ...config, trialMs: previousInterval })}
          onIncrease={nextInterval === undefined ? undefined : () => onChange({ ...config, trialMs: nextInterval })}
        >
          <output aria-label={t.interval}>{t.number(seconds)}<small>{t.secondUnit(seconds)}</small></output>
        </Stepper>
      </fieldset>

      <label className="check-label">
        <input
          type="checkbox"
          disabled={locked}
          checked={config.liveFeedback}
          onChange={event => onChange({ ...config, liveFeedback: event.currentTarget.checked })}
        />
        <span>{t.liveFeedback}<small>{t.feedbackHint}</small></span>
      </label>
      {config.mode === 'dual' && (
        <button className="text-button" disabled={locked} onClick={onTestSound}>
          <span aria-hidden="true">♫ </span>{t.testSound}
        </button>
      )}
      {feedback}
      <div className="settings-note">
        <strong>{t.smallSteps}</strong>
        <p>{t.settingsHint(config.n)}</p>
      </div>
    </>
  )
}

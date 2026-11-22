import type { Messages } from '../i18n'
import type { AudioState } from '../training/controller'

interface AudioFeedbackProps {
  audio: AudioState
  t: Messages
  onRetry: () => void
  onUseVisual: () => void
}

export function AudioFeedback({ audio, t, onRetry, onUseVisual }: AudioFeedbackProps) {
  switch (audio.phase) {
    case 'idle': return null
    case 'loading':
      return <p className="audio-feedback" role="status">{audio.purpose === 'test' ? t.soundTestPreparing : t.preparing}</p>
    case 'success':
      return <p className="audio-feedback" role="status">{t.soundTestPlayed}</p>
    case 'error':
      return (
        <div className="audio-feedback error-message" role="alert">
          {t.error[audio.code]}
          <button onClick={onRetry}>{t.retrySound}</button>
          <button onClick={onUseVisual}>{t.useVisual}</button>
        </div>
      )
  }
}

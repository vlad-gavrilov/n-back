import { AudioPlayer, AudioPreparationError, type AudioErrorCode } from '../audio/player'
import { assertSupportedConfig, DEFAULT_CONFIG, type Channel, type SessionConfig } from '../game/config'
import { createIdleView, isSessionActive, Session, type InterruptionReason, type SessionView } from '../game/session'

type AudioRequest = { purpose: 'test' } | { purpose: 'session'; n: number }
export type AudioState =
  | { phase: 'idle' }
  | { phase: 'success'; purpose: 'test' }
  | ({ phase: 'loading' } & AudioRequest)
  | ({ phase: 'error'; code: AudioErrorCode } & AudioRequest)

export interface TrainingState {
  readonly config: SessionConfig
  readonly view: SessionView
  readonly audio: AudioState
}

type TrainingAudio = Pick<AudioPlayer, 'prepare' | 'play' | 'stop' | 'dispose' | 'onInterrupted'>
const idleAudio = { phase: 'idle' } as const

function sameConfig(a: SessionConfig, b: SessionConfig): boolean {
  return a.mode === b.mode && a.n === b.n && a.gridSize === b.gridSize &&
    a.trialMs === b.trialMs && a.liveFeedback === b.liveFeedback
}

export class TrainingController {
  private state: TrainingState = { config: DEFAULT_CONFIG, view: createIdleView(), audio: idleAudio }
  private readonly listeners = new Set<() => void>()
  private session?: Session
  private preparation?: AbortController

  constructor(private readonly player: TrainingAudio = new AudioPlayer()) {
    player.onInterrupted = () => this.interrupt('audio')
  }

  getSnapshot = (): TrainingState => this.state

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private update(change: Partial<TrainingState>): void {
    this.state = { ...this.state, ...change }
    for (const listener of this.listeners) listener()
  }

  configure = (config: SessionConfig): void => {
    if (sameConfig(this.state.config, config)) return
    assertSupportedConfig(config)
    this.cancelPreparation()
    if (this.session) this.session.stop()
    else this.player.stop()
    this.session = undefined
    this.update({ config: { ...config }, view: createIdleView(), audio: idleAudio })
  }

  private get locked(): boolean {
    return this.state.audio.phase === 'loading' || isSessionActive(this.state.view.phase)
  }

  start = async (n = this.state.config.n): Promise<void> => {
    if (this.locked) return
    const config = { ...this.state.config, n }
    assertSupportedConfig(config)
    if (config.mode === 'dual') await this.prepare({ purpose: 'session', n })
    else this.beginSession(config)
  }

  testSound = async (): Promise<void> => {
    if (this.locked || this.state.config.mode !== 'dual') return
    await this.prepare({ purpose: 'test' })
  }

  retry(): Promise<void> | undefined {
    const { audio } = this.state
    if (audio.phase !== 'error') return
    return audio.purpose === 'session' ? this.start(audio.n) : this.testSound()
  }

  private async prepare(request: AudioRequest): Promise<void> {
    const pending = new AbortController()
    this.preparation = pending
    this.update({ audio: { ...request, phase: 'loading' } })
    try {
      await this.player.prepare(pending.signal)
      if (pending.signal.aborted) return
      if (request.purpose === 'session') {
        this.beginSession({ ...this.state.config, n: request.n })
      } else {
        this.player.play('B')
        // Starting a sample can synchronously report an interruption.
        if (!pending.signal.aborted) this.update({ audio: { purpose: 'test', phase: 'success' } })
      }
    } catch (error) {
      if (!pending.signal.aborted) {
        const code = error instanceof AudioPreparationError ? error.code : 'unknown'
        this.update({ audio: { ...request, phase: 'error', code } })
      }
    } finally {
      if (this.preparation === pending) this.preparation = undefined
    }
  }

  private beginSession(config: SessionConfig): void {
    const session = new Session(
      config,
      view => {
        if (this.session !== session) return
        if (!isSessionActive(view.phase)) this.session = undefined
        this.update({ config, view, audio: idleAudio })
      },
      letter => this.player.play(letter),
      () => this.player.stop(),
    )
    this.session = session
    session.start()
  }

  respond = (channel: Channel): void => { this.session?.respond(channel) }

  interrupt(reason: InterruptionReason): void {
    const { config, audio } = this.state
    if (reason === 'audio' && config.mode !== 'dual') return
    this.cancelPreparation()
    if (this.session) {
      this.session.interrupt(reason)
      return
    }
    this.player.stop()
    if (audio.phase === 'loading' && reason === 'audio') {
      this.update({ audio: { ...audio, phase: 'error', code: 'blocked' } })
    } else if (audio.phase === 'loading' || audio.phase === 'success') {
      this.update({ audio: idleAudio })
    }
  }

  private cancelPreparation(): void {
    const pending = this.preparation
    this.preparation = undefined
    pending?.abort()
  }

  dispose(): void {
    this.cancelPreparation()
    this.session?.stop()
    this.session = undefined
    this.player.dispose()
    if (isSessionActive(this.state.view.phase) || this.state.audio.phase !== 'idle') {
      this.update({ view: createIdleView(), audio: idleAudio })
    }
  }
}

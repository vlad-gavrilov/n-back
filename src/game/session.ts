import { CUE_MS, type Channel, type SessionConfig } from './config'
import { scoreRound, type ChannelResponse, type SessionResult } from './scoring'
import { generateTrials, isTarget, type Trial } from './sequence'

const COUNTDOWN_SECONDS = 3
const SECOND_MS = 1000
const MAX_LATENESS_MS = 250

export type InterruptionReason = 'timing' | 'hidden' | 'orientation' | 'audio' | 'stopped'
type ActivePhase = 'countdown' | 'warmup' | 'running'
type FinalStatus =
  | { phase: 'complete'; result: SessionResult; reason?: never }
  | { phase: 'interrupted'; reason: InterruptionReason; result?: never }

export type SessionView = {
  countdown: number
  index: number
  cue: number | null
  answered: Partial<Record<Channel, boolean>>
} & (
  | { phase: 'idle' | ActivePhase; result?: never; reason?: never }
  | (FinalStatus & { cue: null })
)

export function createIdleView(): SessionView & { phase: 'idle' } {
  return { phase: 'idle', countdown: COUNTDOWN_SECONDS, index: -1, cue: null, answered: {} }
}

export function isSessionActive(phase: SessionView['phase']): phase is ActivePhase {
  return phase === 'countdown' || phase === 'warmup' || phase === 'running'
}

type TimerHandle = ReturnType<typeof setTimeout>
export interface Clock {
  now(): number
  schedule(callback: () => void, delay: number): TimerHandle
  cancel(handle: TimerHandle): void
}

export const browserClock: Clock = {
  now: () => performance.now(),
  schedule: (callback, delay) => setTimeout(callback, delay),
  cancel: handle => clearTimeout(handle),
}

interface Round {
  active: true
  firstTrialAt: number
  shownAt: number
  responses: ChannelResponse[]
  timer?: TimerHandle
}

export class Session {
  view: SessionView = createIdleView()
  trials: Trial[] = []
  private round: Round | { active: false } = { active: false }

  constructor(
    readonly config: SessionConfig,
    private readonly changed: (view: SessionView) => void,
    private readonly play: (letter: string) => void,
    private readonly stopSound: () => void,
    private readonly clock: Clock = browserClock,
    private readonly random = Math.random,
  ) {}

  start(): void {
    if (!this.cancelRound()) return
    this.trials = generateTrials(this.config, this.random)
    const round: Round = {
      active: true,
      firstTrialAt: this.clock.now() + COUNTDOWN_SECONDS * SECOND_MS,
      shownAt: 0,
      responses: [],
    }
    this.round = round
    this.publish({ ...createIdleView(), phase: 'countdown' })
    this.tick(round)
  }

  respond(channel: Channel): void {
    const { round, view } = this
    if (!round.active || view.phase !== 'running' || view.answered[channel] !== undefined) return
    if (channel === 'audio' && this.config.mode !== 'dual') return

    const now = this.clock.now()
    const reactionMs = now - round.shownAt
    const deadline = this.nextBoundary(round, view.index)
    if (reactionMs < 0 || reactionMs >= this.config.trialMs || now >= deadline) return

    round.responses.push({ trial: view.index, channel, reactionMs })
    const correct = isTarget(this.trials, view.index, this.config.n, channel)
    this.publish({ ...view, answered: { ...view.answered, [channel]: correct } })
  }

  stop(): void {
    this.cancelRound()
  }

  interrupt(reason: InterruptionReason): void {
    if (this.round.active && isSessionActive(this.view.phase)) this.finish({ phase: 'interrupted', reason })
  }

  private cancelRound(): boolean {
    const round = this.round
    const stopped = { active: false } as const
    this.round = stopped
    if (round.active && round.timer !== undefined) this.clock.cancel(round.timer)
    this.stopSound()
    // Sound cleanup can synchronously start or stop the session again.
    return this.round === stopped
  }

  private publish(view: SessionView): void {
    this.view = view
    this.changed({ ...view })
  }

  private finish(status: FinalStatus): void {
    const { countdown, index, answered } = this.view
    if (this.cancelRound()) this.publish({ ...status, countdown, index, answered, cue: null })
  }

  private nextBoundary(round: Round, index: number): number {
    // With no following stimulus, the final response window runs from the actual onset.
    const { trialMs } = this.config
    return index === this.trials.length - 1
      ? round.shownAt + trialMs
      : round.firstTrialAt + (index + 1) * trialMs
  }

  private tick(round: Round, now = this.clock.now()): void {
    if (this.round !== round) return
    const elapsed = now - round.firstTrialAt
    if (elapsed < 0) {
      this.publish({ ...this.view, countdown: Math.ceil(-elapsed / SECOND_MS) })
      this.schedule(round, Math.min(now + SECOND_MS, round.firstTrialAt))
      return
    }

    const boundary = this.nextBoundary(round, this.view.index)
    if (now >= boundary) {
      if (now - boundary > MAX_LATENESS_MS || this.view.cue !== null) {
        this.interrupt('timing')
        return
      }
      const nextIndex = this.view.index + 1
      if (nextIndex >= this.trials.length) {
        this.finish({ phase: 'complete', result: scoreRound(this.config, this.trials, round.responses) })
        return
      }
      this.showTrial(round, nextIndex, now)
    } else if (this.view.cue !== null && now >= round.shownAt + CUE_MS) {
      this.publish({ ...this.view, cue: null })
    }

    const nextAt = this.view.cue === null ? boundary : round.shownAt + CUE_MS
    this.schedule(round, nextAt)
  }

  private showTrial(round: Round, index: number, now: number): void {
    const trial = this.trials[index]
    round.shownAt = now
    this.publish({
      phase: index < this.config.n ? 'warmup' : 'running',
      countdown: 0,
      index,
      cue: trial.position,
      answered: {},
    })
    if (this.round === round && trial.letter) this.play(trial.letter)
  }

  private schedule(round: Round, dueAt: number): void {
    // Publishing a view or playing audio can synchronously stop or restart the round.
    if (this.round !== round) return
    round.timer = this.clock.schedule(() => {
      if (this.round !== round) return
      round.timer = undefined
      const now = this.clock.now()
      if (now - dueAt > MAX_LATENESS_MS) this.interrupt('timing')
      else this.tick(round, now)
    }, Math.max(0, dueAt - this.clock.now()))
  }
}

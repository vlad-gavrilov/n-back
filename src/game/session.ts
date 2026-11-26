import { CUE_MS, TRIAL_MS_OPTIONS, type Channel, type SessionConfig } from './config'
import { scoreRound, type ChannelResponse, type SessionResult } from './scoring'
import { generateTrials, isTarget, type Trial } from './sequence'

const COUNTDOWN_SECONDS = 3
const SECOND_MS = 1000
const MAX_LATENESS_MS = 250
const MIN_BLANK_MS = Math.min(...TRIAL_MS_OPTIONS) - CUE_MS - MAX_LATENESS_MS

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

interface TrialWindow {
  shownAt: number
  deadline: number
}

interface Round {
  active: true
  firstTrialAt: number
  windows: TrialWindow[]
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
    const now = this.clock.now()
    const round: Round = {
      active: true,
      firstTrialAt: now + COUNTDOWN_SECONDS * SECOND_MS,
      windows: [],
      responses: [],
    }
    this.round = round
    this.publish({ ...createIdleView(), phase: 'countdown' })
    this.schedule(round, now + SECOND_MS)
  }

  respond(channel: Channel, occurredAt?: number): void {
    const { round, view } = this
    if (!round.active || view.phase !== 'running') return
    if (channel === 'audio' && this.config.mode !== 'dual') return

    const now = this.clock.now()
    const pressedAt = occurredAt === undefined ? now : occurredAt
    if (!Number.isFinite(pressedAt) || pressedAt > now) return
    const index = round.windows.findIndex(({ shownAt, deadline }) => pressedAt >= shownAt && pressedAt < deadline)
    if (index < this.config.n) return

    const { shownAt, deadline } = round.windows[index]
    const reactionMs = pressedAt - shownAt
    const existing = round.responses.find(response => response.trial === index && response.channel === channel)
    if (existing) {
      // Keyboard and pointer events can arrive in a different order from the presses.
      existing.reactionMs = Math.min(existing.reactionMs, reactionMs)
      return
    }
    round.responses.push({ trial: index, channel, reactionMs })
    if (index !== view.index || now >= deadline) return
    const correct = isTarget(this.trials, index, this.config.n, channel)
    this.publish({ ...view, answered: { ...view.answered, [channel]: correct } })
  }

  /** Silent teardown. Use interrupt('stopped') to publish a user-requested stop. */
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

  private tick(round: Round, now: number): void {
    if (this.round !== round) return
    const elapsed = now - round.firstTrialAt
    if (elapsed < 0) {
      this.publish({ ...this.view, countdown: Math.ceil(-elapsed / SECOND_MS) })
      this.schedule(round, Math.min(now + SECOND_MS, round.firstTrialAt))
      return
    }

    const boundary = round.windows[this.view.index]?.deadline ?? round.firstTrialAt
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
      this.schedule(round, now + CUE_MS)
      return
    }

    const lastTrial = this.view.index === this.trials.length - 1
    this.publish({ ...this.view, cue: null })
    // A late onset and a late clear can consume most of the same blank interval.
    const nextAt = lastTrial ? boundary : Math.max(boundary, this.clock.now() + MIN_BLANK_MS)
    this.schedule(round, nextAt)
  }

  private showTrial(round: Round, index: number, now: number): void {
    const trial = this.trials[index]
    const { trialMs } = this.config
    // The last trial has no following stimulus, so its full interval starts at the actual onset.
    const deadline = index === this.trials.length - 1
      ? now + trialMs
      : round.firstTrialAt + (index + 1) * trialMs
    round.windows.push({ shownAt: now, deadline })
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
      if (now < dueAt) this.schedule(round, dueAt)
      else if (now - dueAt > MAX_LATENESS_MS) this.interrupt('timing')
      else this.tick(round, now)
    }, Math.max(0, dueAt - this.clock.now()))
  }
}

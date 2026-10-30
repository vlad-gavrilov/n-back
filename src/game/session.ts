import { CUE_MS, TRIAL_MS, generateTrials, isTarget, scoreRound, type Channel, type ChannelResponse, type SessionConfig, type SessionResult, type Trial } from './engine'
export type InterruptionReason = 'timing' | 'hidden' | 'orientation' | 'audio' | 'stopped'
export interface SessionView { phase: 'idle' | 'countdown' | 'warmup' | 'running' | 'complete' | 'interrupted'; countdown: number; index: number; cue: number | null; answered: Partial<Record<Channel, boolean>>; result?: SessionResult; reason?: InterruptionReason }
export interface Clock { now(): number; schedule(callback: () => void, delay: number): ReturnType<typeof setTimeout>; cancel(handle: ReturnType<typeof setTimeout>): void }
export const browserClock: Clock = { now: () => performance.now(), schedule: (cb, delay) => setTimeout(cb, delay), cancel: handle => clearTimeout(handle) }
export class Session {
  view: SessionView = { phase: 'idle', countdown: 3, index: -1, cue: null, answered: {} }
  trials: Trial[] = []
  private responses: ChannelResponse[] = []
  private handle?: ReturnType<typeof setTimeout>
  private epoch = 0
  private actualOnset = 0
  private generation = 0
  constructor(readonly config: SessionConfig, private changed: (view: SessionView) => void, private play: (letter: string) => void, private stopSound: () => void, private clock: Clock = browserClock, private random = Math.random) {}
  start() { this.stop(); this.trials = generateTrials(this.config, this.random); this.responses = []; this.epoch = this.clock.now() + 3000; this.publish({ phase: 'countdown', countdown: 3, index: -1, cue: null, answered: {} }); this.tick() }
  private publish(next: SessionView) { this.view = next; this.changed({ ...next }) }
  private tick = () => {
    const now = this.clock.now(), elapsed = now - this.epoch
    if (elapsed < 0) { this.publish({ ...this.view, countdown: Math.ceil(-elapsed / 1000) }); this.queue(Math.min(1000, -elapsed)); return }
    const index = Math.floor(elapsed / TRIAL_MS), offset = elapsed % TRIAL_MS
    if (index !== this.view.index) {
      if (offset > 250 || index > this.view.index + 1) { this.interrupt('timing'); return }
      if (index >= this.trials.length) { this.stop(); this.publish({ ...this.view, phase: 'complete', cue: null, result: scoreRound(this.config, this.trials, this.responses) }); return }
      this.actualOnset = now
      this.publish({ phase: index < this.config.n ? 'warmup' : 'running', countdown: 0, index, cue: this.trials[index].position, answered: {} })
      const letter = this.trials[index].letter
      if (letter) this.play(letter)
    } else if (now - this.actualOnset >= CUE_MS && this.view.cue !== null) this.publish({ ...this.view, cue: null })
    this.queue(this.view.cue !== null ? this.actualOnset + CUE_MS - now : TRIAL_MS - offset)
  }
  private queue(delay: number) {
    const generation = this.generation, due = this.clock.now() + delay
    this.handle = this.clock.schedule(() => {
      if (generation !== this.generation) return
      if (this.clock.now() - due > 250) { this.interrupt('timing'); return }
      this.tick()
    }, delay)
  }
  respond(channel: Channel) {
    if (this.view.phase !== 'running' || (channel === 'audio' && this.config.mode !== 'dual') || this.view.answered[channel] !== undefined) return
    const reactionMs = this.clock.now() - this.actualOnset
    if (reactionMs < 0 || reactionMs >= TRIAL_MS || this.clock.now() >= this.epoch + (this.view.index + 1) * TRIAL_MS) return
    this.responses.push({ trial: this.view.index, channel, reactionMs })
    this.publish({ ...this.view, answered: { ...this.view.answered, [channel]: isTarget(this.trials, this.view.index, this.config.n, channel) } })
  }
  stop() { this.generation++; if (this.handle !== undefined) this.clock.cancel(this.handle); this.stopSound() }
  interrupt(reason: InterruptionReason) { if (['countdown', 'warmup', 'running'].includes(this.view.phase)) { this.stop(); this.publish({ ...this.view, phase: 'interrupted', cue: null, reason }) } }
}

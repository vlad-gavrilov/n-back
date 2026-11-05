import { afterEach, describe, expect, it, vi } from 'vitest'
import { Session, type Clock } from './session'
import { seededRandom, type SessionConfig } from './engine'
const config: SessionConfig = { mode: 'dual', n: 2, gridSize: 3, liveFeedback: true, trialMs: 3000 }
function setup(overrides: Partial<SessionConfig> = {}) {
  vi.useFakeTimers(); let now = 0
  const clock: Clock = { now: () => now, schedule: (cb, delay) => setTimeout(cb, delay), cancel: clearTimeout }
  const changed = vi.fn(), sound = vi.fn(), stop = vi.fn()
  const session = new Session({ ...config, ...overrides }, changed, sound, stop, clock, seededRandom(3))
  const advance = (ms: number) => { for (let i = 0; i < ms; i++) { now++; vi.advanceTimersByTime(1) } }
  return { session, advance, changed, sound, stop, clock, setNow: (value: number) => { now = value } }
}
afterEach(() => vi.useRealTimers())
describe('session timing', () => {
  it('counts down, ignores warmup, blanks cues, accepts both channels once, completes the final window', () => {
    const { session: s, advance } = setup(); s.start(); s.respond('visual'); expect(s.view.phase).toBe('countdown')
    advance(3000); expect(s.view.phase).toBe('warmup'); s.respond('visual'); expect(s.view.answered).toEqual({})
    advance(6000); expect(s.view.phase).toBe('running'); s.respond('visual'); s.respond('audio'); s.respond('visual'); expect(Object.keys(s.view.answered)).toHaveLength(2)
    advance(501); expect(s.view.cue).toBeNull()
    advance(59498); expect(s.view.phase).toBe('running')
    s.respond('visual'); advance(20); expect(s.view.phase).toBe('complete'); expect((s.view.result?.visual.hits ?? 0) + (s.view.result?.visual.misses ?? 0)).toBe(6)
  })
  it('cancels all queued work on interruption and allows a clean restart', () => {
    const { session: s, advance, sound } = setup(); s.start(); advance(3100); s.interrupt('hidden'); const count = sound.mock.calls.length
    advance(9000); expect(s.view.phase).toBe('interrupted'); expect(sound).toHaveBeenCalledTimes(count)
    s.start(); expect(s.view.phase).toBe('countdown'); expect(s.view.result).toBeUndefined()
  })
  it('keeps a synchronous playback failure interrupted without resuming or scoring', () => {
    const { session: s, advance, sound } = setup()
    sound.mockImplementationOnce(() => s.interrupt('audio'))
    s.start(); advance(3000)
    expect(s.view).toMatchObject({ phase: 'interrupted', reason: 'audio', index: 0, cue: null })

    advance(s.trials.length * config.trialMs)
    expect(s.view.phase).toBe('interrupted')
    expect(s.view.result).toBeUndefined()
    expect(sound).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('does not play a cue after its published view synchronously interrupts the round', () => {
    const { session: s, advance, changed, sound } = setup()
    changed.mockImplementation(view => { if (view.phase === 'warmup') s.interrupt('hidden') })
    s.start(); advance(3000)

    expect(s.view).toMatchObject({ phase: 'interrupted', reason: 'hidden', cue: null })
    expect(sound).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('does not start ticking after the initial countdown view synchronously interrupts the round', () => {
    const { session: s, advance, changed, sound } = setup()
    changed.mockImplementation(view => { if (view.phase === 'countdown') s.interrupt('hidden') })
    s.start(); advance(3000)

    expect(s.view).toMatchObject({ phase: 'interrupted', reason: 'hidden', index: -1, cue: null })
    expect(sound).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
  it.each(['stop', 'restart'] as const)('does not leave work from a tick that synchronously triggers %s during playback', action => {
    const { session: s, advance, sound } = setup()
    sound.mockImplementationOnce(() => { if (action === 'restart') s.start(); else s.stop() })
    s.start(); advance(3000)

    expect(vi.getTimerCount()).toBe(action === 'restart' ? 1 : 0)
    if (action === 'restart') {
      expect(s.view.phase).toBe('countdown')
      advance(3000)
      expect(s.view).toMatchObject({ phase: 'warmup', index: 0 })
      expect(sound).toHaveBeenCalledTimes(2)
      expect(vi.getTimerCount()).toBe(1)
    } else {
      advance(s.trials.length * config.trialMs)
      expect(s.view.index).toBe(0)
      expect(s.view.result).toBeUndefined()
      expect(sound).toHaveBeenCalledTimes(1)
    }
  })
  it('interrupts instead of skipping stimuli after a clock stall', () => {
    const { session: s, setNow } = setup(); s.start(); setNow(4500); vi.advanceTimersToNextTimer(); expect(s.view.phase).toBe('interrupted')
  })
  it('interrupts a long stall while a cue is visible', () => {
    const { session: s, advance, setNow } = setup(); s.start(); advance(3000)
    setNow(4000); vi.advanceTimersByTime(1000)
    expect(s.view.phase).toBe('interrupted')
  })

  it('keeps the cue visible for 500 ms after an accepted late onset and measures actual reaction time', () => {
    const { session: s, advance, setNow, clock } = setup(); s.start()
    const target = s.trials.findIndex((t, i, all) => i >= config.n && t.position === all[i - config.n].position)
    const nominal = 3000 + target * 3000
    advance(nominal - 10); setNow(nominal + 200); vi.advanceTimersByTime(10)
    expect(s.view.index).toBe(target); s.respond('visual')
    advance(499); expect(s.view.cue).not.toBeNull()
    advance(1); expect(s.view.cue).toBeNull()
    advance(3000 + s.trials.length * 3000 - clock.now() + 1)
    expect(s.view.result?.visual.meanHitReactionMs).toBe(0)
  })

  it('paces trials by the configured interval and closes the response window at it', () => {
    const { session: s, advance, setNow } = setup({ trialMs: 2000 }); s.start()
    advance(3000); expect(s.view.phase).toBe('warmup'); expect(s.view.index).toBe(0)
    advance(2000); expect(s.view.index).toBe(1)
    advance(2000); expect(s.view.phase).toBe('running'); expect(s.view.index).toBe(2)
    s.respond('visual'); expect(s.view.answered.visual).toBeDefined()
    setNow(9000); s.respond('audio'); expect(s.view.answered.audio).toBeUndefined()
  })

  it.each(['visual', 'dual'] as const)('interrupts instead of merging one-second stimuli after accepted delays (%s)', mode => {
    const { session: s, advance, setNow, sound } = setup({ mode, n: 1, trialMs: 1000 }); s.start()
    const target = s.trials.findIndex((trial, i, trials) => i > 1 && trial.position === trials[i - 1].position)
    const previousOnset = 3000 + (target - 1) * 1000
    advance(previousOnset - 1); setNow(previousOnset + 250); vi.advanceTimersByTime(1)
    expect(s.view.index).toBe(target - 1)
    expect(s.view.cue).toBe(s.trials[target].position)
    const playCount = sound.mock.calls.length

    setNow(previousOnset + 1000); vi.advanceTimersByTime(500)
    expect(s.view).toMatchObject({ phase: 'interrupted', reason: 'timing', index: target - 1, cue: null })
    expect(s.view.result).toBeUndefined()
    expect(sound).toHaveBeenCalledTimes(playCount)
  })

})

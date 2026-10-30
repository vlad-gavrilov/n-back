import { afterEach, describe, expect, it, vi } from 'vitest'
import { Session, type Clock } from './session'
import { seededRandom } from './engine'
const config = { mode: 'dual' as const, n: 2, gridSize: 3, liveFeedback: true }
function setup() {
  vi.useFakeTimers(); let now = 0
  const clock: Clock = { now: () => now, schedule: (cb, delay) => setTimeout(cb, delay), cancel: clearTimeout }
  const sound = vi.fn(), stop = vi.fn()
  const session = new Session(config, vi.fn(), sound, stop, clock, seededRandom(3))
  const advance = (ms: number) => { for (let i = 0; i < ms; i++) { now++; vi.advanceTimersByTime(1) } }
  return { session, advance, sound, stop, clock, setNow: (value: number) => { now = value } }
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

})

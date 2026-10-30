import { describe, expect, it } from 'vitest'
import { generateTrials, scoreRound, recommendLevel, seededRandom, type ChannelResponse, type SessionConfig } from './engine'

const config: SessionConfig = { mode: 'dual', n: 2, gridSize: 3, liveFeedback: true }
describe('sequence contract', () => {
  for (const mode of ['visual', 'dual'] as const) for (let n = 1; n <= 9; n++) for (let gridSize = 2; gridSize <= 6; gridSize++) {
    it(`${mode}, ${n}-back, ${gridSize}×${gridSize}: exact targets and no accidental matches`, () => {
      const trials = generateTrials({ ...config, mode, n, gridSize }, seededRandom(n * 10 + gridSize))
      expect(trials).toHaveLength(n + 20)
      let visual = 0, audio = 0, both = 0
      for (let i = n; i < trials.length; i++) {
        const v = trials[i].position === trials[i - n].position
        const a = mode === 'dual' && trials[i].letter === trials[i - n].letter
        visual += Number(v); audio += Number(a); both += Number(v && a)
      }
      expect(visual).toBe(6)
      expect(audio).toBe(mode === 'dual' ? 6 : 0)
      expect(both).toBe(mode === 'dual' ? 2 : 0)
      for (const t of trials) {
        expect(t.position).toBeGreaterThanOrEqual(0)
        expect(t.position).toBeLessThan(gridSize * gridSize)
        if (gridSize === 3) expect(t.position).not.toBe(4)
      }
    })
  }
  it('replays the same seed', () => expect(generateTrials(config, seededRandom(42))).toEqual(generateTrials(config, seededRandom(42))))
  it('rejects unsupported configuration', () => expect(() => generateTrials({ ...config, n: 0 })).toThrow())
})
describe('results', () => {
  it('scores silence as zero, with no hit reaction time', () => {
    const result = scoreRound(config, generateTrials(config, seededRandom(2)), [])
    expect(result.score).toBe(0)
    expect(result.visual).toMatchObject({ hits: 0, misses: 6, falseAlarms: 0, correctRejections: 14, meanHitReactionMs: null })
  })
  it('scores perfect answers and ignores warmup, duplicates and invalid times', () => {
    const trials = generateTrials(config, seededRandom(9))
    const responses: ChannelResponse[] = [{ trial: 0, channel: 'visual' as const, reactionMs: 20 }]
    for (let i = config.n; i < trials.length; i++) for (const channel of ['visual', 'audio'] as const) {
      if (channel === 'visual' ? trials[i].position === trials[i - config.n].position : trials[i].letter === trials[i - config.n].letter) {
        responses.push({ trial: i, channel, reactionMs: 250 }, { trial: i, channel, reactionMs: 900 })
      }
    }
    responses.push({ trial: config.n, channel: 'audio', reactionMs: 3000 })
    const result = scoreRound(config, trials, responses)
    expect(result.score).toBe(100)
    expect(result.visual.meanHitReactionMs).toBe(250)
    expect(result.audio?.meanHitReactionMs).toBe(250)
  })
  it('penalizes every non-target response, including the final trial', () => {
    const trials = generateTrials(config, seededRandom(9))
    const responses = trials.flatMap((_, trial) => ['visual', 'audio'].map(channel => ({ trial, channel: channel as 'visual' | 'audio', reactionMs: 0 })))
    expect(scoreRound(config, trials, responses).visual).toMatchObject({ hits: 6, falseAlarms: 14, meanHitReactionMs: 0 })
    expect(scoreRound(config, trials, responses).score).toBe(0)
  })
})
describe('level recommendation', () => {
  it('requires both channels to pass and lets either channel lower N', () => {
    expect(recommendLevel(2, [2, 2])).toBe(3)
    expect(recommendLevel(2, [2, 3])).toBe(2)
    expect(recommendLevel(2, [0, 6])).toBe(1)
    expect(recommendLevel(1, [6])).toBe(1)
    expect(recommendLevel(9, [0])).toBe(9)
  })
})

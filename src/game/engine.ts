export type Channel = 'visual' | 'audio'
export interface SessionConfig { mode: 'visual' | 'dual'; n: number; gridSize: number; liveFeedback: boolean }
export interface Trial { position: number; letter?: string }
export interface ChannelResponse { trial: number; channel: Channel; reactionMs: number }
export interface ChannelResult { hits: number; misses: number; falseAlarms: number; correctRejections: number; hitRate: number; falseAlarmRate: number; meanHitReactionMs: number | null; score: number }
export interface SessionResult { visual: ChannelResult; audio?: ChannelResult; score: number; nextN: number }
export const LETTERS = ['B', 'F', 'H', 'J', 'M', 'Q', 'R', 'W'] as const
export const TRIAL_MS = 3000
export const CUE_MS = 500
export function seededRandom(seed: number): () => number {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296 }
}
export function generateTrials(config: SessionConfig, random = Math.random): Trial[] {
  const { n, gridSize, mode } = config
  if (!Number.isInteger(n) || n < 1 || n > 9 || !Number.isInteger(gridSize) || gridSize < 2 || gridSize > 6 || !['visual', 'dual'].includes(mode)) throw new Error('Unsupported session configuration')
  const positions = Array.from({ length: gridSize ** 2 }, (_, i) => i).filter(i => gridSize !== 3 || i !== 4)
  const masks = mode === 'dual' ? [...Array(2).fill(3), ...Array(4).fill(1), ...Array(4).fill(2), ...Array(10).fill(0)] as number[] : [...Array(6).fill(1), ...Array(14).fill(0)] as number[]
  for (let i = masks.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [masks[i], masks[j]] = [masks[j], masks[i]] }
  function pick<T>(items: readonly T[], excluded?: T): T { const candidates = items.filter(x => x !== excluded); return candidates[Math.floor(random() * candidates.length)] }
  const trials: Trial[] = []
  for (let i = 0; i < n + 20; i++) {
    const previous = trials[i - n], mask = i < n ? 0 : masks[i - n]
    trials.push({ position: mask & 1 ? previous.position : pick(positions, previous?.position), ...(mode === 'dual' ? { letter: mask & 2 ? previous.letter : pick(LETTERS, previous?.letter) } : {}) })
  }
  return trials
}
export function isTarget(trials: Trial[], index: number, n: number, channel: Channel): boolean {
  return index >= n && (channel === 'visual' ? trials[index].position === trials[index - n].position : trials[index].letter === trials[index - n].letter)
}
export function recommendLevel(n: number, errors: number[]): number { return Math.max(1, Math.min(9, n + (errors.every(x => x <= 2) ? 1 : errors.some(x => x >= 6) ? -1 : 0))) }
export function scoreRound(config: SessionConfig, trials: Trial[], responses: ChannelResponse[]): SessionResult {
  function channelScore(channel: Channel): ChannelResult {
    let hits = 0, misses = 0, falseAlarms = 0, correctRejections = 0
    const times: number[] = []
    for (let i = config.n; i < trials.length; i++) {
      const response = responses.find(r => r.trial === i && r.channel === channel && Number.isFinite(r.reactionMs) && r.reactionMs >= 0 && r.reactionMs < TRIAL_MS)
      const target = isTarget(trials, i, config.n, channel)
      if (target && response) { hits++; times.push(response.reactionMs) } else if (target) misses++; else if (response) falseAlarms++; else correctRejections++
    }
    const hitRate = hits + misses ? hits / (hits + misses) : 0
    const falseAlarmRate = falseAlarms + correctRejections ? falseAlarms / (falseAlarms + correctRejections) : 0
    return { hits, misses, falseAlarms, correctRejections, hitRate, falseAlarmRate, meanHitReactionMs: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null, score: 100 * (hitRate - falseAlarmRate) }
  }
  const visual = channelScore('visual'), audio = config.mode === 'dual' ? channelScore('audio') : undefined
  return { visual, audio, score: audio ? (visual.score + audio.score) / 2 : visual.score, nextN: recommendLevel(config.n, [visual, ...(audio ? [audio] : [])].map(c => c.misses + c.falseAlarms)) }
}

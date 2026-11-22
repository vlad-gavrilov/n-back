import { MAX_N, MIN_N, type Channel, type SessionConfig } from './config'
import { isTarget, type Trial } from './sequence'

export interface ChannelResponse {
  trial: number
  channel: Channel
  reactionMs: number
}

export interface ChannelResult {
  hits: number
  misses: number
  falseAlarms: number
  correctRejections: number
  hitRate: number
  falseAlarmRate: number
  meanHitReactionMs: number | null
  score: number
}

export interface SessionResult {
  visual: ChannelResult
  audio?: ChannelResult
  score: number
  nextN: number
}

export function recommendLevel(n: number, errors: readonly number[]): number {
  let next = n
  if (errors.every(count => count <= 2)) next++
  else if (errors.some(count => count >= 6)) next--
  return Math.max(MIN_N, Math.min(MAX_N, next))
}

function firstResponseTimes(channel: Channel, responses: readonly ChannelResponse[], trialMs: number) {
  const times = new Map<number, number>()
  for (const response of responses) {
    const { trial, reactionMs } = response
    if (response.channel !== channel || times.has(trial)) continue
    if (Number.isFinite(reactionMs) && reactionMs >= 0 && reactionMs < trialMs) {
      times.set(trial, reactionMs)
    }
  }
  return times
}

function scoreChannel(
  channel: Channel,
  config: SessionConfig,
  trials: readonly Trial[],
  responses: readonly ChannelResponse[],
): ChannelResult {
  const times = firstResponseTimes(channel, responses, config.trialMs)
  let targets = 0
  let nonTargets = 0
  let hits = 0
  let falseAlarms = 0
  let hitTimeMs = 0
  for (let index = config.n; index < trials.length; index++) {
    const time = times.get(index)
    if (isTarget(trials, index, config.n, channel)) {
      targets++
      if (time !== undefined) {
        hits++
        hitTimeMs += time
      }
    } else {
      nonTargets++
      if (time !== undefined) falseAlarms++
    }
  }
  const hitRate = targets ? hits / targets : 0
  const falseAlarmRate = nonTargets ? falseAlarms / nonTargets : 0
  return {
    hits,
    misses: targets - hits,
    falseAlarms,
    correctRejections: nonTargets - falseAlarms,
    hitRate,
    falseAlarmRate,
    meanHitReactionMs: hits ? hitTimeMs / hits : null,
    score: 100 * (hitRate - falseAlarmRate),
  }
}

export function scoreRound(
  config: SessionConfig,
  trials: readonly Trial[],
  responses: readonly ChannelResponse[],
): SessionResult {
  const visual = scoreChannel('visual', config, trials, responses)
  const audio = config.mode === 'dual' ? scoreChannel('audio', config, trials, responses) : undefined
  const errors = [visual.misses + visual.falseAlarms]
  if (audio) errors.push(audio.misses + audio.falseAlarms)
  const score = audio ? (visual.score + audio.score) / 2 : visual.score
  return { visual, audio, score: Math.max(0, score), nextN: recommendLevel(config.n, errors) }
}

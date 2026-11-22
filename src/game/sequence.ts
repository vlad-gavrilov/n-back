import {
  assertSupportedConfig, isFixationCell, LETTERS, SCORED_TRIALS,
  type Channel, type SessionConfig,
} from './config'

export interface Trial {
  position: number
  letter?: string
}

type Target = Channel | 'both' | 'none'
const TARGETS_PER_CHANNEL = 6
const SHARED_TARGETS = 2

// Mulberry32. Keep the draw order stable so a seed replays the same round.
export function seededRandom(seed: number): () => number {
  return () => {
    seed = ((seed | 0) + 0x6D2B79F5) | 0
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000
  }
}

function shuffledTargets(mode: SessionConfig['mode'], random: () => number): Target[] {
  const targets = Array<Target>(SCORED_TRIALS).fill('none')
  targets.fill('visual', 0, TARGETS_PER_CHANNEL)
  if (mode === 'dual') {
    const audioOnly = TARGETS_PER_CHANNEL - SHARED_TARGETS
    targets.fill('both', 0, SHARED_TARGETS)
    targets.fill('audio', TARGETS_PER_CHANNEL, TARGETS_PER_CHANNEL + audioOnly)
  }

  for (let last = targets.length - 1; last > 0; last--) {
    const chosen = Math.floor(random() * (last + 1))
    const swap = targets[last]
    targets[last] = targets[chosen]
    targets[chosen] = swap
  }
  return targets
}

function pickExcept<T>(choices: readonly T[], excluded: T | undefined, random: () => number): T {
  const eligible = choices.filter(choice => choice !== excluded)
  return eligible[Math.floor(random() * eligible.length)]
}

export function generateTrials(config: SessionConfig, random = Math.random): Trial[] {
  assertSupportedConfig(config)
  const { mode, n, gridSize } = config
  const positions = Array.from({ length: gridSize ** 2 }, (_, index) => index)
    .filter(index => !isFixationCell(gridSize, index))
  const targets = shuffledTargets(mode, random)
  const trials: Trial[] = []

  for (let index = 0; index < n + SCORED_TRIALS; index++) {
    const previous = trials[index - n]
    const target = targets[index - n]
    const trial: Trial = {
      position: target === 'visual' || target === 'both'
        ? previous.position
        : pickExcept(positions, previous?.position, random),
    }
    if (mode === 'dual') {
      trial.letter = target === 'audio' || target === 'both'
        ? previous.letter
        : pickExcept(LETTERS, previous?.letter, random)
    }
    trials.push(trial)
  }
  return trials
}

export function isTarget(trials: readonly Trial[], index: number, n: number, channel: Channel): boolean {
  if (index < n) return false
  const current = trials[index]
  const previous = trials[index - n]
  return channel === 'visual'
    ? current.position === previous.position
    : current.letter === previous.letter
}

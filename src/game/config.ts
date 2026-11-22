export type Channel = 'visual' | 'audio'

export interface SessionConfig {
  mode: 'visual' | 'dual'
  n: number
  gridSize: number
  liveFeedback: boolean
  trialMs: number
}

export const MIN_N = 1
export const MAX_N = 9
export const GRID_SIZES = [2, 3, 4, 5, 6]
export const TRIAL_MS_OPTIONS = [1000, 2000, 3000, 4000, 5000, 6000]
export const DEFAULT_TRIAL_MS = 3000
export const SCORED_TRIALS = 20
export const CUE_MS = 500
export const LETTERS = ['B', 'F', 'H', 'J', 'M', 'Q', 'R', 'W'] as const

export const DEFAULT_CONFIG: Readonly<SessionConfig> = {
  mode: 'visual',
  n: 2,
  gridSize: 3,
  liveFeedback: true,
  trialMs: DEFAULT_TRIAL_MS,
}

export function isFixationCell(gridSize: number, index: number): boolean {
  return gridSize === 3 && index === 4
}

export function assertSupportedConfig({ mode, n, gridSize, trialMs }: SessionConfig): void {
  if (
    (mode !== 'visual' && mode !== 'dual') ||
    !Number.isInteger(n) || n < MIN_N || n > MAX_N ||
    !GRID_SIZES.includes(gridSize) ||
    !TRIAL_MS_OPTIONS.includes(trialMs)
  ) {
    throw new Error('Unsupported session configuration')
  }
}

import { afterEach, expect, it, vi } from 'vitest'
import { DEFAULT_CONFIG } from '../game/config'
import { TrainingController } from './controller'

const dual = { ...DEFAULT_CONFIG, mode: 'dual' } as const

function deferred() {
  let resolve!: () => void
  let reject!: (reason: Error) => void
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

function setup() {
  vi.useFakeTimers()
  const player = {
    prepare: vi.fn<(signal?: AbortSignal) => Promise<void>>().mockResolvedValue(undefined),
    play: vi.fn<(letter: string, onEnded?: () => void) => void>(),
    stop: vi.fn(),
    dispose: vi.fn(),
    onInterrupted: () => {},
  }
  const trainer = new TrainingController(player)
  trainer.configure(dual)
  return { trainer, player }
}

afterEach(() => vi.useRealTimers())

it('keeps a new Visual round when a cancelled Dual preparation finishes', async () => {
  const { trainer, player } = setup()
  const slow = deferred()
  player.prepare.mockReturnValueOnce(slow.promise)
  const previous = trainer.start(3)
  const signal = player.prepare.mock.calls[0][0]

  trainer.configure(DEFAULT_CONFIG)
  expect(signal?.aborted).toBe(true)
  await trainer.start()
  await vi.advanceTimersByTimeAsync(9000)
  const running = trainer.getSnapshot()
  expect(running.view.phase).toBe('running')
  slow.resolve()
  await previous
  expect(trainer.getSnapshot()).toBe(running)
  expect(player.play).not.toHaveBeenCalled()
})

it('ignores an error from a hidden page after a newer sound test succeeds', async () => {
  const { trainer, player } = setup()
  const slow = deferred()
  player.prepare.mockReturnValueOnce(slow.promise)
  const previous = trainer.testSound()
  trainer.interrupt('hidden')
  await trainer.testSound()
  player.play.mock.lastCall?.[1]?.()
  slow.reject(new Error('Old fetch failed'))
  await previous
  expect(trainer.getSnapshot()).toMatchObject({ audio: { phase: 'success', purpose: 'test' }, view: { phase: 'idle' } })
  expect(player.play).toHaveBeenCalledExactlyOnceWith('B', expect.any(Function))
})

it('lets the user retry a sound test interrupted as the sample starts', async () => {
  const { trainer, player } = setup()
  player.play.mockImplementationOnce(() => player.onInterrupted())
  await trainer.testSound()
  expect(trainer.getSnapshot().audio).toMatchObject({ phase: 'error', purpose: 'test', code: 'blocked' })
  await trainer.retry()
  player.play.mock.lastCall?.[1]?.()
  expect(trainer.getSnapshot()).toMatchObject({ audio: { phase: 'success' }, view: { phase: 'idle' } })
})

it('retains the failed level while the user leaves the page to restore audio', async () => {
  const { trainer, player } = setup()
  const preparing = deferred()
  player.prepare.mockReturnValueOnce(preparing.promise)
  const start = trainer.start(3)
  player.onInterrupted()
  const failed = trainer.getSnapshot()
  expect(failed.audio).toEqual({ phase: 'error', purpose: 'session', n: 3, code: 'blocked' })
  player.onInterrupted()
  trainer.interrupt('hidden')
  trainer.interrupt('orientation')
  preparing.resolve()
  await start
  expect(trainer.getSnapshot()).toBe(failed)
  await trainer.retry()
  expect(trainer.getSnapshot()).toMatchObject({ config: { n: 3 }, view: { phase: 'countdown' } })
})

it('preserves a fresh preparation started from the interruption notification', async () => {
  const { trainer, player } = setup()
  await trainer.start()
  const preparing = deferred()
  player.prepare.mockReturnValueOnce(preparing.promise)
  let restart: Promise<void> | undefined
  const unsubscribe = trainer.subscribe(() => {
    if (trainer.getSnapshot().view.phase === 'interrupted') {
      unsubscribe()
      restart = trainer.start(3)
    }
  })
  trainer.interrupt('stopped')
  expect(trainer.getSnapshot().audio).toEqual({ phase: 'loading', purpose: 'session', n: 3 })
  preparing.resolve()
  await restart
  expect(trainer.getSnapshot()).toMatchObject({ config: { n: 3 }, view: { phase: 'countdown' } })
})

it('ignores duplicate start and sound commands during preparation and play', async () => {
  const { trainer, player } = setup()
  const slow = deferred()
  player.prepare.mockReturnValueOnce(slow.promise)
  const start = trainer.start(3)
  await trainer.testSound()
  await trainer.start(4)
  slow.resolve()
  await start
  await trainer.start(5)
  await trainer.testSound()
  expect(player.prepare).toHaveBeenCalledTimes(1)
  expect(trainer.getSnapshot()).toMatchObject({ config: { n: 3 }, view: { phase: 'countdown' } })
})

it('disposes pending work without publishing a late countdown', async () => {
  const { trainer, player } = setup()
  const slow = deferred()
  player.prepare.mockReturnValueOnce(slow.promise)
  const start = trainer.start()
  trainer.dispose()
  expect(player.prepare.mock.calls[0][0]?.aborted).toBe(true)
  slow.resolve()
  await start
  expect(player.dispose).toHaveBeenCalledOnce()
  expect(trainer.getSnapshot()).toMatchObject({ audio: { phase: 'idle' }, view: { phase: 'idle' } })
  expect(vi.getTimerCount()).toBe(0)
})

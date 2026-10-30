import { afterEach, expect, it, vi } from 'vitest'
import { AudioPlayer } from './player'
import { LETTERS } from '../game/engine'
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
it('times out a stalled load so the user can retry or switch mode', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('AudioContext', class { state = 'running'; resume = async () => {}; onstatechange = null })
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
  const rejected = expect(new AudioPlayer().prepare()).rejects.toMatchObject({ code: 'timeout' })
  await vi.advanceTimersByTimeAsync(8001)
  await rejected
})
it('also bounds a suspended audio context that never resumes', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('AudioContext', class { state = 'suspended'; resume = () => new Promise<void>(() => {}); onstatechange = null })
  vi.stubGlobal('fetch', vi.fn())
  const rejected = expect(new AudioPlayer().prepare()).rejects.toMatchObject({ code: 'timeout' })
  await vi.advanceTimersByTimeAsync(8001)
  await rejected
  expect(fetch).not.toHaveBeenCalled()
})
it('loads the versioned letter set once, decodes every clip and plays a cached letter', async () => {
  const decode = vi.fn(async () => ({}))
  const source = { connect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null }
  vi.stubGlobal('AudioContext', class {
    state = 'running'; destination = {}; onstatechange = null
    resume = async () => {}
    decodeAudioData = decode
    createBufferSource = () => source
  })
  const load = vi.fn<typeof fetch>().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) } as Response)
  vi.stubGlobal('fetch', load)
  const player = new AudioPlayer()
  await player.prepare()
  expect(load.mock.calls.map(call => String(call[0]))).toEqual(LETTERS.map(letter => `/audio/${letter}.wav?v=letters-v2`))
  expect(decode).toHaveBeenCalledTimes(LETTERS.length)
  await player.prepare()
  expect(load).toHaveBeenCalledTimes(LETTERS.length)
  expect(decode).toHaveBeenCalledTimes(LETTERS.length)
  player.play('B')
  expect(source.start).toHaveBeenCalledOnce()
})

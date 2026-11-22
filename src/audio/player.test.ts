import { afterEach, expect, it, vi } from 'vitest'
import { LETTERS } from '../game/config'
import { AudioPlayer } from './player'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

class SilentSource {
  buffer: object | null = null
  onended: (() => void) | null = null
  connect = vi.fn()
  disconnect = vi.fn()
  start = vi.fn()
  stop = vi.fn()
}

function stubAudio(initialState: AudioContextState = 'running') {
  const resume = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
  const decode = vi.fn<(data: ArrayBuffer) => Promise<object>>().mockResolvedValue({})
  const createSource = vi.fn(() => new SilentSource())
  const contexts: SilentContext[] = []
  class SilentContext {
    state = initialState
    destination = {}
    onstatechange: (() => void) | null = null
    constructor() { contexts.push(this) }
    resume = resume
    decodeAudioData = decode
    createBufferSource = createSource
    close = vi.fn(async () => {
      this.state = 'closed'
      this.onstatechange?.()
    })
  }
  const load = vi.fn<typeof fetch>(async () => new Response(new ArrayBuffer(4)))
  vi.stubGlobal('AudioContext', SilentContext)
  vi.stubGlobal('fetch', load)
  return { contexts, resume, decode, createSource, load }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('times out a stalled load so the user can retry or switch mode', async () => {
  vi.useFakeTimers()
  const { load } = stubAudio()
  load.mockReturnValue(new Promise(() => {}))
  const rejected = expect(new AudioPlayer().prepare()).rejects.toMatchObject({ code: 'timeout' })
  await vi.advanceTimersByTimeAsync(8000)
  await rejected
})

it('also bounds a suspended audio context that never resumes', async () => {
  vi.useFakeTimers()
  const { resume, load } = stubAudio('suspended')
  resume.mockReturnValue(new Promise(() => {}))
  const rejected = expect(new AudioPlayer().prepare()).rejects.toMatchObject({ code: 'timeout' })
  await vi.advanceTimersByTimeAsync(8000)
  await rejected
  expect(load).not.toHaveBeenCalled()
})

it('resumes immediately, loads the versioned letter set once and plays a cached letter', async () => {
  const { load, resume, decode, createSource } = stubAudio()
  const player = new AudioPlayer()
  const ready = player.prepare()
  expect(resume).toHaveBeenCalledOnce()
  await ready
  expect(load.mock.calls.map(([url]) => String(url))).toEqual(LETTERS.map(letter => `/audio/${letter}.wav?v=letters-v2`))
  await player.prepare()
  expect(load).toHaveBeenCalledTimes(LETTERS.length)
  expect(decode).toHaveBeenCalledTimes(LETTERS.length)
  player.play('B')
  expect(createSource.mock.results[0].value.start).toHaveBeenCalledOnce()
})

it('skips context creation when preparation is already cancelled', async () => {
  const { contexts } = stubAudio()
  const cancel = new AbortController()
  cancel.abort()
  await expect(new AudioPlayer().prepare(cancel.signal)).rejects.toBe(cancel.signal.reason)
  expect(contexts).toHaveLength(0)
})

it('aborts a pending fetch immediately and discards a late response before decoding it', async () => {
  vi.useFakeTimers()
  const { load, decode } = stubAudio()
  const downloading = deferred<void>()
  load.mockImplementation(async () => {
    await downloading.promise
    return new Response(new ArrayBuffer(4))
  })
  const cancel = new AbortController()
  const failed = vi.fn()
  const player = new AudioPlayer()
  void player.prepare(cancel.signal).catch(failed)
  await vi.advanceTimersByTimeAsync(0)
  cancel.abort()
  await vi.advanceTimersByTimeAsync(0)
  expect(failed).toHaveBeenCalledWith(cancel.signal.reason)
  expect(load.mock.calls[0][1]?.signal?.aborted).toBe(true)
  downloading.resolve()
  await vi.advanceTimersByTimeAsync(0)
  expect(decode).not.toHaveBeenCalled()
  await player.prepare()
  expect(decode).toHaveBeenCalledTimes(LETTERS.length)
})

it.each(['cancel', 'timeout'])('keeps the retried recordings when decoding finishes after %s', async reason => {
  vi.useFakeTimers()
  const { decode, createSource } = stubAudio()
  const decoding = deferred<object>()
  decode.mockReturnValue(decoding.promise)
  const cancel = new AbortController()
  const player = new AudioPlayer()
  const failed = vi.fn()
  void player.prepare(cancel.signal).catch(failed)
  await vi.advanceTimersByTimeAsync(0)
  expect(decode).toHaveBeenCalledTimes(LETTERS.length)
  if (reason === 'cancel') cancel.abort()
  await vi.advanceTimersByTimeAsync(reason === 'cancel' ? 0 : 8000)
  expect(failed).toHaveBeenCalledWith(reason === 'cancel' ? cancel.signal.reason : expect.objectContaining({ code: 'timeout' }))

  const fresh = {}
  decode.mockResolvedValue(fresh)
  await player.prepare()
  decoding.resolve({})
  await vi.advanceTimersByTimeAsync(0)
  player.play('B')
  expect(createSource.mock.results[0].value.buffer).toBe(fresh)
})

it('reports a browser refusal to resume as blocked', async () => {
  const { resume, load } = stubAudio('suspended')
  resume.mockRejectedValue(new DOMException('User gesture required', 'NotAllowedError'))
  await expect(new AudioPlayer().prepare()).rejects.toMatchObject({ code: 'blocked' })
  expect(load).not.toHaveBeenCalled()
})

it('can prepare again when a previously running context has closed', async () => {
  const { contexts, createSource } = stubAudio()
  const player = new AudioPlayer()
  await player.prepare()
  await contexts[0].close()
  await player.prepare()
  player.play('B')
  expect(createSource.mock.results[0].value.start).toHaveBeenCalledOnce()
})

it.each(['network', 'decode'])('reports a %s failure as a load error and allows a retry', async stage => {
  const { load, decode, createSource } = stubAudio()
  const failure = new Error(stage)
  if (stage === 'network') load.mockRejectedValueOnce(failure)
  else decode.mockRejectedValueOnce(failure)
  const player = new AudioPlayer()
  await expect(player.prepare()).rejects.toMatchObject({ code: 'load' })
  await player.prepare()
  player.play('B')
  expect(createSource.mock.results[0].value.start).toHaveBeenCalledOnce()
})

it('cancels an outstanding preparation on disposal even if the context never resumes', async () => {
  vi.useFakeTimers()
  const { resume, load } = stubAudio()
  const resuming = deferred<void>()
  resume.mockReturnValueOnce(resuming.promise)
  const player = new AudioPlayer()
  const preparing = player.prepare()
  player.dispose()
  await expect(preparing).rejects.toMatchObject({ name: 'AbortError' })
  resuming.resolve()
  await vi.advanceTimersByTimeAsync(0)
  expect(load).not.toHaveBeenCalled()
})

it('releases the context and its sources once and ignores old events after reuse', async () => {
  const { contexts, createSource, load } = stubAudio()
  const player = new AudioPlayer()
  player.onInterrupted = vi.fn()
  await player.prepare()
  player.play('B')
  player.play('F')
  const [ended, playing] = createSource.mock.results.map(result => result.value)
  const oldContext = contexts[0]
  const oldStateChange = oldContext.onstatechange
  const oldEnded = playing.onended
  ended.onended?.()

  player.dispose()
  player.dispose()
  oldEnded?.()
  expect(ended.stop).not.toHaveBeenCalled()
  expect(ended.disconnect).toHaveBeenCalledOnce()
  expect(playing.stop).toHaveBeenCalledOnce()
  expect(playing.disconnect).toHaveBeenCalledOnce()
  expect(playing.onended).toBeNull()
  expect(oldContext.onstatechange).toBeNull()
  expect(oldContext.close).toHaveBeenCalledOnce()

  await player.prepare()
  expect(contexts).toHaveLength(2)
  expect(load).toHaveBeenCalledTimes(2 * LETTERS.length)
  contexts[1].state = 'suspended'
  oldStateChange?.()
  expect(player.onInterrupted).not.toHaveBeenCalled()
  contexts[1].onstatechange?.()
  expect(player.onInterrupted).toHaveBeenCalledOnce()
})

it('reports a playback failure through the interruption callback and releases the failed source', async () => {
  const { createSource } = stubAudio()
  const source = new SilentSource()
  source.start.mockImplementation(() => { throw new Error('Output unavailable') })
  createSource.mockReturnValueOnce(source)
  const player = new AudioPlayer()
  player.onInterrupted = vi.fn()
  await player.prepare()
  player.play('B')
  player.stop()
  expect(player.onInterrupted).toHaveBeenCalledOnce()
  expect(source.disconnect).toHaveBeenCalledOnce()
  expect(source.stop).not.toHaveBeenCalled()
})

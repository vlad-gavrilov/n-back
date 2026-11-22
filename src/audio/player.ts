import { LETTERS } from '../game/config'

export type AudioErrorCode = 'timeout' | 'load' | 'blocked' | 'unknown'

export class AudioPreparationError extends Error {
  constructor(readonly code: AudioErrorCode, options?: ErrorOptions) {
    super(code, options)
    this.name = 'AudioPreparationError'
  }
}

export class AudioPlayer {
  private context?: AudioContext
  private readonly buffers = new Map<string, AudioBuffer>()
  private readonly sources = new Set<AudioBufferSourceNode>()
  private readonly preparations = new Set<AbortController>()
  onInterrupted = () => {}

  async prepare(signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted()
    if (this.context?.state === 'closed') this.dispose()

    const attempt = new AbortController()
    this.preparations.add(attempt)
    const cancel = () => attempt.abort(signal?.reason)
    signal?.addEventListener('abort', cancel, { once: true })
    const timer = setTimeout(() => attempt.abort(new AudioPreparationError('timeout')), 8000)
    // resume() and decodeAudioData() can remain pending after cancellation.
    const cancelled = new Promise<never>((_, reject) => {
      attempt.signal.addEventListener('abort', () => reject(attempt.signal.reason), { once: true })
    })
    try {
      await Promise.race([this.resumeAndLoad(attempt.signal), cancelled])
      attempt.signal.throwIfAborted()
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', cancel)
      this.preparations.delete(attempt)
      attempt.abort()
    }
  }

  private getContext(): AudioContext {
    if (this.context) return this.context
    const context = new AudioContext()
    context.onstatechange = () => {
      if (this.context === context && context.state !== 'running') this.onInterrupted()
    }
    this.context = context
    return context
  }

  private async resumeAndLoad(signal: AbortSignal) {
    let context: AudioContext
    try {
      context = this.getContext()
      await context.resume()
    } catch (cause) {
      signal.throwIfAborted()
      throw new AudioPreparationError('blocked', { cause })
    }
    signal.throwIfAborted()
    if (context.state !== 'running') throw new AudioPreparationError('blocked')
    try {
      await Promise.all(LETTERS.map(letter => this.loadLetter(context, letter, signal)))
    } catch (cause) {
      signal.throwIfAborted()
      throw new AudioPreparationError('load', { cause })
    }
    if (context.state !== 'running') throw new AudioPreparationError('blocked')
  }

  private async loadLetter(context: AudioContext, letter: string, signal: AbortSignal) {
    if (this.buffers.has(letter)) return
    const response = await fetch(`${import.meta.env.BASE_URL}audio/${letter}.wav?v=letters-v2`, { signal })
    signal.throwIfAborted()
    if (!response.ok) throw new Error(`HTTP ${response.status} loading ${letter}`)
    const data = await response.arrayBuffer()
    signal.throwIfAborted()
    const buffer = await context.decodeAudioData(data)
    signal.throwIfAborted()
    this.buffers.set(letter, buffer)
  }

  play(letter: string): void {
    const context = this.context
    const buffer = this.buffers.get(letter)
    if (!context || context.state !== 'running' || !buffer) {
      this.onInterrupted()
      return
    }

    let source: AudioBufferSourceNode | undefined
    try {
      source = context.createBufferSource()
      this.sources.add(source)
      source.buffer = buffer
      source.connect(context.destination)
      source.onended = this.releaseSource.bind(this, source)
      source.start()
    } catch {
      if (source) this.releaseSource(source)
      this.onInterrupted()
    }
  }

  private releaseSource(source: AudioBufferSourceNode) {
    if (!this.sources.delete(source)) return
    source.onended = null
    source.disconnect()
  }

  stop(): void {
    for (const source of this.sources) {
      this.releaseSource(source)
      try { source.stop() } catch { /* The source has already stopped. */ }
    }
  }

  dispose(): void {
    const context = this.context
    this.context = undefined
    if (context) context.onstatechange = null
    for (const attempt of this.preparations) attempt.abort()
    this.stop()
    this.buffers.clear()
    if (context && context.state !== 'closed') void context.close().catch(() => {})
  }
}

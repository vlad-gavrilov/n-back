import { LETTERS } from '../game/engine'
export type AudioErrorCode = 'timeout' | 'load' | 'blocked' | 'unknown'
export class AudioPreparationError extends Error { constructor(readonly code: AudioErrorCode) { super(code); this.name = 'AudioPreparationError' } }
export class AudioPlayer {
  private context?: AudioContext
  private buffers = new Map<string, AudioBuffer>()
  private sources = new Set<AudioBufferSourceNode>()
  onInterrupted = () => {}
  async prepare() {
    this.context ??= new AudioContext()
    this.context.onstatechange = () => { if (this.context?.state !== 'running') this.onInterrupted() }
    const context = this.context
    const controller = new AbortController()
    let timeout: ReturnType<typeof setTimeout> | undefined
    const deadline = new Promise<never>((_, reject) => { timeout = setTimeout(() => {
      reject(new AudioPreparationError('timeout'))
      controller.abort()
    }, 8000) })
    try {
      await Promise.race([(async () => {
        await context.resume()
        if (controller.signal.aborted) return
        await Promise.all(LETTERS.map(async letter => {
          if (this.buffers.has(letter)) return
          const response = await fetch(`${import.meta.env.BASE_URL}audio/${letter}.wav?v=letters-v2`, { signal: controller.signal })
          if (!response.ok) throw new AudioPreparationError('load')
          const buffer = await context.decodeAudioData(await response.arrayBuffer())
          if (!controller.signal.aborted) this.buffers.set(letter, buffer)
        }))
      })(), deadline])
    } finally {
      clearTimeout(timeout)
      controller.abort()
    }
    if (context.state !== 'running') throw new AudioPreparationError('blocked')
  }
  play(letter: string) {
    const context = this.context, buffer = this.buffers.get(letter)
    if (!context || context.state !== 'running' || !buffer) { this.onInterrupted(); return }
    const source = context.createBufferSource(); source.buffer = buffer; source.connect(context.destination)
    this.sources.add(source); source.onended = () => this.sources.delete(source); source.start()
  }
  stop() { for (const source of this.sources) { source.onended = null; source.stop() }; this.sources.clear() }
}

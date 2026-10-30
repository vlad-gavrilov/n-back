import { type Channel, type SessionConfig } from '../game/engine'

const fallbackCodes: Record<string, string> = { a: 'KeyA', 'ф': 'KeyA', v: 'KeyV', 'м': 'KeyV', ' ': 'Space', spacebar: 'Space' }

export function getResponseChannel(event: Pick<KeyboardEvent, 'code' | 'key'>, mode: SessionConfig['mode']): Channel | null {
  const code = !event.code || event.code === 'Unidentified' ? fallbackCodes[event.key.toLowerCase()] : event.code
  if (mode === 'visual') return code === 'Space' ? 'visual' : null
  return code === 'KeyA' ? 'audio' : code === 'KeyV' ? 'visual' : null
}

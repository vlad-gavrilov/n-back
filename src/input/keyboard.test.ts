import { describe, expect, it } from 'vitest'
import { getResponseChannel } from './keyboard'

describe('physical response keys', () => {
  it.each([
    ['a', 'KeyA', 'audio'], ['ф', 'KeyA', 'audio'], ['Ф', 'KeyA', 'audio'],
    ['v', 'KeyV', 'visual'], ['м', 'KeyV', 'visual'], ['М', 'KeyV', 'visual'],
    ['a', 'KeyV', 'visual'], ['а', 'KeyF', null], ['v', 'KeyB', null],
  ] as const)('maps key=%s code=%s using the physical code', (key, code, channel) => {
    expect(getResponseChannel({ key, code }, 'dual')).toBe(channel)
  })
  it.each(['', 'Unidentified'])('uses a narrow character fallback for code=%s', code => {
    for (const key of ['a', 'A', 'ф', 'Ф']) expect(getResponseChannel({ key, code }, 'dual')).toBe('audio')
    for (const key of ['v', 'V', 'м', 'М']) expect(getResponseChannel({ key, code }, 'dual')).toBe('visual')
    for (const key of ['а', 'в', 'q', 'Enter', '']) expect(getResponseChannel({ key, code }, 'dual')).toBeNull()
  })
  it('keeps Visual on Space and Dual on A/V', () => {
    expect(getResponseChannel({ key: ' ', code: 'Space' }, 'visual')).toBe('visual')
    expect(getResponseChannel({ key: ' ', code: '' }, 'visual')).toBe('visual')
    expect(getResponseChannel({ key: ' ', code: 'Space' }, 'dual')).toBeNull()
    expect(getResponseChannel({ key: 'ф', code: 'KeyA' }, 'visual')).toBeNull()
    expect(getResponseChannel({ key: 'м', code: 'KeyV' }, 'visual')).toBeNull()
  })
})

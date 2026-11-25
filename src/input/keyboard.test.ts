import { describe, expect, it } from 'vitest'
import { getResponseChannel } from './keyboard'

describe('physical response keys', () => {
  it.each([
    ['f', 'KeyF', 'visual'], ['а', 'KeyF', 'visual'], ['А', 'KeyF', 'visual'],
    ['j', 'KeyJ', 'audio'], ['о', 'KeyJ', 'audio'], ['О', 'KeyJ', 'audio'],
    ['j', 'KeyF', 'visual'], ['f', 'KeyB', null],
    ['a', 'KeyA', null], ['v', 'KeyV', null],
  ] as const)('maps key=%s code=%s using the physical code', (key, code, channel) => {
    expect(getResponseChannel({ key, code }, 'dual')).toBe(channel)
  })
  it.each(['', 'Unidentified'])('uses a narrow character fallback for code=%s', code => {
    for (const key of ['f', 'F', 'а', 'А']) expect(getResponseChannel({ key, code }, 'dual')).toBe('visual')
    for (const key of ['j', 'J', 'о', 'О']) expect(getResponseChannel({ key, code }, 'dual')).toBe('audio')
    for (const key of ['a', 'v', 'ф', 'м', 'o', 'q', 'Enter', '']) expect(getResponseChannel({ key, code }, 'dual')).toBeNull()
  })
  it('keeps Visual on Space and Dual on F/J', () => {
    expect(getResponseChannel({ key: ' ', code: 'Space' }, 'visual')).toBe('visual')
    expect(getResponseChannel({ key: ' ', code: '' }, 'visual')).toBe('visual')
    expect(getResponseChannel({ key: ' ', code: 'Space' }, 'dual')).toBeNull()
    expect(getResponseChannel({ key: 'а', code: 'KeyF' }, 'visual')).toBeNull()
    expect(getResponseChannel({ key: 'о', code: 'KeyJ' }, 'visual')).toBeNull()
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { inputTime } from './time'

function eventAt(timeStamp: number): Event {
  return Object.defineProperty(new Event('keydown'), 'timeStamp', { value: timeStamp })
}

describe('DOM input timestamps', () => {
  beforeEach(() => { vi.spyOn(performance, 'now').mockReturnValue(500) })
  afterEach(() => { vi.restoreAllMocks() })

  it.each([0, -1, NaN, Infinity, -Infinity, 501, performance.timeOrigin + 501])(
    'uses the current monotonic time for an unusable timestamp (%s)', timeStamp => {
      expect(inputTime(eventAt(timeStamp))).toBe(500)
    },
  )

  it('retains the original press time for delayed monotonic and epoch-based events', () => {
    expect(inputTime(eventAt(120.5))).toBe(120.5)
    expect(inputTime(eventAt(performance.timeOrigin + 120.5))).toBe(120.5)
  })
})

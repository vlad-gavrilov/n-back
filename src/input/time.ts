// Session deadlines use performance.now(). Older DOM implementations may supply epoch milliseconds.
export function inputTime({ timeStamp }: Event): number {
  const now = performance.now()
  if (!Number.isFinite(timeStamp) || timeStamp <= 0) return now
  const occurredAt = timeStamp >= performance.timeOrigin ? timeStamp - performance.timeOrigin : timeStamp
  return Math.min(occurredAt, now)
}

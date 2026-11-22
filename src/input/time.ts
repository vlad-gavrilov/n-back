// Session deadlines use performance.now(). Older DOM implementations may supply epoch milliseconds.
export function inputTime(event: Event): number {
  return event.timeStamp >= performance.timeOrigin ? event.timeStamp - performance.timeOrigin : event.timeStamp
}

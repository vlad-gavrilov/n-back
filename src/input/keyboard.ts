import type { Channel, SessionConfig } from '../game/config'
import { inputTime } from './time'

const fallbackCodes: Record<string, string> = {
  f: 'KeyF', 'а': 'KeyF',
  j: 'KeyJ', 'о': 'KeyJ',
  ' ': 'Space', spacebar: 'Space',
}
const editable = 'input,select,textarea,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'
const buttonControls = 'button,summary,[role="button"]'
type Key = Pick<KeyboardEvent, 'code' | 'key'>

function hasPhysicalCode(event: Key): boolean {
  return Boolean(event.code && event.code !== 'Unidentified')
}

export function getResponseChannel(event: Key, mode: SessionConfig['mode']): Channel | null {
  const code = hasPhysicalCode(event) ? event.code : fallbackCodes[event.key.toLowerCase()]
  if (mode === 'visual') return code === 'Space' ? 'visual' : null
  return code === 'KeyF' ? 'visual' : code === 'KeyJ' ? 'audio' : null
}

function isActivationKey(event: Key): boolean {
  return hasPhysicalCode(event)
    ? ['Space', 'Enter', 'NumpadEnter'].includes(event.code)
    : [' ', 'Spacebar', 'Enter'].includes(event.key)
}

export function listenForResponseKeys(mode: SessionConfig['mode'], respond: (channel: Channel, occurredAt: number) => void) {
  function handleKeyDown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.isComposing) return
    const target = event.target instanceof Element ? event.target : null
    if (target?.closest(editable)) return

    const activation = isActivationKey(event)
    const responseButton = target?.closest<HTMLButtonElement>('button[data-channel]')
    const activatesResponse = activation && responseButton
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
      if (activatesResponse) event.preventDefault()
      return
    }

    const channel = getResponseChannel(event, mode)
    if (event.repeat) {
      if (channel || activatesResponse) event.preventDefault()
      return
    }
    if (activatesResponse) {
      // Answer on keydown and suppress the native click on release, possibly in the next trial.
      event.preventDefault()
      const focusedChannel = responseButton.dataset.channel
      if (focusedChannel === 'visual' || focusedChannel === 'audio') respond(focusedChannel, inputTime(event))
      return
    }
    if (activation && target?.closest(buttonControls)) return
    if (channel) {
      event.preventDefault()
      respond(channel, inputTime(event))
    }
  }

  document.addEventListener('keydown', handleKeyDown)
  return () => document.removeEventListener('keydown', handleKeyDown)
}

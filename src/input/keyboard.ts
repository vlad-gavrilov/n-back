import type { Channel, SessionConfig } from '../game/config'

const fallbackCodes: Record<string, string> = { a: 'KeyA', 'ф': 'KeyA', v: 'KeyV', 'м': 'KeyV', ' ': 'Space', spacebar: 'Space' }
const editable = 'input,select,textarea,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'
const interactive = 'button,a[href],summary,[role="button"],[role="link"]'
type Key = Pick<KeyboardEvent, 'code' | 'key'>

function hasPhysicalCode(event: Key): boolean {
  return Boolean(event.code && event.code !== 'Unidentified')
}

export function getResponseChannel(event: Key, mode: SessionConfig['mode']): Channel | null {
  const code = hasPhysicalCode(event) ? event.code : fallbackCodes[event.key.toLowerCase()]
  if (mode === 'visual') return code === 'Space' ? 'visual' : null
  return code === 'KeyA' ? 'audio' : code === 'KeyV' ? 'visual' : null
}

function isActivationKey(event: Key): boolean {
  return hasPhysicalCode(event)
    ? ['Space', 'Enter', 'NumpadEnter'].includes(event.code)
    : [' ', 'Spacebar', 'Enter'].includes(event.key)
}

export function listenForResponseKeys(mode: SessionConfig['mode'], respond: (channel: Channel) => void) {
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
      if (focusedChannel === 'visual' || focusedChannel === 'audio') respond(focusedChannel)
      return
    }
    if (activation && target?.closest(interactive)) return
    if (channel) {
      event.preventDefault()
      respond(channel)
    }
  }

  document.addEventListener('keydown', handleKeyDown)
  return () => document.removeEventListener('keydown', handleKeyDown)
}

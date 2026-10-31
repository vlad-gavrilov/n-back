// Track actual input so touch devices with a keyboard retain visible keyboard focus
export function installFocusModality() {
  const root = document.documentElement
  const pointer = () => { root.dataset.inputModality = 'pointer' }
  const keyboard = (event: KeyboardEvent) => {
    if (!event.isComposing && !['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) root.dataset.inputModality = 'keyboard'
  }
  document.addEventListener('pointerdown', pointer, true)
  document.addEventListener('keydown', keyboard, true)
}

import { useEffect, useState, useSyncExternalStore } from 'react'
import { listenForResponseKeys } from '../input/keyboard'
import { TrainingController } from './controller'

export function useTraining(dialogOpen: boolean) {
  const [controller] = useState(() => new TrainingController())
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot)

  useEffect(() => {
    const orientation = screen.orientation
    const orientationTarget = orientation ?? window
    const orientationEvent = orientation ? 'change' : 'orientationchange'
    const onOrientation = () => controller.interrupt('orientation')
    const onVisibility = () => { if (document.hidden) controller.interrupt('hidden') }
    document.addEventListener('visibilitychange', onVisibility)
    orientationTarget.addEventListener(orientationEvent, onOrientation)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      orientationTarget.removeEventListener(orientationEvent, onOrientation)
      controller.dispose()
    }
  }, [controller])

  useEffect(() => {
    if (state.view.phase === 'running' && !dialogOpen) {
      return listenForResponseKeys(state.config.mode, controller.respond)
    }
  }, [controller, dialogOpen, state.view.phase, state.config.mode])

  return { state, controller }
}

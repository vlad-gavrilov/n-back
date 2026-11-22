import { useEffect, useState, useSyncExternalStore } from 'react'
import { listenForResponseKeys } from '../input/keyboard'
import { TrainingController } from './controller'

export function useTraining(dialogOpen: boolean) {
  const [controller] = useState(() => new TrainingController())
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot)

  useEffect(() => {
    const orientation = screen.orientation
    const onOrientation = () => controller.interrupt('orientation')
    const onVisibility = () => { if (document.hidden) controller.interrupt('hidden') }
    document.addEventListener('visibilitychange', onVisibility)
    orientation?.addEventListener('change', onOrientation)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      orientation?.removeEventListener('change', onOrientation)
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

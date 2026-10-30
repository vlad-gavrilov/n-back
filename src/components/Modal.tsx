import { useEffect, useRef, type PointerEvent, type ReactNode, type RefObject } from 'react'
import { type Messages } from '../i18n'

const lockedProperties = ['position', 'top', 'left', 'width', 'overflow', 'padding-right'] as const

export function Modal({ title, children, close, t, languageControl, fallbackFocusRef }: {
  title: string
  children: ReactNode
  close: () => void
  t: Messages
  languageControl: ReactNode
  fallbackFocusRef: RefObject<HTMLElement | null>
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const outsidePointer = useRef<number | null>(null)

  useEffect(() => {
    const dialog = ref.current!
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const { scrollX, scrollY } = window
    const body = document.body
    const savedStyles = lockedProperties.map(property => [property, body.style.getPropertyValue(property), body.style.getPropertyPriority(property)] as const)
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    const paddingRight = Number.parseFloat(getComputedStyle(body).paddingRight) || 0
    body.style.position = 'fixed'
    body.style.top = `${-scrollY}px`
    body.style.left = `${-scrollX}px`
    body.style.width = '100%'
    body.style.overflow = 'hidden'
    body.style.paddingRight = `${paddingRight + scrollbarWidth}px`
    dialog.showModal()

    return () => {
      outsidePointer.current = null
      dialog.close()
      for (const [property, value, priority] of savedStyles) {
        if (value) body.style.setProperty(property, value, priority)
        else body.style.removeProperty(property)
      }
      const target = opener?.isConnected && opener !== body && !opener.matches(':disabled, [aria-disabled="true"]') && opener.getClientRects().length ? opener : fallbackFocusRef.current
      target?.focus({ preventScroll: true })
      window.scrollTo(scrollX, scrollY)
    }
  }, [fallbackFocusRef])

  function outside(event: PointerEvent<HTMLDialogElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    return event.target === event.currentTarget && (event.clientX < box.left || event.clientX >= box.right || event.clientY < box.top || event.clientY >= box.bottom)
  }

  return <dialog ref={ref} aria-labelledby="dialog-title"
    onCancel={event => { event.preventDefault(); close() }}
    onPointerDown={event => { outsidePointer.current = event.isPrimary && event.button === 0 && outside(event) ? event.pointerId : null }}
    onPointerUp={event => {
      const startedOutside = outsidePointer.current === event.pointerId
      outsidePointer.current = null
      if (startedOutside && outside(event)) close()
    }}
    onPointerCancel={() => { outsidePointer.current = null }}>
    <div className="dialog-header"><h2 id="dialog-title">{title}</h2>{languageControl}<button onClick={close} aria-label={t.close} className="icon-button">×</button></div>
    {children}
  </dialog>
}

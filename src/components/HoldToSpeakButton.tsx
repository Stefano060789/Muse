import { useEffect, useRef, type CSSProperties, type PointerEvent, type KeyboardEvent } from 'react'

export default function HoldToSpeakButton({
  label = 'Hold to speak',
  releaseLabel = 'Release to stop',
  disabled = false,
  recording = false,
  onStart,
  onStop,
  style
}: {
  label?: string
  releaseLabel?: string
  disabled?: boolean
  recording?: boolean
  onStart: () => void
  onStop: () => void
  style?: CSSProperties
}) {
  const pointerHeld = useRef(false)
  const keyboardHeld = useRef(false)
  const onStopRef = useRef(onStop)
  onStopRef.current = onStop
  const stop = () => {
    const held = pointerHeld.current || keyboardHeld.current
    pointerHeld.current = false
    keyboardHeld.current = false
    if (held) onStopRef.current()
  }
  useEffect(() => {
    const release = () => stop()
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    window.addEventListener('blur', release)
    document.addEventListener('visibilitychange', release)
    return () => {
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
      window.removeEventListener('blur', release)
      document.removeEventListener('visibilitychange', release)
      release()
    }
  }, [])
  useEffect(() => { if (disabled) stop() }, [disabled])
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled || pointerHeld.current || keyboardHeld.current || !event.isPrimary || event.button !== 0) return
    event.preventDefault()
    pointerHeld.current = true
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* Some assistive input devices do not expose pointer capture. */ }
    onStart()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || pointerHeld.current || keyboardHeld.current || event.repeat || (event.key !== ' ' && event.key !== 'Enter')) return
    event.preventDefault()
    keyboardHeld.current = true
    onStart()
  }
  return <button
    type="button"
    disabled={disabled}
    aria-pressed={recording}
    aria-label={recording ? releaseLabel : label}
    title="Press and hold while speaking. Release to finish."
    onPointerDown={onPointerDown}
    onPointerUp={stop}
    onPointerCancel={stop}
    onLostPointerCapture={stop}
    onKeyDown={onKeyDown}
    onKeyUp={event => { if (event.key === ' ' || event.key === 'Enter') stop() }}
    onBlur={stop}
    onContextMenu={event => event.preventDefault()}
    style={{ touchAction: 'none', userSelect: 'none', ...style }}
  >
    {recording ? releaseLabel : label}
  </button>
}

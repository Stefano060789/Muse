import { useEffect, useRef, type CSSProperties } from 'react'

export default function DictationButton({
  label = 'Start dictation',
  stopLabel = 'Stop and use transcript',
  disabled = false,
  recording = false,
  stopping = false,
  stoppingLabel = 'Finishing dictation…',
  onStart,
  onStop,
  style
}: {
  label?: string
  stopLabel?: string
  disabled?: boolean
  recording?: boolean
  stopping?: boolean
  stoppingLabel?: string
  onStart: () => void
  onStop: () => void
  style?: CSSProperties
}) {
  const active = useRef(false)
  const onStopRef = useRef(onStop)
  onStopRef.current = onStop
  const onStartRef = useRef(onStart)
  onStartRef.current = onStart
  useEffect(() => {
    active.current = recording
  }, [recording])
  useEffect(() => {
    if ((disabled || stopping) && active.current) {
      active.current = false
      onStopRef.current()
    }
  }, [disabled, stopping])
  useEffect(() => () => {
    if (active.current) onStopRef.current()
  }, [])
  const toggle = () => {
    if (disabled || stopping) return
    if (active.current) {
      active.current = false
      onStopRef.current()
      return
    }
    active.current = true
    onStartRef.current()
  }
  return <button
    type="button"
    disabled={disabled || stopping}
    aria-busy={stopping}
    aria-pressed={recording}
    aria-label={stopping ? stoppingLabel : recording ? stopLabel : label}
    onClick={toggle}
    style={style}
  >
    {stopping ? stoppingLabel : recording ? stopLabel : label}
  </button>
}

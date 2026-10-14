import type { ReactNode } from 'react'

export default function ExplicitConsent({
  checked,
  onChange,
  children
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', margin: '1rem 0', padding: '0.9rem', border: '1px solid #d9cfc5', borderRadius: 12, background: '#fffaf6', lineHeight: 1.6 }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={event => onChange(event.target.checked)}
        style={{ marginTop: '0.35rem', flex: '0 0 auto' }}
      />
      <span>{children}</span>
    </label>
  )
}

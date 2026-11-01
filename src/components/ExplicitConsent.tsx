import { useEffect, useRef, type ReactNode } from 'react'
import Link from 'next/link'
import { useAccountPermissions } from '../lib/useAccountPermissions'
import { interfaceText, useInterfaceLanguage } from '../lib/interfaceLanguage'
import { registrationCopy } from '../lib/registrationCopy'

export default function ExplicitConsent({
  checked,
  onChange,
  children,
  scope = 'services',
  requireAccount = false
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
  scope?: 'services' | 'cloudAudio'
  requireAccount?: boolean
}) {
  const permissions = useAccountPermissions()
  const language = useInterfaceLanguage()
  const previousAccount = useRef(permissions.accountId)
  useEffect(() => {
    if (previousAccount.current !== permissions.accountId) {
      previousAccount.current = permissions.accountId
      onChange(false)
    }
  }, [permissions.accountId, onChange])
  if (permissions.error) return <p role="alert">{permissions.error}</p>
  if (!permissions.ready) return null
  if (permissions.managed) return permissions.services ? null : <p role="alert"><Link href="/account">{registrationCopy(language).settings}</Link></p>
  if (scope === 'cloudAudio' && permissions.accountId) return permissions.cloudAudio ? null : <p><Link href="/account">{registrationCopy(language).settings}</Link></p>
  if (scope === 'services' && requireAccount) return <p role="alert"><Link href="/account">{permissions.accountId
    ? registrationCopy(language).settings
    : `${interfaceText('signIn', language)} / ${interfaceText('createAccount', language)}`}</Link></p>
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

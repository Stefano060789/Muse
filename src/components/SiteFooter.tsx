import Link from 'next/link'
import { getPublicContactConfig } from '../lib/legalContact'
import { useInterfaceLanguage } from '../lib/interfaceLanguage'
import { publicNavigationCopy } from '../lib/publicNavigationCopy'

const linkStyle = { color: 'inherit' }

export default function SiteFooter() {
  const copy = publicNavigationCopy(useInterfaceLanguage())
  const contact = getPublicContactConfig(
    process.env.NEXT_PUBLIC_MUSE_OPERATOR_NAME,
    process.env.NEXT_PUBLIC_MUSE_SUPPORT_EMAIL
  )

  return (
    <footer className="atelier-footer">
      <div>
        <span className="atelier-brand">Muse</span>
        <nav aria-label={copy.navigation}>
          <Link href="/demo" style={linkStyle}>{copy.sample}</Link>
          <Link href="/billing" style={linkStyle}>{copy.plans}</Link>
          <Link href="/support" style={linkStyle}>{copy.support}</Link>
          <Link href="/privacy" style={linkStyle}>{copy.privacy}</Link>
          <Link href="/terms" style={linkStyle}>{copy.terms}</Link>
        </nav>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem' }}>
          <span>{copy.preview}</span>
          {contact.operator.value ? <span>{copy.operator}: {contact.operator.value}</span> : null}
          {contact.supportEmail.value ? <span>{copy.supportEmail}: <a href={`mailto:${contact.supportEmail.value}`} style={linkStyle}>{contact.supportEmail.value}</a></span> : null}
          {!contact.operator.value || !contact.supportEmail.value ? <Link href="/support" style={linkStyle}>{copy.contactPending}</Link> : null}
        </div>
      </div>
    </footer>
  )
}

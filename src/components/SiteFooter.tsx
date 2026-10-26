import Link from 'next/link'
import { getPublicContactConfig } from '../lib/legalContact'

const linkStyle = { color: 'inherit' }

export default function SiteFooter() {
  const contact = getPublicContactConfig(
    process.env.NEXT_PUBLIC_MUSE_OPERATOR_NAME,
    process.env.NEXT_PUBLIC_MUSE_SUPPORT_EMAIL
  )

  return (
    <footer className="atelier-footer">
      <div>
        <span className="atelier-brand">Muse</span>
        <nav aria-label="Legal and support">
          <Link href="/demo" style={linkStyle}>Try a sample</Link>
          <Link href="/billing" style={linkStyle}>Plans (coming soon)</Link>
          <Link href="/support" style={linkStyle}>Help &amp; support</Link>
          <Link href="/privacy" style={linkStyle}>Privacy</Link>
          <Link href="/terms" style={linkStyle}>Terms</Link>
        </nav>
        <div>
          <span>Operator: </span>
          {contact.operator.value || (contact.operator.status === 'invalid' ? 'Not configured (invalid setting)' : 'Not configured')}
          <span> · Support: </span>
          {contact.supportEmail.value
            ? <a href={`mailto:${contact.supportEmail.value}`} style={linkStyle}>{contact.supportEmail.value}</a>
            : contact.supportEmail.status === 'invalid' ? 'Not configured (invalid setting)' : 'Not configured'}
        </div>
        <p style={{ margin: 0 }} role="status">
          Public beta readiness is blocked until operator/support details, legal review, and production recovery are verified.
        </p>
      </div>
    </footer>
  )
}

import Link from 'next/link'
import { getPublicContactConfig } from '../lib/legalContact'

const footerStyle = {
  background: '#eee7df',
  color: '#2d2926',
  fontFamily: 'Georgia, serif',
  padding: '1.25rem 1.5rem',
  fontSize: '0.9rem'
}

const contentStyle = {
  maxWidth: 1200,
  margin: '0 auto',
  display: 'grid',
  gap: '0.7rem'
}

const navStyle = {
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: '0.9rem'
}

const linkStyle = { color: 'inherit' }

export default function SiteFooter() {
  const contact = getPublicContactConfig(
    process.env.NEXT_PUBLIC_MUSE_OPERATOR_NAME,
    process.env.NEXT_PUBLIC_MUSE_SUPPORT_EMAIL
  )

  return (
    <footer style={footerStyle}>
      <div style={contentStyle}>
        <nav aria-label="Legal and support" style={navStyle}>
          <Link href="/privacy" style={linkStyle}>Privacy</Link>
          <Link href="/terms" style={linkStyle}>Terms</Link>
          <Link href="/support" style={linkStyle}>Support</Link>
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
          Public beta readiness is blocked until operator and support contacts are configured and legal review is complete.
        </p>
      </div>
    </footer>
  )
}

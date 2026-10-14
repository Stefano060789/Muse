import Head from 'next/head'
import LegalPage from '../components/LegalPage'
import { getPublicContactConfig } from '../lib/legalContact'

export default function SupportPage() {
  const contact = getPublicContactConfig(
    process.env.NEXT_PUBLIC_MUSE_OPERATOR_NAME,
    process.env.NEXT_PUBLIC_MUSE_SUPPORT_EMAIL
  )

  return (
    <>
      <Head>
        <title>Muse — Support</title>
        <meta name="description" content="Support and contact status for Muse." />
      </Head>
      <LegalPage title="Support">
        <p>Muse is a prototype in public beta preparation. Support is not staffed or available yet.</p>
        <h2>Contact status</h2>
        <p>Operator: {contact.operator.value || (contact.operator.status === 'invalid' ? 'Not configured (invalid setting)' : 'Not configured')}.</p>
        <p>Support email: {contact.supportEmail.value || (contact.supportEmail.status === 'invalid' ? 'Not configured (invalid setting)' : 'Not configured')}.</p>
        {contact.supportEmail.value
          ? <p><a href={`mailto:${contact.supportEmail.value}`}>Email support</a></p>
          : <p>No support address is available; none has been invented or substituted.</p>}
        <p>Do not send private story links, creator codes, passwords, or sensitive personal information to an unverified contact. Public beta is not ready until an operator and support email are configured and legal review is complete.</p>
      </LegalPage>
    </>
  )
}

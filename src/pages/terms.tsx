import Head from 'next/head'
import LegalPage from '../components/LegalPage'
import { getPublicContactConfig } from '../lib/legalContact'

export default function TermsPage() {
  const contact = getPublicContactConfig(
    process.env.NEXT_PUBLIC_MUSE_OPERATOR_NAME,
    process.env.NEXT_PUBLIC_MUSE_SUPPORT_EMAIL
  )

  return (
    <>
      <Head>
        <title>Muse — Terms</title>
        <meta name="description" content="Draft product terms for using the Muse storytelling beta." />
      </Head>
      <LegalPage title="Terms">
        <p><strong>Draft product terms for a prototype.</strong> This is not legal approval or a certified legal agreement. Muse is a public beta prototype and must not launch publicly until the operator and support contacts are configured and these terms are reviewed.</p>

        <h2>Using Muse</h2>
        <p>Muse helps create interactive stories. AI-generated material can be inaccurate, incomplete, or unsuitable; review it and use your own judgment. Muse is not professional, medical, therapeutic, or emergency advice.</p>
        <p>Only submit material you have the right to use and permission to share. Do not submit sensitive personal information or confidential information about someone else. You are responsible for the text, media, and private links you create or share, including choosing who receives a link.</p>

        <h2>Storage and deletion</h2>
        <p>There are no accounts or cloud profiles. Browser memories and saved stories remain in that browser unless you remove them. Server stories are available for up to 30 days; expired records may be physically cleaned only when later service requests trigger cleanup, with no scheduled-cleanup guarantee. Backups, if present, are retained independently; backup configuration, coverage, and recovery are not guaranteed. No full-backup or media-recovery guarantee is currently made. Deleting a shared story from its management page disables its links. A personal journey can be permanently deleted from My Story; removing only a browser-library entry does not delete its server copy.</p>
        <p>Shared media is private and is not sent to AI. Content sent to the configured AI or speech provider is subject to that provider&apos;s processing terms as well as Muse&apos;s privacy information.</p>

        <h2>Operational controls</h2>
        <p>Muse uses IP-derived hashes for rate-limit windows (keyed in production; plain hashes in local development). The general request limit is 120 per minute; failed creator-code attempts are limited to 20 per 10 minutes; fixed-code error reports are limited to 5 per minute. Operational event records contain fixed codes and timestamps and are retained for up to seven days; hosting-platform logs may have separate retention. Error reporting accepts only a fixed client-render-failure event code and fails if persistence is unavailable. Operational status and server logs do not provide configured proactive external alerts.</p>

        <h2>Availability</h2>
        <p>This prototype may change, be unavailable, or fail to preserve data. Keep your own copies of anything important. Do not rely on Muse for secure archival storage.</p>

        <h2>Operator and contact</h2>
        <p>Operator: {contact.operator.value || (contact.operator.status === 'invalid' ? 'Not configured (invalid setting)' : 'Not configured')}.</p>
        <p>Support contact: {contact.supportEmail.value || (contact.supportEmail.status === 'invalid' ? 'Not configured (invalid setting)' : 'Not configured')}.</p>
      </LegalPage>
    </>
  )
}

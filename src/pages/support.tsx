import Head from 'next/head'
import LegalPage from '../components/LegalPage'
import { getPublicContactConfig } from '../lib/legalContact'
import { useInterfaceLanguage } from '../lib/interfaceLanguage'
import { publicContactStatus, publicLegalCopy } from '../lib/publicLegalCopy'

export default function SupportPage() {
  const language = useInterfaceLanguage()
  const copy = publicLegalCopy(language).support
  const contact = getPublicContactConfig(
    process.env.NEXT_PUBLIC_MUSE_OPERATOR_NAME,
    process.env.NEXT_PUBLIC_MUSE_SUPPORT_EMAIL
  )

  return (
    <>
      <Head>
        <title>{`${copy.documentTitle}`}</title>
        <meta name="description" content={copy.description} />
      </Head>
      <LegalPage title={copy.title}>
        <p>{copy.intro}</p>
        <h2>{copy.contactsHeading}</h2>
        <p>{copy.operatorLabel}: {contact.operator.value || publicContactStatus(contact.operator.status, language)}.</p>
        <p>{copy.supportLabel}: {contact.supportEmail.value || publicContactStatus(contact.supportEmail.status, language)}.</p>
        {contact.supportEmail.value
          ? <p><a href={`mailto:${contact.supportEmail.value}`}>{copy.emailAction}</a></p>
          : <p>{copy.noAddress}</p>}
        <p>{copy.warning}</p>
      </LegalPage>
    </>
  )
}

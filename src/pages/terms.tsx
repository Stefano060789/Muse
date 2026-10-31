import Head from 'next/head'
import LegalPage from '../components/LegalPage'
import { getPublicContactConfig } from '../lib/legalContact'
import { useInterfaceLanguage } from '../lib/interfaceLanguage'
import { publicContactStatus, publicLegalCopy } from '../lib/publicLegalCopy'

export default function TermsPage() {
  const language = useInterfaceLanguage()
  const copy = publicLegalCopy(language).terms
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
        {Object.values(copy.sections).map(section => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
            {section === copy.sections.contacts && (
              <>
                <p>{copy.operatorLabel}: {contact.operator.value || publicContactStatus(contact.operator.status, language)}.</p>
                <p>{copy.supportLabel}: {contact.supportEmail.value || publicContactStatus(contact.supportEmail.status, language)}.</p>
              </>
            )}
          </section>
        ))}
      </LegalPage>
    </>
  )
}

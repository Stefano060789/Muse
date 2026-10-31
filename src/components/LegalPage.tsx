import type { ReactNode } from 'react'
import { useInterfaceLanguage } from '../lib/interfaceLanguage'
import { publicLegalCopy } from '../lib/publicLegalCopy'

export default function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  const language = useInterfaceLanguage()
  const copy = publicLegalCopy(language)

  return (
    <main className="atelier-page" dir={language === 'ar-SA' ? 'rtl' : 'ltr'} lang={language}>
      <div className="atelier-shell atelier-shell--narrow">
        <p className="atelier-eyebrow">{copy.eyebrow}</p>
        <h1 className="atelier-title">{title}</h1>
        <div className="atelier-card" style={{ lineHeight: 1.75 }}>{children}</div>
      </div>
    </main>
  )
}

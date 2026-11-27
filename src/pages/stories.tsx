import Head from 'next/head'
import Link from 'next/link'
import { storiesHubCopy } from '../lib/storiesHubCopy'
import { useInterfaceLanguage } from '../lib/interfaceLanguage'

export default function StoriesPage() {
  const language = useInterfaceLanguage()
  const copy = storiesHubCopy(language)
  return <>
    <Head>
      <title>{`Muse — ${copy.title}`}</title>
      <meta name="description" content={copy.subtitle} />
    </Head>
    <main className="atelier-page" lang={language}>
      <div className="atelier-shell atelier-shell--narrow">
        <p className="atelier-eyebrow">{copy.subtitle}</p>
        <h1 className="atelier-title">{copy.title}</h1>
        <section aria-label={copy.title} className="muse-story-paths">
          <article className="atelier-card muse-story-path">
            <span className="muse-story-path__mark" aria-hidden="true">I</span>
            <h2>{copy.personalTitle}</h2>
            <p>{copy.personalDescription}</p>
            <Link href="/my-stories" className="atelier-button">{copy.personalAction}</Link>
          </article>
          <article className="atelier-card muse-story-path muse-story-path--shared">
            <span className="muse-story-path__mark" aria-hidden="true">II</span>
            <h2>{copy.sharedTitle}</h2>
            <p>{copy.sharedDescription}</p>
            <p className="muse-story-path__note">{copy.sharedAllowance}</p>
            <Link href="/shared#new" className="atelier-button">{copy.sharedAction}</Link>
          </article>
        </section>
      </div>
    </main>
  </>
}

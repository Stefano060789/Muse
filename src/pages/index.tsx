import Head from 'next/head'
import Link from 'next/link'
import InstallApp from '../components/InstallApp'

export default function Home() {
  return <>
    <Head>
      <title>Muse - A story for you. A gift for someone.</title>
      <meta name="description" content="Create an AI-powered story shaped by your choices, or make a personal mystery that reveals a thoughtful gift. Try a free handcrafted sample." />
    </Head>
    <main className="atelier-page atelier-home">
      <div className="atelier-shell">
        <header className="atelier-header">
          <Link href="/" className="atelier-brand">Muse</Link>
          <nav aria-label="Main navigation"><Link href="/library">Story Library</Link></nav>
        </header>
        <section className="atelier-hero" aria-labelledby="welcome-title">
          <div>
            <p className="atelier-eyebrow">Small adventures. Personal meaning.</p>
            <h1 id="welcome-title">A story to get lost in.<br /><em>A gift they&apos;ll remember.</em></h1>
            <p className="atelier-subtitle">Create an AI-powered story you shape with your choices. Or give someone a personal mystery with a hidden surprise.</p>
            <div className="atelier-actions">
              <Link href="/story" className="atelier-button">Create my story</Link>
              <Link href="/shared#new" className="atelier-button atelier-secondary">Make a story gift</Link>
            </div>
            <Link href="/demo" className="atelier-sample-link">Try a 2-minute sample</Link>
            <p className="atelier-note">Free, handcrafted, no account needed.</p>
          </div>
          <figure className="atelier-hero-art">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/story-door.svg" width="480" height="530" alt="" />
          </figure>
        </section>
        <aside className="atelier-home-more" aria-label="More about Muse">
          <p className="atelier-note">Read. Listen. Choose what happens next.</p>
          <details>
            <summary>A little more about Muse</summary>
            <p className="atelier-note">Gift recipients open a private link without an account. AI stories can be imperfect; preview gifts before sending. Server stories last up to 30 days.</p>
            <nav aria-label="Explore Muse"><Link href="/myself">Personal touches (optional)</Link><Link href="/billing">Plans - coming soon</Link></nav>
            <InstallApp />
          </details>
        </aside>
      </div>
    </main>
  </>
}

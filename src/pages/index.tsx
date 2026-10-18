import Head from 'next/head'
import Link from 'next/link'
import InstallApp from '../components/InstallApp'
import HomePersonalTouches from '../components/HomePersonalTouches'

export default function Home() {
  return <>
    <Head>
      <title>Muse - A story for you. A gift story for someone.</title>
      <meta name="description" content="Create an AI-powered story shaped by your choices, or make a personal mystery that reveals a thoughtful gift. Try a free handcrafted sample." />
    </Head>
    <main className="atelier-page atelier-home">
      <div className="atelier-shell">
        <section className="atelier-hero" aria-labelledby="welcome-title">
          <div>
            <p className="atelier-eyebrow">Small adventures. Personal meaning.</p>
            <h1 id="welcome-title">A story to get lost in.<br /><em>A gift story they&apos;ll remember.</em></h1>
            <p className="atelier-subtitle">Create an AI-powered story you shape with your choices. Or give someone a personal mystery with a hidden surprise.</p>
            <div className="atelier-actions">
              <Link href="/story" className="atelier-button">Create a story</Link>
              <Link href="/shared#new" className="atelier-button atelier-secondary">Create a gift story</Link>
            </div>
            <p className="atelier-note">For yourself: an interactive escape. For someone else: a mystery with a personal surprise.</p>
            <Link href="/demo" className="atelier-sample-link">Try a 2-minute sample</Link>
            <p className="atelier-note">Free, handcrafted, no account needed.</p>
          </div>
          <figure className="atelier-hero-art" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/illustrations/moonlit-passage.svg" width="1200" height="400" alt="" />
          </figure>
        </section>
        <HomePersonalTouches />
        <aside className="atelier-home-more" aria-label="More about Muse">
          <p className="atelier-note">Already started? <Link href="/library">Find your saved stories and gift stories</Link>.</p>
          <details>
            <summary>A little more about Muse</summary>
            <p className="atelier-note">Gift story recipients open a private link without an account. AI stories can be imperfect; preview gift stories before sending. Server stories last up to 30 days.</p>
            <InstallApp />
          </details>
        </aside>
      </div>
    </main>
  </>
}

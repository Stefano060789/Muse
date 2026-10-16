import Head from 'next/head'
import Link from 'next/link'
import InstallApp from '../components/InstallApp'

export default function Home() {
  return <>
    <Head>
      <title>Muse - A story for you. A gift for someone.</title>
      <meta name="description" content="Create an AI-powered story shaped by your choices, or make a personal mystery that reveals a thoughtful gift. Try a free handcrafted sample." />
    </Head>
    <main className="atelier-page">
      <div className="atelier-shell">
        <header className="atelier-header">
          <Link href="/" className="atelier-brand">Muse</Link>
          <nav aria-label="Main navigation"><Link href="/demo">Try a sample</Link><Link href="/library">Story Library</Link></nav>
        </header>
        <section className="atelier-hero" aria-labelledby="welcome-title">
          <div>
            <p className="atelier-eyebrow">Small adventures. Personal meaning.</p>
            <h1 id="welcome-title">A story to get lost in.<br /><em>A gift they&apos;ll remember.</em></h1>
            <p className="atelier-subtitle">Create an AI-powered story you shape with your choices. Or turn a personal message into a mystery for someone you care about.</p>
            <div className="atelier-actions">
              <Link href="/story" className="atelier-button">Create my story</Link>
              <Link href="/shared#new" className="atelier-button atelier-secondary">Make a story gift</Link>
            </div>
            <Link href="/demo" className="atelier-sample-link">Try a 2-minute sample</Link>
            <p className="atelier-note">Handcrafted and free to try. No account or AI credits needed for the sample.</p>
          </div>
          <figure className="atelier-hero-art">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/story-door.svg" width="480" height="530" alt="" />
            <figcaption>Every story begins with a little possibility.</figcaption>
          </figure>
        </section>
        <section className="atelier-section" aria-labelledby="possibilities-title">
          <p className="atelier-eyebrow">A little inspiration</p>
          <h2 id="possibilities-title">What will your story become?</h2>
          <div className="atelier-grid">
            <article className="atelier-example"><span>A story for me</span><h3>A moment somewhere else.</h3><p>Follow your curiosity, find a little courage, or unwind. Choose a mood and decide what happens next.</p></article>
            <article className="atelier-example"><span>A story for someone</span><h3>A surprise worth discovering.</h3><p>Turn a birthday message or a thoughtful invitation into a mystery with personal clues and a hidden reveal.</p></article>
            <article className="atelier-example"><span>A moment for two</span><h3>Something only you would write.</h3><p>Weave shared memories into a gift. Optional non-explicit romance is for consenting adults.</p></article>
          </div>
        </section>
        <section className="atelier-section" aria-labelledby="how-title">
          <p className="atelier-eyebrow">From a thought to a story</p>
          <h2 id="how-title">A few small steps. A world of your own.</h2>
          <ol className="atelier-grid atelier-steps">
            <li><h3>Choose a feeling.</h3><p>Start with a mood for yourself or an occasion for someone else.</p></li>
            <li><h3>Make it personal.</h3><p>Add a little context. For gifts, choose the secret answer and final surprise.</p></li>
            <li><h3>Let the story unfold.</h3><p>Read, listen or shape your next move. Share gifts through a private link.</p></li>
          </ol>
          <p className="atelier-note">Gift recipients don&apos;t need an account. AI stories can be imperfect; preview your gift before sending. Server stories are available for up to 30 days.</p>
        </section>
        <aside className="atelier-section atelier-bottom" aria-label="More about Muse">
          <div><h2>A little more like you.</h2><p><Link href="/myself">Personal touches</Link> are optional and saved on this device. You choose whether to send them to AI for a story.</p><Link href="/billing" className="atelier-sample-link">Explore plans - coming soon</Link></div>
          <div><h2>Keep Muse close.</h2><p>Open a story in your browser, or add Muse to your phone&apos;s home screen.</p><InstallApp /></div>
        </aside>
      </div>
    </main>
  </>
}

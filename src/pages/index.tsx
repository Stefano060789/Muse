import Head from 'next/head'
import Link from 'next/link'
import InstallApp from '../components/InstallApp'

const action = { display: 'block', padding: '1.5rem', borderRadius: 20, border: '1px solid #d9cfc5', textDecoration: 'none', color: 'inherit', background: '#fffaf6' }

export default function Home() {
  return <>
    <Head>
      <title>Muse - A story for you. A gift for someone.</title>
      <meta name="description" content="Make a personal story, or turn a thoughtful surprise into a mystery for someone you care about." />
    </Head>
    <main style={{ minHeight: '85vh', background: '#f7f3ed', color: '#2d2926', fontFamily: 'Georgia, serif' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.5rem' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <Link href="/" style={{ color: 'inherit', fontSize: '1.4rem', fontWeight: 700, textDecoration: 'none' }}>Muse</Link>
          <Link href="/library" style={{ color: 'inherit', padding: '0.75rem 0' }}>Story Library</Link>
        </header>
        <section style={{ padding: 'clamp(2.5rem, 8vw, 5rem) 0 2rem' }}>
          <h1 style={{ fontSize: 'clamp(2.5rem, 8vw, 4rem)', lineHeight: 1.12, margin: '0 0 1rem' }}>A little story.<br />Something meaningful.</h1>
          <p style={{ fontSize: '1.15rem', lineHeight: 1.7, maxWidth: 520 }}>Take a moment for yourself, or make a personal adventure for someone you care about.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: 16, margin: '2rem 0' }}>
            <Link href="/story" style={action}><h2 style={{ fontSize: '1.35rem', marginTop: 0 }}>A story for me</h2><p style={{ lineHeight: 1.6, marginBottom: 0 }}>Choose a mood. Shape what happens next.</p></Link>
            <Link href="/shared#new" style={{ ...action, background: '#2d2926', color: '#fffaf6' }}><h2 style={{ fontSize: '1.35rem', marginTop: 0 }}>A story for someone</h2><p style={{ lineHeight: 1.6, marginBottom: 0 }}>Make a mystery with a thoughtful surprise.</p></Link>
          </div>
          <Link href="/demo" style={{ color: 'inherit', display: 'inline-block', padding: '0.8rem 0', fontWeight: 700 }}>Try a sample story first</Link>
          <p style={{ fontSize: '0.9rem', marginTop: 0 }}>About two minutes. No account or AI credits needed.</p>
        </section>
        <aside style={{ borderTop: '1px solid #d9cfc5', paddingTop: '1rem' }}>
          <p style={{ lineHeight: 1.7 }}>Want stories to feel more like you? <Link href="/myself" style={{ color: 'inherit' }}>Myself</Link> keeps optional personal touches on this device.</p>
          <Link href="/billing" style={{ color: 'inherit', display: 'inline-block', padding: '0.75rem 0' }}>Plans &amp; Billing - coming soon</Link>
          <InstallApp />
        </aside>
      </div>
    </main>
  </>
}

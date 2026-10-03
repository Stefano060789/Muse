import Head from 'next/head'
import Link from 'next/link'

const features = [
  {
    title: 'Myself',
    description: 'Tell Muse what matters to you. Your key points stay in this browser and help every interaction feel more personal.',
    href: '/myself'
  },
  {
    title: 'My Story',
    description: 'Choose what you need today and receive an interactive story that changes through your answers.',
    href: '/story'
  },
  {
    title: 'Shared Story',
    description: 'A story for two people with clues, discovery, and a shared emotional arc.',
    href: '/couples'
  }
]

export default function Home() {
  return (
    <>
      <Head>
        <title>Muse — Stories that meet you where you are</title>
        <meta
          name="description"
          content="Muse creates personalized, interactive stories shaped by what matters to you."
        />
      </Head>

      <main
        style={{
          minHeight: '100vh',
          background: '#f7f3ed',
          color: '#2d2926',
          fontFamily: 'Georgia, serif'
        }}
      >
        <header
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '1.25rem 1.5rem 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap'
          }}
        >
          <Link href="/" style={{ color: '#2d2926', textDecoration: 'none', fontSize: '1.4rem', fontWeight: 700 }}>Muse</Link>
          <nav style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <a href="#experience" style={{ color: '#2d2926', textDecoration: 'none' }}>How it works</a>
            <Link href="/myself" style={{ color: '#2d2926', textDecoration: 'none' }}>Myself</Link>
            <Link href="/story" style={{ color: '#2d2926', textDecoration: 'none', fontWeight: 700 }}>My Story</Link>
            <Link href="/couples" style={{ color: '#2d2926', textDecoration: 'none' }}>Shared Story</Link>
          </nav>
        </header>

        <section
          data-responsive-grid="hero"
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '4rem 1.5rem 2rem',
            display: 'grid',
            gridTemplateColumns: '1.2fr 0.8fr',
            gap: '2rem',
            alignItems: 'center'
          }}
        >
          <div>
            <p style={{ letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '1rem', fontSize: '0.8rem' }}>
              Muse
            </p>
            <h1 style={{ fontSize: 'clamp(2.8rem, 7vw, 5rem)', margin: '0 0 1rem', lineHeight: 1.05 }}>
              Stories that meet you where you are.
            </h1>
            <p style={{ fontSize: '1.25rem', lineHeight: 1.6, maxWidth: 620 }}>
              A quiet space where Muse remembers what matters, understands what you need, and creates stories you can shape.
            </p>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '2rem' }}>
              <Link
                href="/story"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.9rem 1.4rem',
                  borderRadius: 999,
                  background: '#2d2926',
                  color: '#f7f3ed',
                  textDecoration: 'none',
                  fontWeight: 600
                }}
              >
                Create My Story
              </Link>
              <a
                href="#experience"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.9rem 1.4rem',
                  borderRadius: 999,
                  border: '1px solid #2d2926',
                  color: '#2d2926',
                  textDecoration: 'none',
                  fontWeight: 600
                }}
              >
                See how it works
              </a>
            </div>
          </div>

          <aside
            style={{
              background: '#fffaf6',
              border: '1px solid #d9cfc5',
              borderRadius: 24,
              padding: '1.5rem',
              boxShadow: '0 12px 30px rgba(45, 41, 38, 0.06)'
            }}
          >
            <p style={{ textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '0.7rem', opacity: 0.7 }}>The Muse experience</p>
            <h2 style={{ margin: '0.5rem 0 1rem', fontSize: '2rem' }}>A little mystery for two</h2>
            <p style={{ lineHeight: 1.7, margin: 0 }}>
              Start with Myself, choose a mood in My Story, or invite someone into a Shared Story.
            </p>
          </aside>
        </section>

        <section id="experience" style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1.5rem 1rem' }}>
          <p style={{ textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: '0.75rem', marginBottom: '1rem' }}>Choose your space</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {features.map((feature) => (
              <article
                key={feature.title}
                style={{
                  background: '#fffaf6',
                  border: '1px solid #d9cfc5',
                  borderRadius: 18,
                  padding: '1.35rem',
                  minHeight: 180
                }}
              >
                <h3 style={{ marginTop: 0, marginBottom: '0.6rem', fontSize: '1.4rem' }}><Link href={feature.href} style={{ color: '#2d2926', textDecoration: 'none' }}>{feature.title} →</Link></h3>
                <p style={{ margin: 0, lineHeight: 1.7 }}>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section style={{ maxWidth: 1200, margin: '0 auto', padding: '2.5rem 1.5rem 4rem' }}>
          <div
            style={{
              background: '#2d2926',
              color: '#f7f3ed',
              borderRadius: 26,
              padding: '2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap'
            }}
          >
            <div>
              <p style={{ textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: '0.72rem', opacity: 0.8 }}>Ready when you are</p>
              <h3 style={{ margin: '0.5rem 0 0', fontSize: '2rem' }}>Start your shared story</h3>
            </div>
            <Link
              href="/couples"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.9rem 1.4rem',
                borderRadius: 999,
                background: '#f7f3ed',
                color: '#2d2926',
                textDecoration: 'none',
                fontWeight: 700
              }}
            >
              Begin together →
            </Link>
          </div>
        </section>
      </main>
    </>
  )
}

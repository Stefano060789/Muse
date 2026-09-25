import Head from 'next/head'
import Link from 'next/link'

const features = [
  {
    title: 'Daily story',
    description: 'Gentle, personal messages shaped by the moods, memories, and media that matter to you.'
  },
  {
    title: 'Couples story mode',
    description: 'A shared romantic mystery where each partner discovers clues and builds a story together across time and distance.'
  },
  {
    title: 'Rituals',
    description: 'Soft prompts for reflection, reconnection, and slower daily rituals that feel intimate instead of performative.'
  },
  {
    title: 'Voice and warmth',
    description: 'A future layer for narration and audio that turns the experience into something more emotional and less transactional.'
  }
]

export default function Home() {
  return (
    <>
      <Head>
        <title>Muse — Your daily story</title>
        <meta
          name="description"
          content="A personalized daily story shaped by what you love."
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
          <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>Muse</div>
          <nav style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <a href="#experience" style={{ color: '#2d2926', textDecoration: 'none' }}>Experience</a>
            <a href="#couples" style={{ color: '#2d2926', textDecoration: 'none' }}>Couples</a>
            <Link href="/couples" style={{ color: '#2d2926', textDecoration: 'none' }}>Open story</Link>
          </nav>
        </header>

        <section
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
              Your daily story, written for you.
            </h1>
            <p style={{ fontSize: '1.25rem', lineHeight: 1.6, maxWidth: 620 }}>
              A quiet space for personalized messages inspired by the books, films, poetry, and moods that matter to you.
            </p>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '2rem' }}>
              <Link
                href="/couples"
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
                Try the couples story
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
                Explore the experience
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
            <p style={{ textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '0.7rem', opacity: 0.7 }}>Current focus</p>
            <h2 style={{ margin: '0.5rem 0 1rem', fontSize: '2rem' }}>Shared Story Mode</h2>
            <p style={{ lineHeight: 1.7, margin: 0 }}>
              A personal mystery built for two people in different time zones: clues, discovery, rituals, and a shared emotional arc.
            </p>
          </aside>
        </section>

        <section id="experience" style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1.5rem 1rem' }}>
          <p style={{ textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: '0.75rem', marginBottom: '1rem' }}>What Muse does</p>
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
                <h3 style={{ marginTop: 0, marginBottom: '0.6rem', fontSize: '1.4rem' }}>{feature.title}</h3>
                <p style={{ margin: 0, lineHeight: 1.7 }}>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="couples" style={{ maxWidth: 1200, margin: '0 auto', padding: '2.5rem 1.5rem 4rem' }}>
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
              <p style={{ textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: '0.72rem', opacity: 0.8 }}>Prototype</p>
              <h3 style={{ margin: '0.5rem 0 0', fontSize: '2rem' }}>Launch the shared story experience</h3>
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
              Open Couples Story
            </Link>
          </div>
        </section>
      </main>
    </>
  )
}

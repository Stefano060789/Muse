import Head from 'next/head'

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
          display: 'grid',
          placeItems: 'center',
          padding: '2rem',
          background: '#f7f3ed',
          color: '#2d2926',
          fontFamily: 'Georgia, serif',
        }}
      >
        <section style={{ maxWidth: 680, textAlign: 'center' }}>
          <p style={{ letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            Muse
          </p>
          <h1 style={{ fontSize: 'clamp(2.5rem, 8vw, 5rem)', margin: '1rem 0' }}>
            Your daily story, written for you.
          </h1>
          <p style={{ fontSize: '1.25rem', lineHeight: 1.6 }}>
            A quiet space for personalized messages inspired by the books,
            films, poetry, and moods that matter to you.
          </p>
        </section>
      </main>
    </>
  )
}

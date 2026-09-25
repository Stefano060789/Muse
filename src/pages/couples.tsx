import { useEffect, useMemo, useState } from 'react'
import { STORY_TEMPLATES, type StoryArc } from '../lib/story'

export default function CouplesStoryPage() {
  const [story, setStory] = useState<StoryArc | null>(null)
  const [templateKey, setTemplateKey] = useState(STORY_TEMPLATES[0].key)
  const [partnerA, setPartnerA] = useState('You')
  const [partnerB, setPartnerB] = useState('Your partner')
  const [response, setResponse] = useState('')
  const [error, setError] = useState('')

  const loadStory = async () => {
    const result = await fetch('/api/story')
    if (!result.ok) return
    const data = await result.json()
    if (!data) return
    setStory(data)
    setTemplateKey(data.templateKey)
    setPartnerA(data.partnerA)
    setPartnerB(data.partnerB)
  }

  useEffect(() => {
    loadStory()
  }, [])

  const currentBeat = useMemo(() => {
    if (!story) return null
    return story.beats[story.currentBeat]
  }, [story])

  const startStory = async () => {
    setError('')
    const res = await fetch('/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', templateKey, partnerA, partnerB })
    })

    if (!res.ok) {
      setError('Could not create the story.')
      return
    }

    const nextStory = await res.json()
    setStory(nextStory)
    setResponse('')
  }

  const handleAnswer = async () => {
    if (!story || !response.trim()) return
    setError('')

    const res = await fetch('/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'answer', response })
    })

    if (!res.ok) {
      setError('Could not save your discovery.')
      return
    }

    const nextStory = await res.json()
    setStory(nextStory)
    setResponse('')
  }

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem', fontFamily: 'Georgia, serif' }}>
      <h1 style={{ fontSize: '2.2rem', marginBottom: '1rem' }}>Muse — Shared Story Mode</h1>

      {error ? <p style={{ color: '#a14329', marginBottom: '1rem' }}>{error}</p> : null}

      {!story ? (
        <section style={{ display: 'grid', gap: '1rem' }}>
          <label>
            Story template
            <select value={templateKey} onChange={(e) => setTemplateKey(e.target.value)} style={{ display: 'block', width: '100%', marginTop: '0.5rem', padding: '0.8rem' }}>
              {STORY_TEMPLATES.map((template) => (
                <option key={template.key} value={template.key}>{template.title}</option>
              ))}
            </select>
          </label>

          <label>
            Partner A name
            <input value={partnerA} onChange={(e) => setPartnerA(e.target.value)} style={{ display: 'block', width: '100%', marginTop: '0.5rem', padding: '0.8rem' }} />
          </label>

          <label>
            Partner B name
            <input value={partnerB} onChange={(e) => setPartnerB(e.target.value)} style={{ display: 'block', width: '100%', marginTop: '0.5rem', padding: '0.8rem' }} />
          </label>

          <button onClick={startStory} style={{ padding: '0.9rem 1.2rem', fontSize: '1rem', cursor: 'pointer' }}>
            Start the story
          </button>
        </section>
      ) : (
        <section style={{ display: 'grid', gap: '1.25rem' }}>
          <div style={{ border: '1px solid #d9cfc5', borderRadius: 16, padding: '1.5rem', background: '#fffaf6' }}>
            <p style={{ textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '0.75rem', opacity: 0.7 }}>
              {story.partnerA} + {story.partnerB}
            </p>
            <h2 style={{ marginTop: '0.25rem', marginBottom: '0.5rem' }}>{story.title}</h2>
            <p style={{ margin: 0, lineHeight: 1.7 }}>{story.description}</p>
          </div>

          <div style={{ border: '1px solid #d9cfc5', borderRadius: 16, padding: '1.5rem', background: '#f7f3ed' }}>
            <p style={{ textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '0.7rem', opacity: 0.7 }}>
              Beat {currentBeat?.number ?? story.currentBeat + 1}
            </p>
            <h3 style={{ marginTop: '0.25rem', marginBottom: '0.75rem' }}>{currentBeat?.title}</h3>
            <p style={{ lineHeight: 1.8, marginBottom: '1rem' }}>{currentBeat?.body}</p>
            <p style={{ fontStyle: 'italic', margin: 0 }}><strong>Clue:</strong> {currentBeat?.clue}</p>
          </div>

          <div style={{ border: '1px solid #d9cfc5', borderRadius: 16, padding: '1.5rem' }}>
            <label>
              Your answer / discovery
              <textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                rows={5}
                style={{ display: 'block', width: '100%', marginTop: '0.5rem', padding: '0.9rem', fontSize: '1rem', resize: 'vertical' }}
              />
            </label>

            <button onClick={handleAnswer} style={{ marginTop: '1rem', padding: '0.9rem 1.2rem', cursor: 'pointer' }}>
              Save discovery
            </button>
          </div>

          <div style={{ border: '1px solid #d9cfc5', borderRadius: 16, padding: '1.5rem' }}>
            <h3 style={{ marginTop: 0 }}>Your story responses</h3>
            {Object.keys(story.responses).length === 0 ? (
              <p>No discoveries yet.</p>
            ) : (
              <ul style={{ paddingLeft: '1.2rem', lineHeight: 1.8 }}>
                {Object.entries(story.responses).map(([beat, answer]) => (
                  <li key={beat}><strong>Beat {beat}:</strong> {answer}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </main>
  )
}

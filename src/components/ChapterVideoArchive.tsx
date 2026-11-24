import { useEffect, useRef, useState } from 'react'
import { accountFetch, supabase } from '../lib/accountClient'
import { videoBlob } from '../lib/chapterVideoClient'
import type { StoryLanguageCode } from '../lib/storyLanguage'

type Video = {
  id: string; chapterId: string; storyId: string; chapterNumber: number
  status: 'starting' | 'pending' | 'ready' | 'failed' | 'unknown'; expiresAt: string
}

export default function ChapterVideoArchive({ language, titles }: {
  language: StoryLanguageCode; titles: Record<string, string>
}) {
  const italian = language === 'it-IT'
  const [videos, setVideos] = useState<Video[]>([])
  const [enabled, setEnabled] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [preparedShare, setPreparedShare] = useState<{ id: string; file: File } | null>(null)
  const [now, setNow] = useState(Date.now())
  const generation = useRef(0)

  async function request(action: string, id?: string, offset?: number) {
    const response = await accountFetch('/api/heygen-reel', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...(id ? { id } : {}), ...(offset !== undefined ? { offset } : {}) })
    })
    if (!response.ok) {
      const data: unknown = await response.json().catch(() => null)
      throw new Error(data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error : 'Could not access your videos.')
    }
    return response
  }
  async function refresh() {
    const current = generation.current
    try {
      const data: unknown = await (await request('archive-list')).json()
      if (!data || typeof data !== 'object' || !('enabled' in data) || typeof data.enabled !== 'boolean' ||
          !('videos' in data) || !Array.isArray(data.videos)) throw new Error('Invalid video archive response.')
      if (current !== generation.current) return
      setEnabled(data.enabled)
      setVideos(data.videos)
      setError('')
    } catch (cause) {
      if (current === generation.current) setError(cause instanceof Error ? cause.message : 'Could not load videos.')
    }
  }
  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      if (sessionError) setError('Could not check your account sign-in.')
      else if (data.session) void refresh()
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      generation.current++
      setVideos([]); setEnabled(false); setError(''); setNotice(''); setPreparedShare(null)
      if (session) void refresh()
    })
    const timer = window.setInterval(() => setNow(Date.now()), 60000)
    return () => { active = false; generation.current++; subscription.subscription.unsubscribe(); window.clearInterval(timer) }
  }, [])

  async function act(video: Video, action: 'check' | 'delete' | 'download' | 'prepare-share') {
    if (busy) return
    if (action === 'delete' && !window.confirm(italian ? 'Eliminare questo video?' : 'Delete this video?')) return
    const current = generation.current
    setBusy(video.id); setError(''); setNotice('')
    try {
      if (action === 'check') await request('archive-status', video.id)
      if (action === 'delete') {
        await request('archive-delete', video.id)
        setPreparedShare(null)
      }
      if (action === 'download' || action === 'prepare-share') {
        const blob = await videoBlob(await request('archive-video', video.id),
          offset => request('archive-video', video.id, offset), true)
        if (current !== generation.current) return
        if (!blob.size || !blob.type.startsWith('video/mp4')) throw new Error('The downloaded video is invalid.')
        const file = new File([blob], 'muse-chapter-video.mp4', { type: 'video/mp4' })
        if (action === 'prepare-share') {
          if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
            throw new Error(italian ? 'Scarica il video e caricalo nella tua app social.' : 'Download the video and upload it in your social app.')
          }
          setPreparedShare({ id: video.id, file })
          setNotice(italian ? 'Il video è pronto per la condivisione.' : 'The video is ready to share.')
        } else {
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url; link.download = file.name
          document.body.append(link); link.click(); link.remove()
          window.setTimeout(() => URL.revokeObjectURL(url), 60000)
        }
      }
      await refresh()
      if (action === 'delete') setNotice(italian
        ? 'Accesso rimosso; la cancellazione dei file può richiedere più tempo.'
        : 'Access removed; deleting the underlying files may take longer.')
    } catch (cause) {
      if (!(cause instanceof Error && cause.name === 'AbortError')) {
        setError(cause instanceof Error ? cause.message : 'Could not manage this video.')
      }
    } finally { setBusy('') }
  }

  function sharePrepared() {
    if (!preparedShare || !navigator.share) return
    void navigator.share({ files: [preparedShare.file] }).catch(cause => {
      if (!(cause instanceof Error && cause.name === 'AbortError')) setError('Could not share the video. Download it instead.')
    })
  }

  if (!enabled && !error) return null
  return <section className="muse-collection-section" aria-labelledby="chapter-videos-heading">
    <h2 id="chapter-videos-heading">{italian ? 'I tuoi video' : 'Your videos'}</h2>
    {error ? <p role="alert">{error} <button type="button" onClick={() => void refresh()}>{italian ? 'Riprova' : 'Retry'}</button></p> : null}
    {notice ? <p role="status">{notice}</p> : null}
    {enabled && !videos.length ? <p>{italian ? 'Nessun video disponibile.' : 'No videos available.'}</p> : null}
    {videos.map(video => {
      const remaining = Date.parse(video.expiresAt) - now
      return <article className="atelier-card muse-collection-card" key={video.id}>
        <h3>{titles[video.chapterId] || (italian ? 'Storia' : 'Story')} · {italian ? 'Capitolo' : 'Chapter'} {video.chapterNumber}</h3>
        {video.status === 'ready' ? <>
          <p>{italian ? 'Disponibile fino al' : 'Available until'} {new Date(video.expiresAt).toLocaleString(language)}</p>
          {remaining > 0 ? <p>{italian ? 'Tempo rimanente:' : 'Time remaining:'} {remaining > 86400000
            ? `${Math.ceil(remaining / 86400000)} ${italian ? 'giorni' : 'days'}`
            : `${Math.ceil(remaining / 3600000)} ${italian ? 'ore' : 'hours'}`}</p> : null}
          {remaining > 0 && remaining <= 86400000 ? <p role="status">{italian
            ? 'Questo video scade entro 24 ore. Scaricalo ora se vuoi conservarlo.'
            : 'This video expires within 24 hours. Download it now if you want to keep it.'}</p> : null}
          {remaining <= 0 ? <p role="status">{italian ? 'Questo video è scaduto.' : 'This video has expired.'}</p> : null}
          <div className="atelier-actions">
            <button type="button" disabled={!!busy || remaining <= 0} onClick={() => void act(video, 'download')}>{italian ? 'Scarica MP4' : 'Download MP4'}</button>
            {preparedShare?.id === video.id
              ? <button type="button" disabled={!!busy || remaining <= 0} onClick={sharePrepared}>{italian ? 'Condividi' : 'Share'}</button>
              : <button type="button" disabled={!!busy || remaining <= 0} onClick={() => void act(video, 'prepare-share')}>
                {italian ? 'Prepara la condivisione' : 'Prepare to share'}</button>}
          </div>
        </> : <p>{video.status === 'failed' || video.status === 'unknown'
          ? (italian ? 'Video non completato. Controlla l’utilizzo prima di riprovare.' : 'Video not completed. Check usage before trying again.')
          : (italian ? 'Video in preparazione.' : 'Video is being prepared.')}</p>}
        {video.status === 'pending' || video.status === 'starting'
          ? <button type="button" disabled={!!busy} onClick={() => void act(video, 'check')}>{italian ? 'Controlla stato' : 'Check status'}</button> : null}
        <button type="button" disabled={!!busy} onClick={() => void act(video, 'delete')}>{italian ? 'Elimina video' : 'Delete video'}</button>
      </article>
    })}
  </section>
}

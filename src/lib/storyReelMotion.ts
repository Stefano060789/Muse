import type { MoodMusicTrack } from './moodMusic'
import { shareVideoType } from './storyShareMotion'
import { storyReelTimeline, truncateStoryReelCaption, type StoryReelTheme } from './storyReelLogic'

export type StoryReelClipMoment = {
  id: string
  caption: string
  image: string
}

const THEME_COLORS: Record<StoryReelTheme, { bg: string; ink: string; accent: string }> = {
  starlight: { bg: '#202c42', ink: '#fff5e5', accent: '#e5c38c' },
  paper: { bg: '#fffaf0', ink: '#202c42', accent: '#866136' },
  dawn: { bg: '#f7ddd1', ink: '#342d49', accent: '#81562d' }
}

export function storyReelAttributionLine(track?: MoodMusicTrack): string {
  if (!track || !/cc\s*by/iu.test(track.license)) return ''
  return `${track.title} — ${track.attribution}`
}

function drawCover(context: CanvasRenderingContext2D, image: CanvasImageSource, progress: number, seed: number) {
  const width = context.canvas.width
  const height = context.canvas.height
  const startZoom = 1.04 + (seed % 5) * 0.015
  const endZoom = startZoom + 0.08
  const zoom = startZoom + (endZoom - startZoom) * progress
  const offsetX = ((seed % 7) - 3) * 0.014 * width * (1 - progress)
  const offsetY = ((seed % 5) - 2) * 0.012 * height * progress
  const drawWidth = width * zoom
  const drawHeight = height * zoom
  context.drawImage(image, (width - drawWidth) / 2 + offsetX, (height - drawHeight) / 2 + offsetY, drawWidth, drawHeight)
}

function wrapText(value: string, limit: number): string[] {
  const words = value.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (candidate.length > limit && line) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
    if (lines.length === 2) break
  }
  if (line && lines.length < 2) lines.push(line)
  return lines
}

function drawCaption(context: CanvasRenderingContext2D, caption: string, reveal: number, theme: StoryReelTheme) {
  const safe = truncateStoryReelCaption(caption, 88)
  const visible = safe.slice(0, Math.max(0, Math.ceil(safe.length * Math.max(0, Math.min(1, reveal)))))
  const lines = wrapText(visible, 34)
  const color = THEME_COLORS[theme]
  context.save()
  context.fillStyle = 'rgba(0,0,0,0.38)'
  context.fillRect(0, context.canvas.height - 410, context.canvas.width, 340)
  context.fillStyle = color.ink
  context.font = '700 58px Georgia, serif'
  context.textBaseline = 'top'
  lines.forEach((line, index) => context.fillText(line, 72, context.canvas.height - 340 + index * 72, context.canvas.width - 144))
  context.restore()
}

function drawEndCard(context: CanvasRenderingContext2D, theme: StoryReelTheme, shareUrl: string, attribution: string) {
  const color = THEME_COLORS[theme]
  context.fillStyle = color.bg
  context.fillRect(0, 0, context.canvas.width, context.canvas.height)
  context.fillStyle = color.accent
  context.beginPath()
  context.arc(context.canvas.width - 120, 160, 110, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = color.ink
  context.font = '700 78px Georgia, serif'
  context.fillText('Made with Muse', 72, 760)
  context.font = '400 38px Arial, sans-serif'
  context.fillText(shareUrl, 72, 860)
  if (attribution) {
    context.font = '400 28px Arial, sans-serif'
    context.fillText(attribution, 72, 950, context.canvas.width - 144)
  }
}

async function loadImage(url: string, signal: AbortSignal): Promise<HTMLImageElement> {
  signal.throwIfAborted()
  return await new Promise((resolve, reject) => {
    const image = new Image()
    const timeout = setTimeout(() => reject(new Error('Image rendering timed out.')), 10000)
    const abort = () => reject(new DOMException('Cancelled', 'AbortError'))
    signal.addEventListener('abort', abort, { once: true })
    image.onload = () => {
      clearTimeout(timeout)
      signal.removeEventListener('abort', abort)
      resolve(image)
    }
    image.onerror = () => {
      clearTimeout(timeout)
      signal.removeEventListener('abort', abort)
      reject(new Error('Could not render reel imagery.'))
    }
    image.src = url
  })
}

async function prepareAudio(input: {
  moodTrack?: MoodMusicTrack
  narration?: Blob
  signal: AbortSignal
}): Promise<{ stream: MediaStream; stop: () => void } | null> {
  if (typeof AudioContext === 'undefined' || (!input.moodTrack && !input.narration)) return null
  const context = new AudioContext()
  const destination = context.createMediaStreamDestination()
  const cleanups: Array<() => void> = []
  let narrationUrl: string | null = null
  try {
    const attach = (audio: HTMLAudioElement, loop: boolean, volume: number) => {
      audio.loop = loop
      audio.volume = volume
      const source = context.createMediaElementSource(audio)
      source.connect(destination)
      cleanups.push(() => {
        source.disconnect()
        audio.pause()
        audio.src = ''
      })
      return audio.play().catch(() => undefined)
    }
    const starts: Promise<void>[] = []
    if (input.moodTrack) starts.push(attach(new Audio(input.moodTrack.src), true, 0.25))
    if (input.narration) {
      narrationUrl = URL.createObjectURL(input.narration)
      const audio = new Audio(narrationUrl)
      starts.push(attach(audio, false, 0.9))
    }
    await context.resume()
    await Promise.all(starts)
    input.signal.throwIfAborted()
    return {
      stream: destination.stream,
      stop: () => {
        cleanups.forEach(cleanup => cleanup())
        if (narrationUrl) URL.revokeObjectURL(narrationUrl)
        void context.close()
      }
    }
  } catch {
    cleanups.forEach(cleanup => cleanup())
    if (narrationUrl) URL.revokeObjectURL(narrationUrl)
    void context.close()
    return null
  }
}

export async function createStoryReelClip(input: {
  moments: StoryReelClipMoment[]
  theme: StoryReelTheme
  shareUrl: string
  signal: AbortSignal
  moodTrack?: MoodMusicTrack
  narration?: Blob
  onProgress: (progress: number) => void
}): Promise<Blob> {
  const mimeType = shareVideoType()
  if (!mimeType) throw new Error('Video recording is not supported in this browser.')
  if (!input.moments.length) throw new Error('Select at least one moment before rendering.')
  input.signal.throwIfAborted()

  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1920
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas rendering is unavailable.')

  const images = await Promise.all(input.moments.map(moment => loadImage(moment.image, input.signal)))
  const timeline = storyReelTimeline(images.length)
  const attribution = storyReelAttributionLine(input.moodTrack)
  const baseStream = canvas.captureStream(30)
  const audio = await prepareAudio({ moodTrack: input.moodTrack, narration: input.narration, signal: input.signal })
  const stream = audio ? new MediaStream([...baseStream.getVideoTracks(), ...audio.stream.getAudioTracks()]) : baseStream

  try {
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 7_000_000 })
    return await new Promise<Blob>((resolve, reject) => {
      const chunks: Blob[] = []
      let settled = false
      let frame = 0
      let start: number | undefined
      let stopTimer: ReturnType<typeof setTimeout>
      let watchdog: ReturnType<typeof setTimeout>

      const cleanup = () => {
        cancelAnimationFrame(frame)
        clearTimeout(stopTimer)
        clearTimeout(watchdog)
        input.signal.removeEventListener('abort', abort)
        document.removeEventListener('visibilitychange', visibility)
        recorder.ondataavailable = null
        recorder.onerror = null
        recorder.onstart = null
        recorder.onstop = null
      }
      const fail = (error: Error) => {
        if (settled) return
        settled = true
        cleanup()
        if (recorder.state !== 'inactive') recorder.stop()
        reject(error)
      }
      const abort = () => fail(new DOMException('Cancelled', 'AbortError'))
      const visibility = () => { if (document.hidden) fail(new Error('Keep this tab visible while rendering your reel.')) }

      const draw = () => {
        if (settled || recorder.state === 'inactive') return
        try {
          const elapsed = start === undefined ? 0 : Math.min((performance.now() - start) / 1000, timeline.totalSeconds)
          const momentSpan = timeline.momentSeconds
          const reelSpan = momentSpan * images.length

          if (elapsed < reelSpan) {
            const index = Math.min(images.length - 1, Math.floor(elapsed / momentSpan))
            const local = elapsed - index * momentSpan
            const progress = Math.max(0, Math.min(1, local / momentSpan))
            const fadeStart = Math.max(0, momentSpan - timeline.crossfadeSeconds)
            context.clearRect(0, 0, canvas.width, canvas.height)
            if (local >= fadeStart && index < images.length - 1) {
              const fade = Math.max(0, Math.min(1, (local - fadeStart) / Math.max(0.01, timeline.crossfadeSeconds)))
              context.save()
              context.globalAlpha = 1 - fade
              drawCover(context, images[index], progress, index + 1)
              context.restore()
              context.save()
              context.globalAlpha = fade
              drawCover(context, images[index + 1], Math.max(0, (local - fadeStart) / momentSpan), index + 2)
              context.restore()
            } else {
              drawCover(context, images[index], progress, index + 1)
            }
            drawCaption(context, input.moments[index].caption, progress / 0.7, input.theme)
          } else {
            drawEndCard(context, input.theme, input.shareUrl, attribution)
          }

          input.onProgress(Math.min(99, Math.floor(elapsed / timeline.totalSeconds * 100)))
          frame = requestAnimationFrame(draw)
        } catch {
          fail(new Error('Could not animate the story reel.'))
        }
      }

      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
      recorder.onerror = () => fail(new Error('Video encoding failed.'))
      recorder.onstop = () => {
        if (settled) return
        settled = true
        cleanup()
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType })
        if (!blob.size) {
          reject(new Error('Video recording was empty.'))
          return
        }
        input.onProgress(100)
        resolve(blob)
      }
      recorder.onstart = () => {
        start = performance.now()
        stopTimer = setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop() }, timeline.totalSeconds * 1000)
      }

      input.signal.addEventListener('abort', abort, { once: true })
      document.addEventListener('visibilitychange', visibility)
      try {
        recorder.start(250)
        frame = requestAnimationFrame(draw)
        watchdog = setTimeout(() => fail(new Error('Video rendering timed out.')), (timeline.totalSeconds + 12) * 1000)
        if (input.signal.aborted) abort()
        else visibility()
      } catch {
        fail(new Error('Could not start video rendering.'))
      }
    })
  } finally {
    audio?.stop()
    stream.getTracks().forEach(track => track.stop())
  }
}

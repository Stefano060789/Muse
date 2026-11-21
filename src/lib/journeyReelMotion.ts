import { SHARE_CARD_SIZES } from './personalStoryShareVisual'
import { drawStoryArtwork, type StoryMotif } from './storyShareArtwork'
import { journeyReelTiming, type JourneyReelRenderCard } from './journeyReelPlan'
import type { MoodMusicTrack } from './moodMusic'
import type { SceneMood } from './sceneMood'
import { shareVideoType } from './storyShareMotion'

type JourneyReelInput = {
  title: string
  titleSubtitle: string
  cards: readonly JourneyReelRenderCard[]
  primaryMood: SceneMood
  endingTitle: string
  shareLine: string
  choicePrefix: string
  rtl: boolean
  soundtrack?: MoodMusicTrack
  attributionLine?: string
  signal: AbortSignal
  onProgress: (progress: number) => void
}

type Segment =
  | { kind: 'title'; seconds: number; mood: SceneMood }
  | { kind: 'scene'; seconds: number; card: JourneyReelRenderCard }
  | { kind: 'ending'; seconds: number; mood: SceneMood }

const SIZE = SHARE_CARD_SIZES.story
const FONT_SERIF = '700 78px Georgia, serif'
const FONT_TITLE = '600 64px Georgia, serif'
const FONT_TEXT = '500 44px Georgia, serif'
const FONT_LABEL = '600 34px Arial, sans-serif'
const FONT_SMALL = '500 28px Arial, sans-serif'

const moodVisuals: Record<SceneMood, {
  top: string
  bottom: string
  ink: string
  accent: string
  motif: StoryMotif
}> = {
  reflection: { top: '#1f2d45', bottom: '#3f3554', ink: '#fdf3e6', accent: '#e3c18c', motif: 'light' },
  mystery: { top: '#171d30', bottom: '#31233f', ink: '#efe8ff', accent: '#b7a8ea', motif: 'doorway' },
  adventure: { top: '#182b2f', bottom: '#34414b', ink: '#f8efe2', accent: '#dec18c', motif: 'sword' },
  tension: { top: '#281a24', bottom: '#4a2233', ink: '#fdebf0', accent: '#e5a0bb', motif: 'doorway' },
  joy: { top: '#3a2d4f', bottom: '#70558a', ink: '#fff6df', accent: '#ffd38b', motif: 'light' },
  sorrow: { top: '#1c2a46', bottom: '#2f4f68', ink: '#e6f0fa', accent: '#93b8de', motif: 'ocean' },
  nature: { top: '#1f3b35', bottom: '#315d50', ink: '#ebf9ea', accent: '#c5e3a4', motif: 'map' },
  romance: { top: '#3d233b', bottom: '#754662', ink: '#fff1f5', accent: '#f2b7ca', motif: 'doorway' }
}

function tokensForWrap(text: string): string[] {
  if (!text.includes(' ')) return Array.from(text)
  return text.split(/\s+/).filter(Boolean)
}

function wrapLines(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (!trimmed) return []
  const hasSpaces = trimmed.includes(' ')
  const separator = hasSpaces ? ' ' : ''
  const chunks = tokensForWrap(trimmed)
  const lines: string[] = []
  let line = ''
  for (const chunk of chunks) {
    const next = line ? `${line}${separator}${chunk}` : chunk
    if (line && context.measureText(next).width > maxWidth) {
      lines.push(line)
      line = chunk
      if (lines.length === maxLines) break
    } else {
      line = next
    }
  }
  if (lines.length < maxLines && line) lines.push(line)
  if (lines.length === maxLines && chunks.length > 0) {
    const joined = lines.join(separator)
    if (joined.replace(/\s+/g, '') !== trimmed.replace(/\s+/g, '')) {
      lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[.…]+$/u, '')}…`
    }
  }
  return lines
}

function drawLines(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  maxLines: number,
  lineHeight: number,
  rtl: boolean
): number {
  const lines = wrapLines(context, text, maxWidth, maxLines)
  context.textAlign = rtl ? 'right' : 'left'
  context.direction = rtl ? 'rtl' : 'ltr'
  lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight))
  return y + Math.max(0, lines.length - 1) * lineHeight
}

function wordsForReveal(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' })
    const words = Array.from(segmenter.segment(text)).map(part => part.segment).filter(segment => /\S/u.test(segment))
    if (words.length > 1) return words
  }
  if (text.includes(' ')) return text.split(/\s+/).filter(Boolean)
  return Array.from(text)
}

function revealWords(text: string, progress: number): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  const words = wordsForReveal(trimmed)
  if (words.length <= 1) {
    const glyphs = Array.from(trimmed)
    return glyphs.slice(0, Math.max(1, Math.ceil(glyphs.length * progress))).join('')
  }
  const shown = Math.max(1, Math.ceil(words.length * progress))
  const spacer = trimmed.includes(' ') ? ' ' : ''
  return words.slice(0, shown).join(spacer)
}

function segmentTotal(segments: readonly Segment[]): number {
  return segments.reduce((sum, segment) => sum + segment.seconds, 0)
}

function moodForSegment(segment: Segment): SceneMood {
  return segment.kind === 'scene' ? segment.card.mood : segment.mood
}

function drawBackground(context: CanvasRenderingContext2D, mood: SceneMood, seconds: number): void {
  const { width, height } = SIZE
  const visual = moodVisuals[mood]
  const shift = Math.sin(seconds * 0.6) * width * 0.1
  const gradient = context.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, visual.top)
  gradient.addColorStop(1, visual.bottom)
  context.fillStyle = gradient
  context.fillRect(0, 0, width, height)
  context.save()
  context.globalAlpha = 0.65
  if (visual.motif !== 'light') drawStoryArtwork(context, visual.motif, 'story', seconds)
  context.restore()
  context.fillStyle = `${visual.accent}26`
  context.beginPath()
  context.arc(width * 0.17 + shift, height * 0.2, 210, 0, Math.PI * 2)
  context.fill()
  context.beginPath()
  context.arc(width * 0.86 - shift * 0.7, height * 0.83, 270, 0, Math.PI * 2)
  context.fill()
  context.strokeStyle = `${visual.accent}99`
  context.lineWidth = 2
  context.strokeRect(44, 44, width - 88, height - 88)
}

function drawTitleCard(context: CanvasRenderingContext2D, input: JourneyReelInput): void {
  const { width } = SIZE
  const visual = moodVisuals[input.primaryMood]
  const x = input.rtl ? width - 96 : 96
  context.fillStyle = visual.accent
  context.font = FONT_LABEL
  drawLines(context, input.titleSubtitle, x, 220, width - 192, 2, 42, input.rtl)
  context.fillStyle = visual.ink
  context.font = FONT_SERIF
  drawLines(context, input.title, x, 740, width - 192, 4, 90, input.rtl)
}

function drawSceneCard(context: CanvasRenderingContext2D, segment: Extract<Segment, { kind: 'scene' }>, input: JourneyReelInput, progress: number): void {
  const { width, height } = SIZE
  const visual = moodVisuals[segment.card.mood]
  const x = input.rtl ? width - 96 : 96
  context.fillStyle = visual.accent
  context.font = FONT_LABEL
  drawLines(context, `Scene ${segment.card.sceneNumber}`, x, 200, width - 192, 1, 40, input.rtl)
  context.fillStyle = visual.ink
  context.font = FONT_TITLE
  const bottom = drawLines(context, segment.card.title, x, 460, width - 192, 3, 76, input.rtl)
  if (!segment.card.choiceLine) return
  context.fillStyle = `${visual.accent}33`
  context.fillRect(72, Math.max(660, bottom + 70), width - 144, 520)
  context.fillStyle = visual.accent
  context.font = FONT_LABEL
  drawLines(context, input.choicePrefix, x, Math.max(730, bottom + 130), width - 192, 2, 44, input.rtl)
  context.fillStyle = visual.ink
  context.font = FONT_TEXT
  drawLines(context, revealWords(segment.card.choiceLine, progress), x, Math.max(820, bottom + 220), width - 192, 6, 58, input.rtl)
}

function drawEndingCard(context: CanvasRenderingContext2D, input: JourneyReelInput): void {
  const { width, height } = SIZE
  const visual = moodVisuals[input.primaryMood]
  const x = input.rtl ? width - 96 : 96
  context.fillStyle = visual.ink
  context.font = FONT_SERIF
  drawLines(context, input.endingTitle, x, 840, width - 192, 2, 90, input.rtl)
  context.font = FONT_TEXT
  drawLines(context, input.shareLine, x, 1080, width - 192, 4, 58, input.rtl)
  if (!input.attributionLine) return
  context.fillStyle = visual.accent
  context.font = FONT_SMALL
  drawLines(context, input.attributionLine, x, height - 170, width - 192, 3, 38, input.rtl)
}

function drawSegment(context: CanvasRenderingContext2D, segment: Segment, input: JourneyReelInput, localSeconds: number, progress: number): void {
  drawBackground(context, moodForSegment(segment), localSeconds)
  if (segment.kind === 'title') drawTitleCard(context, input)
  else if (segment.kind === 'scene') drawSceneCard(context, segment, input, progress)
  else drawEndingCard(context, input)
}

async function setupSoundtrack(track: MoodMusicTrack | undefined): Promise<{
  stream?: MediaStream
  start: () => Promise<void>
  stop: () => void
}> {
  if (!track || typeof Audio === 'undefined' || typeof AudioContext === 'undefined') {
    return { start: async () => {}, stop: () => {} }
  }
  try {
    const audio = new Audio(track.src)
    audio.preload = 'auto'
    audio.loop = true
    const context = new AudioContext()
    const source = context.createMediaElementSource(audio)
    const gain = context.createGain()
    const destination = context.createMediaStreamDestination()
    gain.gain.value = 0.26
    source.connect(gain)
    gain.connect(destination)
    return {
      stream: destination.stream,
      start: async () => {
        if (context.state === 'suspended') await context.resume()
        try { await audio.play() } catch {}
      },
      stop: () => {
        audio.pause()
        audio.src = ''
        destination.stream.getTracks().forEach(track => track.stop())
        void context.close()
      }
    }
  } catch {
    return { start: async () => {}, stop: () => {} }
  }
}

export async function createJourneyReelClip(input: JourneyReelInput): Promise<Blob> {
  const mimeType = shareVideoType()
  if (!mimeType) throw new Error('Video recording is not supported.')
  input.signal.throwIfAborted()
  const canvas = document.createElement('canvas')
  canvas.width = SIZE.width
  canvas.height = SIZE.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas rendering is unavailable.')

  const timing = journeyReelTiming(input.cards.length)
  const segments: Segment[] = [
    { kind: 'title', seconds: timing.titleSeconds, mood: input.primaryMood },
    ...input.cards.map(card => ({ kind: 'scene', seconds: timing.sceneSeconds, card }) as const),
    { kind: 'ending', seconds: timing.endingSeconds, mood: input.primaryMood }
  ]
  const totalSeconds = segmentTotal(segments)
  let captureStream: MediaStream | undefined
  let recorderStream: MediaStream | undefined
  const soundtrack = await setupSoundtrack(input.soundtrack)

  try {
    captureStream = canvas.captureStream(30)
    const tracks = [
      ...captureStream.getVideoTracks(),
      ...(soundtrack.stream ? soundtrack.stream.getAudioTracks() : [])
    ]
    recorderStream = new MediaStream(tracks)
    const recorder = new MediaRecorder(recorderStream, { mimeType, videoBitsPerSecond: 8_000_000 })
    return await new Promise<Blob>((resolve, reject) => {
      const chunks: Blob[] = []
      let settled = false
      let frame = 0
      let start: number | undefined
      let stopTimer: ReturnType<typeof setTimeout>
      let watchdog: ReturnType<typeof setTimeout>
      const fadeSeconds = 0.45

      const cleanup = () => {
        cancelAnimationFrame(frame)
        clearTimeout(stopTimer)
        clearTimeout(watchdog)
        input.signal.removeEventListener('abort', abort)
        document.removeEventListener('visibilitychange', visibility)
        recorder.ondataavailable = null
        recorder.onerror = null
        recorder.onstop = null
        recorder.onstart = null
      }
      const fail = (error: Error) => {
        if (settled) return
        settled = true
        cleanup()
        if (recorder.state !== 'inactive') recorder.stop()
        reject(error)
      }
      const abort = () => fail(new DOMException('Cancelled', 'AbortError'))
      const visibility = () => {
        if (document.hidden) fail(new Error('Keep this tab visible while creating the reel.'))
      }

      const segmentAt = (seconds: number) => {
        let elapsed = 0
        for (let index = 0; index < segments.length; index++) {
          const segment = segments[index]
          const next = elapsed + segment.seconds
          if (seconds <= next || index === segments.length - 1) {
            return { index, segment, local: Math.max(0, seconds - elapsed) }
          }
          elapsed = next
        }
        return { index: segments.length - 1, segment: segments[segments.length - 1], local: 0 }
      }

      const paint = (seconds: number) => {
        const current = segmentAt(seconds)
        const localProgress = Math.min(1, current.local / current.segment.seconds)
        context.clearRect(0, 0, SIZE.width, SIZE.height)
        if (current.local < fadeSeconds && current.index > 0) {
          const previous = segments[current.index - 1]
          context.globalAlpha = 1 - current.local / fadeSeconds
          drawSegment(context, previous, input, previous.seconds, 1)
          context.globalAlpha = current.local / fadeSeconds
          drawSegment(context, current.segment, input, current.local, localProgress)
        } else if (current.local > current.segment.seconds - fadeSeconds && current.index < segments.length - 1) {
          const blend = (current.local - (current.segment.seconds - fadeSeconds)) / fadeSeconds
          context.globalAlpha = 1 - blend
          drawSegment(context, current.segment, input, current.local, localProgress)
          context.globalAlpha = blend
          drawSegment(context, segments[current.index + 1], input, 0, 0)
        } else {
          context.globalAlpha = 1
          drawSegment(context, current.segment, input, current.local, localProgress)
        }
        context.globalAlpha = 1
      }

      recorder.ondataavailable = event => {
        if (event.data.size) chunks.push(event.data)
      }
      recorder.onerror = () => fail(new Error('Video encoding failed.'))
      recorder.onstop = () => {
        if (settled) return
        settled = true
        cleanup()
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType })
        if (!blob.size || start === undefined || performance.now() - start < (totalSeconds - 0.3) * 1000) {
          reject(new Error('Video recording was empty or incomplete.'))
        } else {
          input.onProgress(100)
          resolve(blob)
        }
      }
      recorder.onstart = () => {
        start = performance.now()
        stopTimer = setTimeout(() => {
          if (recorder.state !== 'inactive') recorder.stop()
        }, totalSeconds * 1000)
      }

      const draw = () => {
        if (settled || recorder.state === 'inactive') return
        try {
          const elapsed = start === undefined ? 0 : Math.min((performance.now() - start) / 1000, totalSeconds)
          paint(elapsed)
          input.onProgress(Math.min(99, Math.floor(elapsed / totalSeconds * 100)))
          frame = requestAnimationFrame(draw)
        } catch {
          fail(new Error('Could not render the journey reel.'))
        }
      }

      input.signal.addEventListener('abort', abort, { once: true })
      document.addEventListener('visibilitychange', visibility)
      try {
        paint(0)
        recorder.start(250)
        frame = requestAnimationFrame(draw)
        watchdog = setTimeout(() => fail(new Error('Video recording timed out.')), (totalSeconds + 10) * 1000)
        void soundtrack.start()
        if (input.signal.aborted) abort()
        else visibility()
      } catch {
        fail(new Error('Could not start video recording.'))
      }
    })
  } finally {
    soundtrack.stop()
    recorderStream?.getTracks().forEach(track => track.stop())
    captureStream?.getTracks().forEach(track => track.stop())
  }
}

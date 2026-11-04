import { SHARE_CARD_SIZES, type ShareCardFormat, type ShareCardTheme } from './personalStoryShareVisual'
import { drawStoryArtwork, type StoryMotif } from './storyShareArtwork'

export const SHARE_CLIP_SECONDS = 6
const VIDEO_TYPES = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']

export function shareVideoType(): string | null {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function' || typeof HTMLCanvasElement === 'undefined' ||
    typeof HTMLCanvasElement.prototype.captureStream !== 'function') return null
  return VIDEO_TYPES.find(type => MediaRecorder.isTypeSupported(type)) ?? null
}

export function drawShareMotion(
  context: CanvasRenderingContext2D, image: CanvasImageSource, width: number, height: number,
  seconds: number, theme: ShareCardTheme, motif: StoryMotif = 'light', format: ShareCardFormat = 'story'
): void {
  const phase = seconds / SHARE_CLIP_SECONDS * Math.PI * 2
  const accent = theme === 'starlight' ? '229,195,140' : '134,97,54'
  context.drawImage(image, 0, 0, width, height)
  if (motif !== 'light') drawStoryArtwork(context, motif, format, seconds)
  context.save()
  const glowX = width * (0.5 + 0.4 * Math.sin(phase))
  const glow = context.createRadialGradient(glowX, height * 0.25, 0, glowX, height * 0.25, width * 0.75)
  glow.addColorStop(0, `rgba(${accent},0.12)`)
  glow.addColorStop(1, `rgba(${accent},0)`)
  context.fillStyle = glow
  context.fillRect(0, 0, width, height)
  for (let i = 0; i < 24; i++) {
    const x = (i % 2 ? 0.045 : 0.955) * width + Math.sin(phase + i) * 12
    const y = height * (0.07 + (i / 24) * 0.86) + Math.cos(phase + i * 0.7) * 18
    const alpha = 0.22 + 0.35 * (0.5 + 0.5 * Math.sin(phase + i))
    context.fillStyle = `rgba(${accent},${alpha})`
    context.beginPath()
    context.arc(x, y, i % 3 === 0 ? 3 : 1.5, 0, Math.PI * 2)
    context.fill()
  }
  context.strokeStyle = `rgba(${accent},0.25)`
  context.lineWidth = 1.5
  for (let i = 0; i < 3; i++) {
    const y = height - 44 + i * 10
    context.beginPath()
    context.moveTo(60, y)
    context.bezierCurveTo(width * 0.3, y - 25 * Math.sin(phase + i), width * 0.7, y + 25 * Math.sin(phase + i), width - 60, y)
    context.stroke()
  }
  context.restore()
}

export async function createShareClip(input: {
  svg: string; format: ShareCardFormat; theme: ShareCardTheme; signal: AbortSignal
  motif?: StoryMotif
  onProgress: (progress: number) => void
}): Promise<Blob> {
  const mimeType = shareVideoType()
  if (!mimeType) throw new Error('Video recording is not supported.')
  input.signal.throwIfAborted()
  const canvas = document.createElement('canvas')
  const { width, height } = SHARE_CARD_SIZES[input.format]
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas rendering is unavailable.')
  const image = new Image()
  const svgUrl = URL.createObjectURL(new Blob([input.svg], { type: 'image/svg+xml;charset=utf-8' }))
  let stream: MediaStream | undefined
  try {
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        image.onload = null
        image.onerror = null
        input.signal.removeEventListener('abort', abort)
        clearTimeout(timeout)
        if (error) reject(error)
        else resolve()
      }
      const abort = () => finish(new DOMException('Cancelled', 'AbortError'))
      const timeout = setTimeout(() => finish(new Error('Image rendering timed out.')), 10000)
      input.signal.addEventListener('abort', abort, { once: true })
      image.onload = () => finish()
      image.onerror = () => finish(new Error('Could not render the share card.'))
      image.src = svgUrl
    })
    input.signal.throwIfAborted()
    drawShareMotion(context, image, width, height, 0, input.theme, input.motif, input.format)
    stream = canvas.captureStream(30)
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 })
    return await new Promise<Blob>((resolve, reject) => {
      const chunks: Blob[] = []
      let frame = 0
      let settled = false
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
      const visibility = () => { if (document.hidden) fail(new Error('Keep this tab visible while creating the clip.')) }
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
      recorder.onerror = () => fail(new Error('Video encoding failed.'))
      recorder.onstop = () => {
        if (settled) return
        settled = true
        cleanup()
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType })
        if (!blob.size || start === undefined || performance.now() - start < (SHARE_CLIP_SECONDS - 0.3) * 1000) {
          reject(new Error('Video recording was empty or incomplete.'))
        } else { input.onProgress(100); resolve(blob) }
      }
      input.signal.addEventListener('abort', abort, { once: true })
      document.addEventListener('visibilitychange', visibility)
      recorder.onstart = () => {
        start = performance.now()
        stopTimer = setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop() }, SHARE_CLIP_SECONDS * 1000)
      }
      const draw = () => {
        if (settled || recorder.state === 'inactive') return
        try {
          const elapsed = start === undefined ? 0 : Math.min((performance.now() - start) / 1000, SHARE_CLIP_SECONDS)
          drawShareMotion(context, image, width, height, elapsed, input.theme, input.motif, input.format)
          input.onProgress(Math.min(99, Math.floor(elapsed / SHARE_CLIP_SECONDS * 100)))
          frame = requestAnimationFrame(draw)
        } catch { fail(new Error('Could not animate the share card.')) }
      }
      try {
        recorder.start(250)
        frame = requestAnimationFrame(draw)
        watchdog = setTimeout(() => fail(new Error('Video recording timed out.')), (SHARE_CLIP_SECONDS + 10) * 1000)
        if (input.signal.aborted) abort()
        else visibility()
      } catch { fail(new Error('Could not start video recording.')) }
    })
  } finally {
    stream?.getTracks().forEach(track => track.stop())
    URL.revokeObjectURL(svgUrl)
  }
}

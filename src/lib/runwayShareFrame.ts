import { createStoryFrameSvg, type StoryMotif } from './storyShareArtwork'

export async function createRunwayFrameDataUrl(motif: StoryMotif): Promise<string> {
  const svgUrl = URL.createObjectURL(new Blob([createStoryFrameSvg(motif)], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        window.clearTimeout(timeout)
        image.onload = null
        image.onerror = null
        if (error) reject(error)
        else resolve()
      }
      const timeout = window.setTimeout(() => finish(new Error('The cinematic frame took too long to render.')), 10000)
      image.onload = () => finish()
      image.onerror = () => finish(new Error('Could not render the cinematic frame.'))
      image.src = svgUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = 720
    canvas.height = 1280
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas rendering is unavailable.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const frame = canvas.toDataURL('image/jpeg', 0.82)
    if (!frame.startsWith('data:image/jpeg;base64,') || frame.length > 1_400_000) {
      throw new Error('The cinematic frame is invalid or too large.')
    }
    return frame
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

import type { SharedStoryContent } from './sharedStory'

export function sharedStoryPreviewText(content: SharedStoryContent): string {
  return [content.title, content.description, ...content.scenes.map((scene, index) =>
    `Scene ${index + 1}. ${scene.title}. ${scene.body} Clue: ${scene.clue}`
  )].join('\n\n')
}

export function recipientShareDetails(origin: string, token: string) {
  const base = new URL(origin)
  const hostname = base.hostname.toLowerCase()
  const localOnly = hostname === 'localhost' || hostname.endsWith('.localhost') ||
    hostname === '[::1]' || hostname === '::1' || hostname === '0.0.0.0' ||
    /^127\./.test(hostname)
  const url = `${base.origin}/shared#play=${encodeURIComponent(token)}`
  const text = 'I made a mystery for you in Muse. Open this link to explore the story and discover your message.'
  return {
    url,
    text,
    localOnly,
    whatsappUrl: `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`
  }
}

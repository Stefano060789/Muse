export type KeepsakeStory = {
  title: string
  creatorName: string
  recipientName: string
  dedication?: string
  scenes: { title: string; body: string }[]
  message?: string
}

const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char))

export function keepsakeHtml(story: KeepsakeStory, includeMessage = false): string {
  const paragraph = (text: string) => `<p>${escape(text)}</p>`
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Story keepsake</title><style>body{max-width:640px;margin:auto;padding:24px;font-family:Georgia,serif;color:#28231f;background:white;overflow-wrap:anywhere}p{white-space:pre-wrap;line-height:1.8}h1,h2{break-after:avoid}@media print{body{padding:0}}</style></head><body><h1>${escape(story.title)}</h1>${paragraph(`From ${story.creatorName}, for ${story.recipientName}`)}${story.dedication ? paragraph(story.dedication) : ''}${story.scenes.map(scene => `<section><h2>${escape(scene.title)}</h2>${paragraph(scene.body)}</section>`).join('')}${includeMessage && story.message ? `<section><h2>A message for you</h2>${paragraph(story.message)}</section>` : ''}</body></html>`
}

const chunkBytes = 4 * 1024 * 1024
const maxBytes = 30 * 1024 * 1024

export async function videoBlob(
  first: Response, next: (offset: number) => Promise<Response>, requireChunks: boolean
): Promise<Blob> {
  const header = first.headers.get('X-Muse-Video-Total')
  if (!header && !requireChunks) return first.blob()
  if (!header || !/^\d+$/.test(header)) throw new Error('Invalid video download information.')
  const total = Number(header)
  if (!Number.isSafeInteger(total) || total < 12 || total > maxBytes) throw new Error('Invalid video download size.')
  const chunks: Blob[] = []
  for (let offset = 0; offset < total; offset += chunkBytes) {
    const response = offset === 0 ? first : await next(offset)
    if (response.headers.get('X-Muse-Video-Total') !== header) throw new Error('Video changed during download. Try again.')
    const part = await response.blob()
    if (!part.type.startsWith('video/mp4') || part.size !== Math.min(chunkBytes, total - offset)) {
      throw new Error('Video download was incomplete. Try again.')
    }
    chunks.push(part)
  }
  return new Blob(chunks, { type: 'video/mp4' })
}

import { createHash, timingSafeEqual } from 'crypto'
import { createWriteStream, promises as fs } from 'fs'
import { dirname } from 'path'
import { Transform } from 'stream'
import { pipeline } from 'stream/promises'
import type { NextApiRequest, NextApiResponse } from 'next'
import { SharedStoryError } from '../../lib/sharedStory'
import { storyRepository, storyStorageMode } from '../../lib/storyRepository'
import { requireCreatorAccess } from '../../lib/creatorAccess'
import { localMediaPath } from '../../lib/sharedMediaStore'
import { apiSafety, reportOperation } from '../../lib/operations'

// Local SQLite mode only: receives the creator's file directly from the device
// into private storage outside public/. Hosted mode uploads straight to a
// private Supabase bucket through a single-use signed upload URL instead.
export const config = { api: { bodyParser: false }, maxDuration: 60 }

const hash = (value: string) => createHash('sha256').update(value).digest()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Referrer-Policy', 'no-referrer')
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!await apiSafety(req, res)) return
  const origin = req.headers.origin
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host) return res.status(403).json({ error: 'Cross-origin uploads are not allowed.' })
    } catch {
      return res.status(403).json({ error: 'Invalid request origin.' })
    }
  }
  let part = ''
  try {
    if (storyStorageMode() !== 'sqlite') throw new SharedStoryError('Hosted uploads go directly to private storage.', 404)
    if (!requireCreatorAccess(req, res)) return
    const capability = req.headers['x-muse-upload']
    if (typeof capability !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[0-9a-f]{64}$/.test(capability)) {
      throw new SharedStoryError('This upload link is invalid.', 404)
    }
    const [uploadId, uploadSecret] = capability.split('.')
    const db = storyRepository()
    const record = await db.mediaGet(uploadId) ?? await db.voiceGet(uploadId)
    const expected = record ? Buffer.from(record.upload_hash, 'hex') : Buffer.alloc(0)
    if (!record || record.status !== 'pending' || expected.length !== 32 || !timingSafeEqual(hash(uploadSecret), expected) || !await db.findUnexpired(record.story_id)) {
      throw new SharedStoryError('This upload link is invalid or has already been used.', 404)
    }
    if (Date.parse(record.upload_expires_at) <= Date.now()) throw new SharedStoryError('The upload window expired. Choose the file again; your story is unchanged.', 410)
    if (String(req.headers['content-type'] ?? '').toLowerCase() !== record.mime) throw new SharedStoryError('The file type does not match the declared photo or video.', 415)
    const declaredLength = req.headers['content-length']
    if (declaredLength !== undefined && Number(declaredLength) !== Number(record.size)) throw new SharedStoryError('The file size does not match the declared size.', 413)
    const path = localMediaPath(record.object_key)
    await fs.mkdir(dirname(path), { recursive: true, mode: 0o700 })
    try {
      await fs.access(path)
      throw new SharedStoryError('This upload was already received.', 409)
    } catch (error) {
      if (error instanceof SharedStoryError) throw error
    }
    part = `${path}.part`
    let received = 0
    const limit = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        received += chunk.length
        if (received > Number(record.size)) callback(new SharedStoryError('The file is larger than declared.', 413))
        else callback(null, chunk)
      }
    })
    try {
      await pipeline(req, limit, createWriteStream(part, { flags: 'wx', mode: 0o600 }))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        part = ''
        throw new SharedStoryError('This upload is already in progress.', 409)
      }
      throw error instanceof SharedStoryError ? error : new SharedStoryError('The upload was interrupted. Retry it; your story is unchanged.', 400)
    }
    if (received !== Number(record.size)) throw new SharedStoryError('The upload was incomplete. Retry it; your story is unchanged.', 400)
    await fs.rename(part, path)
    part = ''
    return res.status(200).json({ received: true })
  } catch (error) {
    if (part) await fs.unlink(part).catch(() => undefined)
    if (error instanceof SharedStoryError) return res.status(error.status).json({ error: error.message })
    console.error('Shared media upload failed', error instanceof Error ? error.name : 'Unknown error')
    await reportOperation('storage-failure')
    return res.status(500).json({ error: 'The upload failed. Your story is unchanged; please try again.' })
  }
}
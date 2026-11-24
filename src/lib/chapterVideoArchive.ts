import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { SharedStoryError } from './sharedStory'
import { deleteHeygenAsset, downloadHeygenVideo, heygenReelStatus } from './heygenReel'

const bucketName = 'muse-chapter-videos'
const day = 86400000
const leaseDuration = 10 * 60000
export const CHAPTER_VIDEO_CHUNK_BYTES = 4 * 1024 * 1024
const maxVideoBytes = 30 * 1024 * 1024
const videoId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
type VideoStatus = 'starting' | 'pending' | 'ready' | 'failed' | 'unknown'
type Video = {
  id: string; owner_id: string; chapter_id: string; story_id: string; chapter_number: number
  status: VideoStatus; provider_reference: string | null; created_at: string; expires_at: string
  asset_ids: string[]
  next_check_at: string
  lease_id: string | null; lease_until: string | null
}

export function chapterVideoArchiveEnabled() {
  return process.env.MUSE_CHAPTER_VIDEO_ARCHIVE_ENABLED === 'true'
}

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new SharedStoryError('Private chapter video storage is not configured.', 503)
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(20000) }) }
  })
}

function failure(): never {
  console.error(JSON.stringify({ event: 'chapter-video-storage-failure' }))
  throw new SharedStoryError('Private video storage is unavailable. Please try again later.', 503)
}

function id(value: unknown): string {
  if (typeof value !== 'string' || !videoId.test(value)) throw new SharedStoryError('Invalid video reference.', 400)
  return value
}

function checked(row: unknown): Video {
  if (!row || typeof row !== 'object') return failure()
  const value = row as Video
  if (!videoId.test(value.id) || typeof value.owner_id !== 'string' || typeof value.chapter_id !== 'string' ||
      typeof value.story_id !== 'string' || !Number.isInteger(value.chapter_number) ||
      !['starting', 'pending', 'ready', 'failed', 'unknown'].includes(value.status) ||
      !(value.provider_reference === null || typeof value.provider_reference === 'string') ||
      !Array.isArray(value.asset_ids) || value.asset_ids.some(asset => typeof asset !== 'string') ||
      !Number.isFinite(Date.parse(value.created_at)) || !Number.isFinite(Date.parse(value.expires_at)) ||
      !Number.isFinite(Date.parse(value.next_check_at))) return failure()
  return value
}

function publicVideo(video: Video) {
  return {
    id: video.id, chapterId: video.chapter_id, storyId: video.story_id,
    chapterNumber: video.chapter_number, status: video.status, expiresAt: video.expires_at
  }
}

export async function assertChapterVideoReady() {
  if (!chapterVideoArchiveEnabled()) throw new SharedStoryError('Chapter video archive is not enabled.', 503)
  const client = db()
  const [bucket, heartbeat] = await Promise.all([
    client.storage.getBucket(bucketName),
    client.from('muse_chapter_video_maintenance').select('completed_at').eq('id', true).maybeSingle()
  ])
  const completed = Date.parse(heartbeat.data?.completed_at ?? '')
  const maxBytes = Number(bucket.data?.file_size_limit)
  if (bucket.error || bucket.data?.public !== false || !bucket.data.allowed_mime_types?.includes('video/mp4') ||
      !Number.isFinite(maxBytes) || maxBytes < 30 * 1024 * 1024 || heartbeat.error || !Number.isFinite(completed) ||
      completed > Date.now() || Date.now() - completed > 20 * 60000) {
    throw new SharedStoryError('Video creation is paused until private storage and the cleanup service are ready.', 503)
  }
}

export async function beginChapterVideo(owner: string, chapter: string, story: string, chapterNumber: number) {
  if (owner === 'local-development') throw new SharedStoryError('Archived videos require a signed-in account and Supabase story storage.', 503)
  await assertChapterVideoReady()
  const video: Video = {
    id: randomUUID(), owner_id: owner, chapter_id: chapter, story_id: story, chapter_number: chapterNumber,
    status: 'starting', provider_reference: null, asset_ids: [], created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + day).toISOString(), next_check_at: new Date(Date.now() + day).toISOString(), lease_id: randomUUID(),
    lease_until: new Date(Date.now() + leaseDuration).toISOString()
  }
  const { error } = await db().from('muse_chapter_videos').insert(video)
  if (error) return failure()
  return video
}

export async function finishChapterVideoStart(video: Video, reference: string | null) {
  const { data, error } = await db().from('muse_chapter_videos')
    .update({ status: reference ? 'pending' : 'unknown', provider_reference: reference, lease_id: null, lease_until: null,
      next_check_at: reference ? new Date().toISOString() : video.expires_at })
    .eq('id', video.id).eq('owner_id', video.owner_id).eq('lease_id', video.lease_id).eq('status', 'starting').select('id')
  if (error || data?.length !== 1) return failure()
}

export async function registerChapterVideoAsset(video: Video, asset: string) {
  const assets = [...video.asset_ids, asset]
  const { data, error } = await db().from('muse_chapter_videos').update({ asset_ids: assets })
    .eq('id', video.id).eq('owner_id', video.owner_id).eq('lease_id', video.lease_id).eq('status', 'starting').select('id')
  if (error || data?.length !== 1) {
    try { await deleteHeygenAsset(asset) }
    catch { console.error(JSON.stringify({ event: 'chapter-video-untracked-asset-cleanup-failure' })) }
    return failure()
  }
  video.asset_ids = assets
}

async function findVideo(owner: string, value: unknown, includeExpired = false) {
  let query = db().from('muse_chapter_videos').select('*').eq('id', id(value)).eq('owner_id', owner)
  if (!includeExpired) query = query.gt('expires_at', new Date().toISOString())
  const { data, error } = await query.maybeSingle()
  if (error) return failure()
  if (!data) throw new SharedStoryError('Video not found or expired.', 404)
  return checked(data)
}

export async function listChapterVideos(owner: string) {
  if (!chapterVideoArchiveEnabled() || owner === 'local-development') return { enabled: false, videos: [] }
  const { data, error } = await db().from('muse_chapter_videos').select('*').eq('owner_id', owner)
    .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(100)
  if (error || !Array.isArray(data)) return failure()
  return { enabled: true, videos: data.map(row => publicVideo(checked(row))) }
}

async function lease(video: Video) {
  const leaseId = randomUUID()
  const now = new Date().toISOString()
  const { data, error } = await db().from('muse_chapter_videos')
    .update({ lease_id: leaseId, lease_until: new Date(Date.now() + leaseDuration).toISOString() })
    .eq('id', video.id).or(`lease_until.is.null,lease_until.lt.${now}`).select('*').maybeSingle()
  if (error) return failure()
  return data ? { video: checked(data), leaseId } : null
}

async function release(video: Video, leaseId: string) {
  const { error } = await db().from('muse_chapter_videos').update({ lease_id: null, lease_until: null })
    .eq('id', video.id).eq('lease_id', leaseId)
  if (error) return failure()
}

async function processVideo(video: Video) {
  const acquired = await lease(video)
  if (!acquired) return
  const current = acquired.video
  const client = db()
  try {
    let result: Awaited<ReturnType<typeof heygenReelStatus>> | null = null
    if (current.status === 'pending' && current.provider_reference &&
        (Date.parse(current.expires_at) > Date.now() || current.asset_ids.length > 0)) {
      result = await heygenReelStatus(current.owner_id, current.provider_reference, true)
    }
    const terminal = result?.status === 'completed' || result?.status === 'failed' || result?.status === 'cancelled'
    if (current.asset_ids.length && (terminal ||
        (current.status !== 'pending' && Date.parse(current.created_at) + day <= Date.now()))) {
      const deleted = await Promise.allSettled(current.asset_ids.map(deleteHeygenAsset))
      if (deleted.some(result => result.status === 'rejected')) {
        throw new SharedStoryError('HeyGen photo cleanup failed; it will be retried.', 502)
      }
      const { error } = await client.from('muse_chapter_videos').update({ asset_ids: [] })
        .eq('id', current.id).eq('lease_id', acquired.leaseId)
      if (error) return failure()
      current.asset_ids = []
    }
    if (Date.parse(current.expires_at) <= Date.now()) {
      if (current.asset_ids.length) {
        const { error } = await client.from('muse_chapter_videos')
          .update({ next_check_at: new Date(Date.now() + 5 * 60000).toISOString() })
          .eq('id', current.id).eq('lease_id', acquired.leaseId)
        if (error) return failure()
        return
      }
      const { error: removeError } = await client.storage.from(bucketName).remove([`${current.id}.mp4`])
      if (removeError) return failure()
      const { error } = await client.from('muse_chapter_videos').delete().eq('id', current.id).eq('lease_id', acquired.leaseId)
      if (error) return failure()
      return
    }
    if (current.status !== 'pending' || !current.provider_reference) return
    if (result?.status === 'failed' || result?.status === 'cancelled') {
      const { error } = await client.from('muse_chapter_videos')
        .update({ status: 'failed', provider_reference: null, next_check_at: current.expires_at })
        .eq('id', current.id).eq('lease_id', acquired.leaseId).eq('expires_at', current.expires_at)
      if (error) return failure()
      return
    }
    if (result?.status !== 'completed') {
      const { error } = await client.from('muse_chapter_videos')
        .update({ next_check_at: new Date(Date.now() + 5 * 60000).toISOString() })
        .eq('id', current.id).eq('lease_id', acquired.leaseId)
      if (error) return failure()
      return
    }
    const bytes = await downloadHeygenVideo(result.url)
    const { error: uploadError } = await client.storage.from(bucketName).upload(`${current.id}.mp4`, bytes, {
      contentType: 'video/mp4', upsert: true, cacheControl: '0'
    })
    if (uploadError) return failure()
    // Do not extend an expiry changed by an owner deleting the video mid-download.
    const expiresAt = new Date(Date.now() + 7 * day).toISOString()
    const { error } = await client.from('muse_chapter_videos').update({
      status: 'ready', provider_reference: null, expires_at: expiresAt, next_check_at: expiresAt
    }).eq('id', current.id).eq('lease_id', acquired.leaseId).eq('expires_at', current.expires_at)
    if (error) return failure()
  } finally { await release(current, acquired.leaseId) }
}

export async function chapterVideoStatus(owner: string, value: unknown) {
  const video = await findVideo(owner, value)
  if (video.status === 'pending') await processVideo(video)
  return publicVideo(await findVideo(owner, value))
}

export async function readChapterVideo(owner: string, value: unknown, offset: unknown = 0) {
  if (!Number.isSafeInteger(offset) || Number(offset) < 0 || Number(offset) % CHAPTER_VIDEO_CHUNK_BYTES !== 0 ||
      Number(offset) >= maxVideoBytes) throw new SharedStoryError('Invalid video download offset.', 400)
  const video = await findVideo(owner, value)
  if (video.status !== 'ready') throw new SharedStoryError('Video is not ready yet.', 409)
  const { data, error } = await db().storage.from(bucketName).createSignedUrl(`${video.id}.mp4`, 60)
  if (error || !data?.signedUrl) return failure()
  let url: URL
  try { url = new URL(data.signedUrl) } catch { return failure() }
  if (url.protocol !== 'https:' || url.origin !== new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin ||
      url.username || url.password) return failure()
  const start = Number(offset)
  const response = await fetch(url, {
    headers: { Range: `bytes=${start}-${start + CHAPTER_VIDEO_CHUNK_BYTES - 1}` },
    redirect: 'error', signal: AbortSignal.timeout(20000)
  })
  const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('content-range') || '')
  if (response.status !== 206 || !range || !response.body) return failure()
  const first = Number(range[1]), last = Number(range[2]), total = Number(range[3])
  if (first !== start || !Number.isSafeInteger(total) || total < 12 || total > maxVideoBytes ||
      last !== Math.min(start + CHAPTER_VIDEO_CHUNK_BYTES, total) - 1 || last < first) return failure()
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value: part, done } = await reader.read()
      if (done) break
      size += part.length
      if (size > last - first + 1) return failure()
      chunks.push(part)
    }
  } finally { await reader.cancel() }
  const bytes = Buffer.concat(chunks)
  if (bytes.length !== last - first + 1 || (start === 0 && bytes.toString('ascii', 4, 8) !== 'ftyp')) return failure()
  await findVideo(owner, value)
  return { bytes, total }
}

export async function deleteChapterVideo(owner: string, value: unknown) {
  const video = await findVideo(owner, value, true)
  const { error } = await db().from('muse_chapter_videos')
    .update({ expires_at: new Date().toISOString(), next_check_at: new Date().toISOString() })
    .eq('id', video.id).eq('owner_id', owner)
  if (error) return failure()
  await processVideo(await findVideo(owner, video.id, true))
}

export async function maintainChapterVideos() {
  const client = db()
  const { data, error } = await client.from('muse_chapter_videos').select('*')
    .lte('next_check_at', new Date().toISOString()).order('next_check_at').limit(31)
  if (error || !Array.isArray(data)) return failure()
  const results = await Promise.allSettled(data.slice(0, 5).map(row => processVideo(checked(row))))
  if (results.some(result => result.status === 'rejected') || data.length > 5) {
    console.error(JSON.stringify({ event: 'chapter-video-maintenance-backlog-or-failure' }))
    throw new SharedStoryError('Video maintenance needs operator attention; retry and inspect operational logs.', 503)
  }
  const { error: heartbeatError } = await client.from('muse_chapter_video_maintenance')
    .upsert({ id: true, completed_at: new Date().toISOString() })
  if (heartbeatError) return failure()
}

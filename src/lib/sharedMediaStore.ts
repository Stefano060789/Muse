import { promises as fs } from 'fs'
import { join, relative, resolve, sep, isAbsolute } from 'path'
import { createClient } from '@supabase/supabase-js'
import { SharedStoryError } from './sharedStory'
import { storyStorageMode } from './storyRepository'
import {
  SHARED_MEDIA_BUCKET, SHARED_MEDIA_DOWNLOAD_TTL_SECONDS, SHARED_MEDIA_KEY_PATTERN,
  type SharedMediaRecord, type SharedVoiceRecord
} from './sharedStoryMedia'

export type MediaUploadTarget = { method: 'PUT'; url: string; headers: Record<string, string>; sameOrigin: boolean }
export type MediaObjectStat = { size: number; head: Uint8Array; contentType?: string }
export type MediaDelivery = { type: 'url'; url: string; expiresAt: string } | { type: 'file'; path: string }
export interface SharedMediaStore {
  ready(requiredMime?: string): Promise<void>
  createUpload(record: SharedMediaRecord | SharedVoiceRecord, uploadSecret: string): Promise<MediaUploadTarget>
  stat(key: string): Promise<MediaObjectStat | null>
  read(key: string, maxBytes: number): Promise<Uint8Array | null>
  remove(keys: string[]): Promise<void>
  deliver(key: string): Promise<MediaDelivery>
}

const HEAD_BYTES = 4096
const unavailable = () => new SharedStoryError('Private photo and video storage is unavailable. Your story is unchanged; try again later.', 503)

function checkedKey(key: string): string {
  if (!SHARED_MEDIA_KEY_PATTERN.test(key)) throw new SharedStoryError('Invalid private media reference.', 500)
  return key
}

export function localMediaRoot(): string {
  const root = resolve(process.env.MUSE_MEDIA_PATH || resolve('data', 'shared-media'))
  const fromPublic = relative(resolve('public'), root)
  if (!fromPublic || (!fromPublic.startsWith('..') && !isAbsolute(fromPublic))) {
    console.error('Local media storage configuration failed: MUSE_MEDIA_PATH is inside public/')
    throw new SharedStoryError('Local media storage must be outside the public folder.', 503)
  }
  return root
}

export function localMediaPath(key: string): string {
  const root = localMediaRoot()
  const path = join(root, ...checkedKey(key).split('/'))
  if (!path.startsWith(root + sep)) throw new SharedStoryError('Invalid private media reference.', 500)
  return path
}

async function readHead(path: string): Promise<Uint8Array> {
  const handle = await fs.open(path, 'r')
  try {
    const buffer = Buffer.alloc(HEAD_BYTES)
    const { bytesRead } = await handle.read(buffer, 0, HEAD_BYTES, 0)
    return buffer.subarray(0, bytesRead)
  } finally { await handle.close() }
}

export class LocalMediaStore implements SharedMediaStore {
  async ready(_requiredMime?: string) {
    await fs.mkdir(localMediaRoot(), { recursive: true, mode: 0o700 })
  }
  async createUpload(record: SharedMediaRecord | SharedVoiceRecord, uploadSecret: string): Promise<MediaUploadTarget> {
    localMediaPath(record.object_key)
    return {
      method: 'PUT', url: '/api/shared-story-upload', sameOrigin: true,
      headers: { 'Content-Type': record.mime, 'X-Muse-Upload': `${record.id}.${uploadSecret}` }
    }
  }
  async stat(key: string) {
    const path = localMediaPath(key)
    try {
      const info = await fs.stat(path)
      if (!info.isFile()) return null
      return { size: info.size, head: await readHead(path) }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw unavailable()
    }
  }
  async read(key: string, maxBytes: number) {
    const path = localMediaPath(key)
    try {
      const info = await fs.stat(path)
      if (!info.isFile() || info.size > maxBytes) return null
      return await fs.readFile(path)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw unavailable()
    }
  }
  async remove(keys: string[]) {
    for (const key of keys) {
      const path = localMediaPath(key)
      for (const file of [path, `${path}.part`]) {
        try { await fs.unlink(file) } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw unavailable()
        }
      }
      try { await fs.rmdir(resolve(path, '..')) } catch { /* Directory still holds another upload. */ }
    }
  }
  async deliver(key: string): Promise<MediaDelivery> {
    return { type: 'file', path: localMediaPath(key) }
  }
}

export class SupabaseMediaStore implements SharedMediaStore {
  private readonly origin: string
  private readonly bucket
  private readonly storage
  constructor(url: string, serviceKey: string) {
    this.origin = new URL(url).origin
    this.storage = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }).storage
    this.bucket = this.storage.from(SHARED_MEDIA_BUCKET)
  }
  async ready(requiredMime?: string) {
    const { data, error } = await this.storage.getBucket(SHARED_MEDIA_BUCKET)
    if (error || !data || data.public !== false) {
      throw new SharedStoryError('Private media storage is not ready. Apply the Muse shared-story media migration and keep the Muse media bucket private.', 503)
    }
    if (requiredMime && !data.allowed_mime_types?.includes(requiredMime)) {
      throw new SharedStoryError('Private WAV storage is not ready. Apply supabase/shared-story-gifts.sql before creating a gift story.', 503)
    }
  }
  // Only URLs on the configured Supabase project are ever handed out or fetched.
  private sameProject(url: string): string {
    if (new URL(url).origin !== this.origin) throw unavailable()
    return url
  }
  async createUpload(record: SharedMediaRecord | SharedVoiceRecord): Promise<MediaUploadTarget> {
    await this.ready()
    const { data, error } = await this.bucket.createSignedUploadUrl(checkedKey(record.object_key))
    if (error || !data?.signedUrl) throw unavailable()
    return {
      method: 'PUT', url: this.sameProject(data.signedUrl), sameOrigin: false,
      headers: { 'Content-Type': record.mime, 'x-upsert': 'false', 'cache-control': 'max-age=0' }
    }
  }
  async stat(key: string) {
    const { data, error } = await this.bucket.info(checkedKey(key))
    if (error || !data) {
      const status = Number((error as { statusCode?: string | number; status?: number } | null)?.statusCode ?? (error as { status?: number } | null)?.status)
      if (status === 400 || status === 404 || /not.?found/i.test(error?.message ?? '')) return null
      throw unavailable()
    }
    const signed = await this.bucket.createSignedUrl(key, 60)
    if (signed.error || !signed.data?.signedUrl) throw unavailable()
    const response = await fetch(this.sameProject(signed.data.signedUrl), { headers: { Range: `bytes=0-${HEAD_BYTES - 1}` }, redirect: 'error' })
    if (!response.ok || !response.body) throw unavailable()
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let length = 0
    while (length < HEAD_BYTES) {
      const { done, value } = await reader.read()
      if (done || !value) break
      chunks.push(value)
      length += value.length
    }
    await reader.cancel().catch(() => undefined)
    return { size: Number(data.size), contentType: data.contentType, head: Buffer.concat(chunks).subarray(0, HEAD_BYTES) }
  }
  async read(key: string, maxBytes: number) {
    const { data, error } = await this.bucket.info(checkedKey(key))
    if (error || !data) {
      const status = Number((error as { statusCode?: string | number; status?: number } | null)?.statusCode ?? (error as { status?: number } | null)?.status)
      if (status === 400 || status === 404 || /not.?found/i.test(error?.message ?? '')) return null
      throw unavailable()
    }
    if (Number(data.size) > maxBytes) return null
    const signed = await this.bucket.createSignedUrl(checkedKey(key), 60)
    if (signed.error || !signed.data?.signedUrl) throw unavailable()
    const response = await fetch(this.sameProject(signed.data.signedUrl), { redirect: 'error' })
    if (!response.ok || !response.body) throw unavailable()
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let length = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (!value) continue
        length += value.length
        if (length > maxBytes) {
          await reader.cancel()
          return null
        }
        chunks.push(value)
      }
    } finally {
      await reader.cancel().catch(() => undefined)
    }
    if (length !== Number(data.size)) return null
    return Buffer.concat(chunks).subarray(0, maxBytes)
  }
  async remove(keys: string[]) {
    if (!keys.length) return
    const { error } = await this.bucket.remove(keys.map(checkedKey))
    if (error) throw unavailable()
  }
  async deliver(key: string): Promise<MediaDelivery> {
    const { data, error } = await this.bucket.createSignedUrl(checkedKey(key), SHARED_MEDIA_DOWNLOAD_TTL_SECONDS)
    if (error || !data?.signedUrl) throw unavailable()
    return { type: 'url', url: this.sameProject(data.signedUrl), expiresAt: new Date(Date.now() + SHARED_MEDIA_DOWNLOAD_TTL_SECONDS * 1000).toISOString() }
  }
}

let override: SharedMediaStore | null = null
// Test seam: replaces the object store without touching repository behaviour.
export function setSharedMediaStoreForTests(store: SharedMediaStore | null) { override = store }

export function sharedMediaStore(): SharedMediaStore {
  if (override) return override
  if (storyStorageMode() === 'sqlite') return new LocalMediaStore()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new SharedStoryError('Private media storage is not configured. Configure Supabase and apply shared-story-media.sql.', 503)
  try { return new SupabaseMediaStore(url, key) } catch { throw unavailable() }
}
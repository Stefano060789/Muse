import { mkdirSync, promises as fs } from 'fs'
import { dirname, resolve } from 'path'
import type { DatabaseSync } from 'node:sqlite'
import { SharedStoryError } from './sharedStory'
import { storyStorageMode } from './storyRepository'

export type RunwayJob = {
  id: string; owner_id: string; fingerprint: string; credits: number; created_at: string
  status: 'reserved' | 'submitted' | 'ready' | 'failed' | 'unknown'
  task_id: string | null
}
export const RUNWAY_BUCKET = 'muse-runway-clips'
export const RUNWAY_MAX_BYTES = 30 * 1024 * 1024
const schema = `CREATE TABLE IF NOT EXISTS muse_runway_jobs (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, fingerprint TEXT NOT NULL,
  credits INTEGER NOT NULL, created_at TEXT NOT NULL, status TEXT NOT NULL, task_id TEXT
);`

function dbPath() { return resolve(process.env.MUSE_RUNWAY_SQLITE_PATH || 'data\\runway-share.sqlite') }
function videoPath(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new SharedStoryError('Invalid cinematic clip reference.', 400)
  return resolve(dirname(dbPath()), 'runway-clips', `${id}.mp4`)
}
function local<T>(run: (db: DatabaseSync) => T): T {
  const path = dbPath()
  const fromPublic = resolve('public')
  if (path === fromPublic || path.startsWith(fromPublic + '\\')) throw new SharedStoryError('Runway storage must be private.', 503)
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const { DatabaseSync: Sqlite } = require('node:sqlite') as typeof import('node:sqlite')
  const db = new Sqlite(path)
  let active = false
  try {
    db.exec(`PRAGMA busy_timeout=10000; PRAGMA journal_mode=WAL; BEGIN IMMEDIATE; ${schema}`)
    active = true
    const result = run(db)
    db.exec('COMMIT')
    active = false
    return result
  } finally { if (active) db.exec('ROLLBACK'); db.close() }
}
async function hosted() {
  const { createClient } = await import('@supabase/supabase-js')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing configuration')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) }
  })
}
function storageFailure(): never {
  console.error(JSON.stringify({ event: 'runway-storage-failure' }))
  throw new SharedStoryError('Private cinematic storage is unavailable. Check configuration and apply supabase/runway-sharing.sql.', 503)
}
function checkedJob(value: unknown): RunwayJob {
  if (!value || typeof value !== 'object') return storageFailure()
  const row = value as RunwayJob
  if (typeof row.id !== 'string' || typeof row.owner_id !== 'string' || typeof row.fingerprint !== 'string' ||
    !Number.isInteger(row.credits) || !['reserved', 'submitted', 'ready', 'failed', 'unknown'].includes(row.status) ||
    typeof row.created_at !== 'string' || !(row.task_id === null || typeof row.task_id === 'string')) return storageFailure()
  return row
}
export async function runwayStoreReady() {
  try {
    if (storyStorageMode() === 'sqlite') { local(() => undefined); return }
    const db = await hosted()
    const [table, bucket] = await Promise.all([
      db.from('muse_runway_jobs').select('id').limit(1), db.storage.getBucket(RUNWAY_BUCKET)
    ])
    if (table.error || bucket.error || bucket.data?.public !== false ||
      !bucket.data.allowed_mime_types?.includes('video/mp4')) return storageFailure()
  } catch (error) { if (error instanceof SharedStoryError) throw error; return storageFailure() }
}
export async function reserveRunwayJob(job: RunwayJob, budget: number, accountDailyCap: number): Promise<{ reserved: boolean; job: RunwayJob }> {
  try {
    if (storyStorageMode() === 'sqlite') return local(db => {
      const existing = db.prepare('SELECT * FROM muse_runway_jobs WHERE id=?').get(job.id)
      if (existing) {
        const row = checkedJob(existing)
        if (row.owner_id !== job.owner_id || row.fingerprint !== job.fingerprint) throw new SharedStoryError('This cinematic request ID is already used.', 409)
        return { reserved: false, job: row }
      }
      const spent = Number(db.prepare('SELECT COALESCE(SUM(credits),0) AS used FROM muse_runway_jobs').get()!.used)
      const count = Number(db.prepare('SELECT COUNT(*) AS used FROM muse_runway_jobs WHERE owner_id=? AND created_at>=?')
        .get(job.owner_id, job.created_at.slice(0, 10))!.used)
      if (spent + job.credits > budget || count >= accountDailyCap) throw new SharedStoryError('Cinematic spending or account daily limit reached.', 429)
      db.prepare('INSERT INTO muse_runway_jobs VALUES (?,?,?,?,?,?,?)')
        .run(job.id, job.owner_id, job.fingerprint, job.credits, job.created_at, job.status, job.task_id)
      return { reserved: true, job }
    })
    const { data, error } = await (await hosted()).rpc('muse_reserve_runway_job', {
      p_id: job.id, p_owner: job.owner_id, p_fingerprint: job.fingerprint, p_credits: job.credits,
      p_budget: budget, p_daily_cap: accountDailyCap
    })
    if (error || !data || typeof data.reserved !== 'boolean') return storageFailure()
    if (data.limited) throw new SharedStoryError('Cinematic spending or account daily limit reached.', 429)
    if (data.conflict) throw new SharedStoryError('This cinematic request ID is already used.', 409)
    return { reserved: data.reserved, job: checkedJob(data.job) }
  } catch (error) { if (error instanceof SharedStoryError) throw error; return storageFailure() }
}
export async function runwayJobs(owner: string): Promise<RunwayJob[]> {
  try {
    if (storyStorageMode() === 'sqlite') return local(db =>
      db.prepare('SELECT * FROM muse_runway_jobs WHERE owner_id=? ORDER BY created_at DESC LIMIT 10').all(owner).map(checkedJob))
    const { data, error } = await (await hosted()).from('muse_runway_jobs').select('*').eq('owner_id', owner).order('created_at', { ascending: false }).limit(10)
    if (error || !data) return storageFailure()
    return data.map(checkedJob)
  } catch (error) { if (error instanceof SharedStoryError) throw error; return storageFailure() }
}
export async function runwayJob(owner: string, id: string): Promise<RunwayJob> {
  try {
    let row: unknown
    if (storyStorageMode() === 'sqlite') row = local(db => db.prepare('SELECT * FROM muse_runway_jobs WHERE id=? AND owner_id=?').get(id, owner))
    else {
      const { data, error } = await (await hosted()).from('muse_runway_jobs').select('*').eq('id', id).eq('owner_id', owner).maybeSingle()
      if (error) return storageFailure()
      row = data
    }
    if (!row) throw new SharedStoryError('Cinematic clip not found for this account.', 404)
    return checkedJob(row)
  } catch (error) { if (error instanceof SharedStoryError) throw error; return storageFailure() }
}
export async function updateRunwayJob(job: RunwayJob) {
  try {
    if (storyStorageMode() === 'sqlite') {
      const count = local(db => db.prepare('UPDATE muse_runway_jobs SET status=?,task_id=? WHERE id=? AND owner_id=?')
        .run(job.status, job.task_id, job.id, job.owner_id).changes)
      if (!count) return storageFailure()
    } else {
      const { data, error } = await (await hosted()).from('muse_runway_jobs').update({ status: job.status, task_id: job.task_id })
        .eq('id', job.id).eq('owner_id', job.owner_id).select('id')
      if (error || data?.length !== 1) return storageFailure()
    }
  } catch (error) { if (error instanceof SharedStoryError) throw error; return storageFailure() }
}
export async function writeRunwayVideo(job: RunwayJob, bytes: Uint8Array) {
  try {
    if (storyStorageMode() === 'sqlite') {
      const path = videoPath(job.id)
      await fs.mkdir(dirname(path), { recursive: true, mode: 0o700 })
      await fs.writeFile(path, bytes, { mode: 0o600 })
    } else {
      const { error } = await (await hosted()).storage.from(RUNWAY_BUCKET).upload(`${job.owner_id}/${job.id}.mp4`, bytes, {
        contentType: 'video/mp4', upsert: true, cacheControl: '0'
      })
      if (error) return storageFailure()
    }
  } catch (error) { if (error instanceof SharedStoryError) throw error; return storageFailure() }
}
export async function readRunwayVideo(job: RunwayJob): Promise<Uint8Array> {
  try {
    if (storyStorageMode() === 'sqlite') {
      const path = videoPath(job.id)
      if ((await fs.stat(path)).size > RUNWAY_MAX_BYTES) return storageFailure()
      return await fs.readFile(path)
    }
    const { data, error } = await (await hosted()).storage.from(RUNWAY_BUCKET).download(`${job.owner_id}/${job.id}.mp4`)
    if (error || !data || data.size > RUNWAY_MAX_BYTES) return storageFailure()
    return new Uint8Array(await data.arrayBuffer())
  } catch (error) { if (error instanceof SharedStoryError) throw error; return storageFailure() }
}

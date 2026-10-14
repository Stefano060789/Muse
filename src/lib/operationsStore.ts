import { mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import type { DatabaseSync } from 'node:sqlite'
import { SharedStoryError } from './sharedStory'

export type OperationReservation = { allowed: boolean; used: number; notify: boolean }
export type OperationAlert = { event: string; created_at: string }
const schema = `
CREATE TABLE IF NOT EXISTS muse_operations_counters (
  bucket TEXT PRIMARY KEY, used INTEGER NOT NULL DEFAULT 0, expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS muse_operations_alerts (
  id TEXT PRIMARY KEY, event TEXT NOT NULL, created_at TEXT NOT NULL
);`

function localPath() {
  if (process.env.VERCEL) return null
  if (process.env.MUSE_OPERATIONS_SQLITE_PATH) return resolve(process.env.MUSE_OPERATIONS_SQLITE_PATH)
  if (process.env.STORY_STORAGE === 'sqlite') return `${resolve(process.env.MUSE_SQLITE_PATH || resolve('data', 'muse-stories.sqlite'))}.operations.sqlite`
  return null
}

function local<T>(filename: string, run: (db: DatabaseSync) => T): T {
  mkdirSync(dirname(filename), { recursive: true, mode: 0o700 })
  const { DatabaseSync: Sqlite } = require('node:sqlite') as typeof import('node:sqlite')
  const db = new Sqlite(filename)
  let active = false
  try {
    db.exec('PRAGMA busy_timeout=10000; PRAGMA journal_mode=WAL; BEGIN IMMEDIATE;')
    active = true
    db.exec(schema)
    const now = new Date(Date.now()).toISOString()
    db.prepare('DELETE FROM muse_operations_counters WHERE expires_at <= ?').run(now)
    db.prepare('DELETE FROM muse_operations_alerts WHERE created_at < ?').run(new Date(Date.now() - 7 * 86400000).toISOString())
    const result = run(db)
    db.exec('COMMIT')
    active = false
    return result
  } finally {
    if (active) db.exec('ROLLBACK')
    db.close()
  }
}

async function hosted() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Operations storage configuration missing')
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function unavailable(): never {
  console.error(JSON.stringify({ event: 'operations-storage-unavailable' }))
  throw new SharedStoryError('Operational safety controls are unavailable. Check the server configuration and operations migration.', 503)
}

export async function consumeOperation(bucket: string, limit: number, expiresAt: string, warning = limit): Promise<OperationReservation> {
  if (!/^[a-z0-9:-]{1,160}$/.test(bucket) || !Number.isInteger(limit) || limit < 1 || limit > 10000 ||
      !Number.isInteger(warning) || warning < 1 || warning > limit || !Number.isFinite(Date.parse(expiresAt))) {
    throw new SharedStoryError('Invalid operational limit configuration.', 503)
  }
  try {
    const filename = localPath()
    if (filename) return local(filename, db => {
      db.prepare('INSERT OR IGNORE INTO muse_operations_counters(bucket, used, expires_at) VALUES (?, 0, ?)').run(bucket, expiresAt)
      const used = Number(db.prepare('SELECT used FROM muse_operations_counters WHERE bucket=?').get(bucket)!.used)
      if (used >= limit) return { allowed: false, used, notify: false }
      db.prepare('UPDATE muse_operations_counters SET used=used+1 WHERE bucket=?').run(bucket)
      return { allowed: true, used: used + 1, notify: used + 1 === warning }
    })
    const { data, error } = await (await hosted()).rpc('muse_consume_operation', {
      p_bucket: bucket, p_limit: limit, p_expires_at: expiresAt, p_warning: warning
    })
    if (error || typeof data?.allowed !== 'boolean' || !Number.isInteger(data?.used) || typeof data?.notify !== 'boolean') return unavailable()
    return data as OperationReservation
  } catch (error) {
    if (error instanceof SharedStoryError) throw error
    return unavailable()
  }
}

export async function storeOperationAlert(id: string, event: string): Promise<boolean> {
  try {
    const filename = localPath()
    if (filename) return local(filename, db => Number(db.prepare(
      'INSERT OR IGNORE INTO muse_operations_alerts(id,event,created_at) VALUES (?,?,?)'
    ).run(id, event, new Date(Date.now()).toISOString()).changes) > 0)
    const { data, error } = await (await hosted()).rpc('muse_record_operation_alert', { p_id: id, p_event: event })
    if (error || typeof data !== 'boolean') return unavailable()
    return data
  } catch (error) {
    if (error instanceof SharedStoryError) throw error
    return unavailable()
  }
}

export async function operationStatus(bucket: string) {
  try {
    const filename = localPath()
    if (filename) return local(filename, db => ({
      used: Number(db.prepare('SELECT used FROM muse_operations_counters WHERE bucket=?').get(bucket)?.used || 0),
      alerts: db.prepare('SELECT event,created_at FROM muse_operations_alerts ORDER BY created_at DESC LIMIT 50').all() as OperationAlert[]
    }))
    const db = await hosted()
    const [counter, alerts] = await Promise.all([
      db.from('muse_operations_counters').select('used').eq('bucket', bucket).maybeSingle(),
      db.from('muse_operations_alerts').select('event,created_at').gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()).order('created_at', { ascending: false }).limit(50)
    ])
    if (counter.error || alerts.error) return unavailable()
    return { used: Number(counter.data?.used || 0), alerts: (alerts.data || []) as OperationAlert[] }
  } catch (error) {
    if (error instanceof SharedStoryError) throw error
    return unavailable()
  }
}

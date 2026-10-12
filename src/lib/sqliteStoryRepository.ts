import { mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import type { DatabaseSync as SqliteDatabase } from 'node:sqlite'
import { normalizeSharedAnswer, SharedStoryError } from './sharedStory'
import type { StoryRepository, StoredStory, PlayerState, RequestKind } from './storyRepository'
import { storyStorageError } from './storyStorageErrors'

const schema = `
CREATE TABLE IF NOT EXISTS shared_stories (
  id TEXT PRIMARY KEY, owner_hash TEXT NOT NULL, play_hash TEXT NOT NULL,
  brief TEXT NOT NULL, content TEXT NOT NULL, answer_normalized TEXT NOT NULL,
  alternative_answers_normalized TEXT NOT NULL DEFAULT '[]',
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS story_expiry ON shared_stories(expires_at);
CREATE TABLE IF NOT EXISTS shared_story_sessions (
  story_id TEXT NOT NULL REFERENCES shared_stories(id) ON DELETE CASCADE,
  player_hash TEXT NOT NULL, current_scene INTEGER NOT NULL DEFAULT 0,
  solved INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0,
  revealed_hints INTEGER NOT NULL DEFAULT 0,
  last_attempt_at INTEGER, PRIMARY KEY (story_id, player_hash)
);
CREATE TABLE IF NOT EXISTS shared_story_generation_limits (
  bucket TEXT PRIMARY KEY, count INTEGER NOT NULL
);`

export class SqliteStoryRepository implements StoryRepository {
  private readonly filename: string
  constructor() {
    this.filename = resolve(process.env.MUSE_SQLITE_PATH || resolve('data', 'muse-stories.sqlite'))
  }

  private transaction<T>(run: (db: SqliteDatabase, now: number) => T): T {
    let db: SqliteDatabase | undefined
    let active = false
    try {
      if (process.env.VERCEL) throw new SharedStoryError('SQLite story storage is not supported on Vercel. Configure Supabase instead.', 503)
      mkdirSync(dirname(this.filename), { recursive: true, mode: 0o700 })
      const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite')
      db = new DatabaseSync(this.filename)
      db.exec('PRAGMA busy_timeout = 10000; PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;')
      db.exec('BEGIN IMMEDIATE')
      active = true
      db.exec(schema)
      const columns = (table: string) => db!.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name)
      if (!columns('shared_stories').includes('alternative_answers_normalized')) {
        db.exec("ALTER TABLE shared_stories ADD COLUMN alternative_answers_normalized TEXT NOT NULL DEFAULT '[]'")
      }
      if (!columns('shared_story_sessions').includes('revealed_hints')) {
        db.exec('ALTER TABLE shared_story_sessions ADD COLUMN revealed_hints INTEGER NOT NULL DEFAULT 0')
      }
      const now = Date.now()
      db.prepare('DELETE FROM shared_stories WHERE expires_at <= ?').run(new Date(now).toISOString())
      const result = run(db, now)
      db.exec('COMMIT')
      active = false
      return result
    } catch (error) {
      if (active) {
        try { db?.exec('ROLLBACK') } catch { /* Preserve the original failure. */ }
      }
      if (error instanceof SharedStoryError) throw error
      throw storyStorageError(error)
    } finally {
      try { db?.close() } catch (error) { throw storyStorageError(error) }
    }
  }

  async insert(story: StoredStory) {
    this.transaction(db => {
      db.prepare('INSERT INTO shared_stories (id, owner_hash, play_hash, brief, content, answer_normalized, alternative_answers_normalized, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(story.id, story.owner_hash, story.play_hash, JSON.stringify(story.brief), JSON.stringify(story.content), story.answer_normalized, JSON.stringify((story.brief.alternativeAnswers ?? []).map(normalizeSharedAnswer)), story.expires_at)
    })
  }

  async findUnexpired(id: string) {
    return this.transaction(db => {
      const row = db.prepare('SELECT * FROM shared_stories WHERE id = ?').get(id)
      return row ? { ...row, brief: JSON.parse(String(row.brief)), content: JSON.parse(String(row.content)), alternative_answers_normalized: JSON.parse(String(row.alternative_answers_normalized)) } as StoredStory : null
    })
  }

  async delete(id: string) {
    this.transaction(db => { db.prepare('DELETE FROM shared_stories WHERE id = ?').run(id) })
  }

  async rotate(id: string, playHash: string) {
    this.transaction(db => { db.prepare('UPDATE shared_stories SET play_hash = ? WHERE id = ?').run(playHash, id) })
  }

  async advance(id: string, sessionHash: string, action: 'open' | 'next' | 'guess' | 'hint', guess: string, playHash?: string): Promise<PlayerState> {
    return this.transaction((db, now) => {
      const story = db.prepare('SELECT brief, content, play_hash, answer_normalized, alternative_answers_normalized FROM shared_stories WHERE id = ?').get(id)
      if (!story || (playHash !== undefined && story.play_hash !== playHash)) throw new SharedStoryError('This story link is invalid, expired, or has been deleted.', 404)
      if (!['open', 'next', 'guess', 'hint'].includes(action)) throw new SharedStoryError('Invalid story action.')
      if (action === 'open') db.prepare('INSERT INTO shared_story_sessions(story_id, player_hash) VALUES (?, ?) ON CONFLICT DO NOTHING').run(id, sessionHash)
      const player = db.prepare('SELECT * FROM shared_story_sessions WHERE story_id = ? AND player_hash = ?').get(id, sessionHash)
      if (!player) throw new SharedStoryError('Player session is invalid. Reopen the story link.')
      let scene = Number(player.current_scene)
      let solved = Boolean(player.solved)
      let attempts = Number(player.attempts)
      let lastAttempt = player.last_attempt_at as number | null
      let revealedHints = Number(player.revealed_hints)
      if (!solved && action === 'guess') {
        if (attempts >= 30) throw new SharedStoryError('Guess limit reached', 429)
        if (lastAttempt !== null && lastAttempt > now - 2000) throw new SharedStoryError('Please wait before guessing again', 429)
        solved = guess === story.answer_normalized || JSON.parse(String(story.alternative_answers_normalized)).includes(guess)
        attempts += 1
        lastAttempt = now
      } else if (!solved && action === 'next') {
        scene = Math.min(scene + 1, JSON.parse(String(story.content)).scenes.length - 1)
      } else if (!solved && action === 'hint') {
        revealedHints = Math.min(revealedHints + 1, (JSON.parse(String(story.brief)).assistanceHints ?? []).length)
      }
      db.prepare('UPDATE shared_story_sessions SET current_scene = ?, solved = ?, attempts = ?, last_attempt_at = ?, revealed_hints = ? WHERE story_id = ? AND player_hash = ?')
        .run(scene, Number(solved), attempts, lastAttempt, revealedHints, id, sessionHash)
      return { current_scene: scene, solved, revealed_hints: revealedHints }
    })
  }

  async reserve(clientHash: string, kind: RequestKind) {
    return this.transaction((db, now) => {
      if (kind !== 'generate' && kind !== 'guess') throw new SharedStoryError('Invalid request kind.')
      const date = new Date(now).toISOString()
      const day = `day:${date.slice(0, 10)}:${kind}`
      const hour = `hour:${date.slice(0, 13).replace('T', '-')}:${kind}:${clientHash}`
      const older = new Date(now - 2 * 86400000).toISOString()
      db.prepare("DELETE FROM shared_story_generation_limits WHERE (bucket LIKE 'day:%' AND bucket < ?) OR (bucket LIKE 'hour:%' AND bucket < ?)")
        .run(`day:${older.slice(0, 10)}`, `hour:${older.slice(0, 13).replace('T', '-')}`)
      const buckets: [string, number][] = [[day, kind === 'generate' ? 100 : 5000], [hour, kind === 'generate' ? 5 : 60]]
      for (const [bucket, cap] of buckets) {
        db.prepare('INSERT INTO shared_story_generation_limits(bucket, count) VALUES (?, 0) ON CONFLICT DO NOTHING').run(bucket)
        if (Number(db.prepare('SELECT count FROM shared_story_generation_limits WHERE bucket = ?').get(bucket)!.count) >= cap) return false
      }
      db.prepare('UPDATE shared_story_generation_limits SET count = count + 1 WHERE bucket IN (?, ?)').run(day, hour)
      return true
    })
  }
}

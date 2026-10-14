import { mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import type { DatabaseSync as SqliteDatabase } from 'node:sqlite'
import { normalizeSharedAnswer, SharedStoryError } from './sharedStory'
import type { StoryRepository, StoredStory, PlayerState, RequestKind } from './storyRepository'
import { storyStorageError } from './storyStorageErrors'
import type { AdventureRequest, AdventureResult, AdventureTurn } from './sharedAdventure'
import { JOURNEY_TURNS, journeySnapshot, type JourneyOperation, type JourneyRecord, type JourneyResult } from './personalJourney'
import { SHARED_MEDIA_PENDING_GRACE_MS as MEDIA_PENDING_GRACE_MS, type SharedMediaRecord } from './sharedStoryMedia'

const schema = `
CREATE TABLE IF NOT EXISTS shared_stories (
  id TEXT PRIMARY KEY, owner_hash TEXT NOT NULL, play_hash TEXT NOT NULL,
  brief TEXT NOT NULL, content TEXT NOT NULL, answer_normalized TEXT NOT NULL,
  alternative_answers_normalized TEXT NOT NULL DEFAULT '[]',
  expires_at TEXT NOT NULL, media_attempts INTEGER NOT NULL DEFAULT 0
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
);
CREATE TABLE IF NOT EXISTS muse_adventure_sessions (
  story_id TEXT NOT NULL REFERENCES shared_stories(id) ON DELETE CASCADE,
  player_hash TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0,
  turn TEXT, PRIMARY KEY(story_id, player_hash)
);
CREATE TABLE IF NOT EXISTS muse_adventure_requests (
  story_id TEXT NOT NULL, player_hash TEXT NOT NULL, request_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL, status TEXT NOT NULL, reserved_at INTEGER NOT NULL,
  revision INTEGER NOT NULL, result TEXT,
  PRIMARY KEY(story_id, player_hash, request_id),
  FOREIGN KEY(story_id, player_hash) REFERENCES muse_adventure_sessions(story_id, player_hash) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS muse_adventure_budgets (
  bucket TEXT PRIMARY KEY, used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS muse_personal_journeys (
  id TEXT PRIMARY KEY, capability_hash TEXT NOT NULL, record TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS muse_personal_journey_requests (
  journey_id TEXT NOT NULL REFERENCES muse_personal_journeys(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL, fingerprint TEXT NOT NULL, kind TEXT NOT NULL,
  status TEXT NOT NULL, reserved_at INTEGER NOT NULL, revision INTEGER NOT NULL,
  PRIMARY KEY(journey_id, request_id)
);
CREATE TABLE IF NOT EXISTS shared_story_media (
  id TEXT PRIMARY KEY, story_id TEXT NOT NULL REFERENCES shared_stories(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE, kind TEXT NOT NULL CHECK (kind IN ('photo', 'video')),
  mime TEXT NOT NULL, size INTEGER NOT NULL CHECK (size > 0 AND size <= 20971520),
  status TEXT NOT NULL CHECK (status IN ('pending', 'ready')), upload_hash TEXT NOT NULL,
  upload_expires_at TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS shared_story_media_one_ready ON shared_story_media(story_id) WHERE status = 'ready';
CREATE TABLE IF NOT EXISTS shared_story_media_purge (object_key TEXT PRIMARY KEY, queued_at TEXT NOT NULL);
CREATE TRIGGER IF NOT EXISTS shared_story_media_queue_purge AFTER DELETE ON shared_story_media
BEGIN
  INSERT OR IGNORE INTO shared_story_media_purge(object_key, queued_at) VALUES (old.object_key, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;`

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
      if (!columns('shared_stories').includes('media_attempts')) {
        db.exec('ALTER TABLE shared_stories ADD COLUMN media_attempts INTEGER NOT NULL DEFAULT 0')
      }
      if (!columns('shared_story_sessions').includes('revealed_hints')) {
        db.exec('ALTER TABLE shared_story_sessions ADD COLUMN revealed_hints INTEGER NOT NULL DEFAULT 0')
      }
      const now = Date.now()
      db.prepare('DELETE FROM shared_stories WHERE expires_at <= ?').run(new Date(now).toISOString())
      db.prepare('DELETE FROM muse_personal_journeys WHERE expires_at <= ?').run(new Date(now).toISOString())
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

  async deletePersonalJourney(id: string, capabilityHash: string) {
    return this.transaction(db => Number(db.prepare('DELETE FROM muse_personal_journeys WHERE id=? AND capability_hash=?').run(id, capabilityHash).changes) > 0)
  }

  async rotate(id: string, playHash: string) {
    this.transaction(db => { db.prepare('UPDATE shared_stories SET play_hash = ? WHERE id = ?').run(playHash, id) })
  }

  async mediaBegin(record: SharedMediaRecord, maxAttempts: number) {
    return this.transaction((db, now) => {
      const story = db.prepare('SELECT media_attempts FROM shared_stories WHERE id = ? AND expires_at > ?').get(record.story_id, new Date(now).toISOString())
      if (!story) throw new SharedStoryError('This story link is invalid, expired, or has been deleted.', 404)
      if (Number(story.media_attempts) >= maxAttempts) return false
      db.prepare('UPDATE shared_stories SET media_attempts = media_attempts + 1 WHERE id = ?').run(record.story_id)
      // At most one in-flight upload per story; a newer attempt supersedes it.
      db.prepare("DELETE FROM shared_story_media WHERE story_id = ? AND status = 'pending'").run(record.story_id)
      db.prepare("INSERT INTO shared_story_media(id, story_id, object_key, kind, mime, size, status, upload_hash, upload_expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)")
        .run(record.id, record.story_id, record.object_key, record.kind, record.mime, record.size, record.upload_hash, record.upload_expires_at, record.created_at)
      return true
    })
  }

  async mediaGet(id: string) {
    return this.transaction(db => {
      const row = db.prepare('SELECT * FROM shared_story_media WHERE id = ?').get(id)
      return row ? { ...row, size: Number(row.size) } as SharedMediaRecord : null
    })
  }

  async mediaReady(storyId: string) {
    return this.transaction(db => {
      const row = db.prepare("SELECT * FROM shared_story_media WHERE story_id = ? AND status = 'ready'").get(storyId)
      return row ? { ...row, size: Number(row.size) } as SharedMediaRecord : null
    })
  }

  async mediaActivate(storyId: string, id: string) {
    this.transaction(db => {
      if (!db.prepare("SELECT 1 FROM shared_story_media WHERE id = ? AND story_id = ? AND status = 'pending'").get(id, storyId)) {
        throw new SharedStoryError('This upload is no longer available. Choose the file again.', 409)
      }
      db.prepare("DELETE FROM shared_story_media WHERE story_id = ? AND status = 'ready'").run(storyId)
      db.prepare("UPDATE shared_story_media SET status = 'ready' WHERE id = ?").run(id)
    })
  }

  async mediaDiscard(storyId: string, id?: string) {
    this.transaction(db => {
      if (id) db.prepare('DELETE FROM shared_story_media WHERE story_id = ? AND id = ?').run(storyId, id)
      else db.prepare("DELETE FROM shared_story_media WHERE story_id = ? AND status = 'ready'").run(storyId)
    })
  }

  async mediaPurgeQueue(limit: number) {
    return this.transaction((db, now) => {
      db.prepare("DELETE FROM shared_story_media WHERE status = 'pending' AND upload_expires_at < ?").run(new Date(now - MEDIA_PENDING_GRACE_MS).toISOString())
      return db.prepare('SELECT object_key FROM shared_story_media_purge ORDER BY queued_at LIMIT ?').all(limit).map(row => String(row.object_key))
    })
  }

  async mediaPurged(keys: string[]) {
    this.transaction(db => {
      for (const key of keys) db.prepare('DELETE FROM shared_story_media_purge WHERE object_key = ?').run(key)
    })
  }

  async personalJourney(input: JourneyOperation): Promise<JourneyResult> {
    const outcome = this.transaction<JourneyResult | null>((db, now) => {
      if (!Number.isInteger(input.cap) || input.cap < 1 || input.cap > 10000) throw new SharedStoryError('Journey: invalid daily cap', 503)
      let row = db.prepare('SELECT * FROM muse_personal_journeys WHERE id = ?').get(input.id)
      if (input.operation === 'create' && !row) {
        if (!input.input || !(input.input.duration in JOURNEY_TURNS) || input.requestId !== input.id || !input.fingerprint) throw new SharedStoryError('Journey: invalid creation')
        const createdAt = new Date(now).toISOString()
        const record: JourneyRecord = {
          id: input.id, capabilityHash: input.capabilityHash, input: input.input, createdAt,
          expiresAt: new Date(now + 30 * 86400000).toISOString(), opening: null, used: 0, turn: null,
          lastAction: '', scenes: [], responses: [], creationStatus: 'pending'
        }
        db.prepare('INSERT INTO muse_personal_journeys VALUES (?, ?, ?, ?)').run(input.id, input.capabilityHash, JSON.stringify(record), record.expiresAt)
        db.prepare("INSERT INTO muse_personal_journey_requests VALUES (?, ?, ?, 'create', 'pending', ?, 0)")
          .run(input.id, input.requestId, input.fingerprint, now)
        return { record, snapshot: journeySnapshot(record, true), status: 'reserved' }
      }
      if (!row || row.capability_hash !== input.capabilityHash) return null
      const record = JSON.parse(String(row.record)) as JourneyRecord
      const stale = db.prepare("SELECT kind FROM muse_personal_journey_requests WHERE journey_id = ? AND status = 'pending' AND reserved_at <= ?").all(input.id, now - 90000)
      db.prepare("UPDATE muse_personal_journey_requests SET status = 'failed' WHERE journey_id = ? AND status = 'pending' AND reserved_at <= ?").run(input.id, now - 90000)
      if (stale.some(attempt => attempt.kind === 'create')) record.creationStatus = 'failed'
      const save = () => db.prepare('UPDATE muse_personal_journeys SET record = ? WHERE id = ?').run(JSON.stringify(record), input.id)
      const pending = () => Boolean(db.prepare("SELECT 1 FROM muse_personal_journey_requests WHERE journey_id = ? AND status = 'pending'").get(input.id))
      const result = (status?: JourneyResult['status']): JourneyResult => ({ record, snapshot: journeySnapshot(record, pending()), ...(status ? { status } : {}) })
      save()
      if (input.operation === 'view') return result()
      const previous = db.prepare('SELECT * FROM muse_personal_journey_requests WHERE journey_id = ? AND request_id = ?').get(input.id, input.requestId!)
      if (input.operation === 'finish') {
        if (!previous || previous.fingerprint !== input.fingerprint || previous.status !== 'pending' || previous.revision !== record.used) throw new SharedStoryError('Journey: attempt expired or already completed', 409)
        if (previous.kind === 'create') {
          if (!input.failed && !input.opening) throw new SharedStoryError('Journey: missing opening')
          record.creationStatus = input.failed ? 'failed' : 'done'
          if (!input.failed) {
            record.opening = input.opening!
            record.turn = input.opening!.turn
            record.scenes = [{ title: record.opening.title, body: record.turn.narration, question: '', choices: [] }]
          }
        } else {
          if (!input.failed && !input.turn) throw new SharedStoryError('Journey: missing narration')
          if (!input.failed) {
            record.turn = input.turn!
            record.scenes.push({ title: input.turn!.concluded ? 'The conclusion' : `Chapter ${record.scenes.length + 1}`, body: input.turn!.narration, question: '', choices: [] })
            record.responses.push(record.lastAction)
          }
        }
        save()
        db.prepare('UPDATE muse_personal_journey_requests SET status = ? WHERE journey_id = ? AND request_id = ?').run(input.failed ? 'failed' : 'done', input.id, input.requestId!)
        return result(input.failed ? 'failed' : 'done')
      }
      if (previous) {
        if (previous.fingerprint !== input.fingerprint || previous.kind !== (input.operation === 'create' ? 'create' : 'turn')) throw new SharedStoryError('Journey: request ID reused with different content', 409)
        return result(previous.status as 'pending' | 'done' | 'failed')
      }
      if (input.operation !== 'reserve') throw new SharedStoryError('Journey: invalid operation')
      if (record.creationStatus !== 'done') throw new SharedStoryError('Journey: preparation incomplete or failed', 409)
      if (pending()) throw new SharedStoryError('Journey: response in progress; reconcile before continuing', 409)
      if (input.revision !== record.used) throw new SharedStoryError('Journey: stale state; reconcile before continuing', 409)
      if (record.used >= JOURNEY_TURNS[record.input.duration] || record.turn?.concluded) throw new SharedStoryError('Journey: response allowance exhausted', 409)
      const bucket = `day:${new Date(now).toISOString().slice(0, 10)}`
      db.prepare('INSERT INTO muse_adventure_budgets(bucket) VALUES (?) ON CONFLICT DO NOTHING').run(bucket)
      const daily = Number(db.prepare('SELECT used FROM muse_adventure_budgets WHERE bucket = ?').get(bucket)!.used)
      if (daily >= input.cap) throw new SharedStoryError('Journey: daily cap reached', 429)
      db.prepare('UPDATE muse_adventure_budgets SET used = used + 1 WHERE bucket = ?').run(bucket)
      record.used += 1
      record.lastAction = input.text!
      save()
      db.prepare("INSERT INTO muse_personal_journey_requests VALUES (?, ?, ?, 'turn', 'pending', ?, ?)").run(input.id, input.requestId!, input.fingerprint!, now, record.used)
      return result('reserved')
    })
    if (!outcome) throw new SharedStoryError('Journey: session unavailable', 404)
    return outcome
  }

  async adventure(input: AdventureRequest): Promise<AdventureResult> {
    return this.transaction((db, now) => {
      const empty = { revision: 0, actionsUsed: 0, actionsRemaining: 12, budget: 0, budgetRemaining: 0, pending: false, turn: null }
      if (input.operation === 'ready') return { view: empty }
      const story = db.prepare('SELECT * FROM shared_stories WHERE id = ?').get(input.storyId)
      const player = db.prepare('SELECT * FROM shared_story_sessions WHERE story_id = ? AND player_hash = ?').get(input.storyId, input.sessionHash)
      if (!story || story.play_hash !== input.playHash || !player) throw new SharedStoryError('Adventure: story or session unavailable', 404)
      const budget = JSON.parse(String(story.brief)).adventure?.actionBudget
      if (!Number.isInteger(budget) || budget < 1) throw new SharedStoryError('Adventure: not enabled')
      db.prepare('INSERT INTO muse_adventure_sessions(story_id, player_hash) VALUES (?, ?) ON CONFLICT DO NOTHING').run(input.storyId, input.sessionHash)
      db.prepare("UPDATE muse_adventure_requests SET status = 'failed' WHERE story_id = ? AND player_hash = ? AND status = 'pending' AND reserved_at <= ?").run(input.storyId, input.sessionHash, now - 90000)
      const storyBucket = `story:${input.storyId}`
      const dayBucket = `day:${new Date(now).toISOString().slice(0, 10)}`
      for (const bucket of [storyBucket, dayBucket]) db.prepare('INSERT INTO muse_adventure_budgets(bucket) VALUES (?) ON CONFLICT DO NOTHING').run(bucket)
      const used = () => Number(db.prepare('SELECT used FROM muse_adventure_budgets WHERE bucket = ?').get(storyBucket)!.used)
      const view = () => {
        const state = db.prepare('SELECT * FROM muse_adventure_sessions WHERE story_id = ? AND player_hash = ?').get(input.storyId, input.sessionHash)!
        const brief = JSON.parse(String(story.brief))
        const choiceMode = brief.adventure?.choiceMode ?? 'free'
        const turn = state.turn ? JSON.parse(String(state.turn)) as AdventureTurn : null
        const actionsRemaining = Math.max(0, 12 - Number(state.used))
        const pending = Boolean(db.prepare("SELECT 1 FROM muse_adventure_requests WHERE story_id = ? AND player_hash = ? AND status = 'pending'").get(input.storyId, input.sessionHash))
        const choices = choiceMode === 'suggested' && actionsRemaining > 0 && !pending ? (turn?.choices ?? JSON.parse(String(story.content)).scenes[0]?.choices) : undefined
        return {
          revision: Number(state.used), actionsUsed: Number(state.used), actionsRemaining,
          budget, budgetRemaining: Math.max(0, budget - used()),
          pending,
          turn,
          choiceMode,
          ...(choices ? { choices } : {})
        }
      }
      if (input.operation === 'view') return { view: view() }
      const previous = db.prepare('SELECT * FROM muse_adventure_requests WHERE story_id = ? AND player_hash = ? AND request_id = ?').get(input.storyId, input.sessionHash, input.requestId!)
      if (input.operation === 'finish') {
        if (!previous || previous.fingerprint !== input.fingerprint || previous.status !== 'pending') throw new SharedStoryError('Adventure: attempt expired or already completed', 409)
        const current = view()
        if (player.solved || current.revision !== previous.revision) throw new SharedStoryError('Adventure: stale or solved state', 409)
        if (!input.failed && !input.turn) throw new SharedStoryError('Adventure: missing turn')
        if (!input.failed) db.prepare('UPDATE muse_adventure_sessions SET turn = ? WHERE story_id = ? AND player_hash = ?').run(JSON.stringify(input.turn), input.storyId, input.sessionHash)
        db.prepare('UPDATE muse_adventure_requests SET status = ? WHERE story_id = ? AND player_hash = ? AND request_id = ?').run(input.failed ? 'failed' : 'done', input.storyId, input.sessionHash, input.requestId!)
        const result = { view: view(), status: input.failed ? 'failed' as const : 'done' as const }
        db.prepare('UPDATE muse_adventure_requests SET result = ? WHERE story_id = ? AND player_hash = ? AND request_id = ?').run(JSON.stringify(result), input.storyId, input.sessionHash, input.requestId!)
        return result
      }
      if (previous) {
        if (previous.fingerprint !== input.fingerprint) throw new SharedStoryError('Adventure: request ID reused with different action', 409)
        return previous.result ? JSON.parse(String(previous.result)) : { view: view(), status: previous.status as 'pending' | 'failed' }
      }
      const current = view()
      if (player.solved) throw new SharedStoryError('Adventure: already solved', 409)
      if (current.pending) throw new SharedStoryError('Adventure: action in progress; reopen to refresh', 409)
      if (input.revision !== current.revision) throw new SharedStoryError('Adventure: stale state; reopen to refresh', 409)
      if (current.actionsRemaining === 0) throw new SharedStoryError('Adventure: 12-action cap reached. Final guesses, hints and audio remain available.', 409)
      if (current.budgetRemaining === 0 || Number(db.prepare('SELECT used FROM muse_adventure_budgets WHERE bucket = ?').get(dayBucket)!.used) >= input.cap) throw new SharedStoryError('Adventure: AI budget reached. Final guesses, hints and audio remain available.', 429)
      db.prepare('UPDATE muse_adventure_budgets SET used = used + 1 WHERE bucket IN (?, ?)').run(storyBucket, dayBucket)
      db.prepare('UPDATE muse_adventure_sessions SET used = used + 1 WHERE story_id = ? AND player_hash = ?').run(input.storyId, input.sessionHash)
      db.prepare("INSERT INTO muse_adventure_requests(story_id, player_hash, request_id, fingerprint, status, reserved_at, revision) VALUES (?, ?, ?, ?, 'pending', ?, ?)").run(input.storyId, input.sessionHash, input.requestId!, input.fingerprint!, now, current.revision + 1)
      return { view: view(), status: 'reserved' }
    })
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
        if (JSON.parse(String(story.brief)).adventure) throw new SharedStoryError('Use a freeform adventure action instead of Next.')
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
      if (kind !== 'generate' && kind !== 'guess' && kind !== 'upload') throw new SharedStoryError('Invalid request kind.')
      const date = new Date(now).toISOString()
      const day = `day:${date.slice(0, 10)}:${kind}`
      const hour = `hour:${date.slice(0, 13).replace('T', '-')}:${kind}:${clientHash}`
      const older = new Date(now - 2 * 86400000).toISOString()
      db.prepare("DELETE FROM shared_story_generation_limits WHERE (bucket LIKE 'day:%' AND bucket < ?) OR (bucket LIKE 'hour:%' AND bucket < ?)")
        .run(`day:${older.slice(0, 10)}`, `hour:${older.slice(0, 13).replace('T', '-')}`)
      const buckets: [string, number][] = [[day, kind === 'generate' ? 100 : kind === 'upload' ? 200 : 5000], [hour, kind === 'generate' ? 5 : kind === 'upload' ? 10 : 60]]
      for (const [bucket, cap] of buckets) {
        db.prepare('INSERT INTO shared_story_generation_limits(bucket, count) VALUES (?, 0) ON CONFLICT DO NOTHING').run(bucket)
        if (Number(db.prepare('SELECT count FROM shared_story_generation_limits WHERE bucket = ?').get(bucket)!.count) >= cap) return false
      }
      db.prepare('UPDATE shared_story_generation_limits SET count = count + 1 WHERE bucket IN (?, ?)').run(day, hour)
      return true
    })
  }
}

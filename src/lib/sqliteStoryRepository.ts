import { mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import type { DatabaseSync as SqliteDatabase } from 'node:sqlite'
import { normalizeSharedAnswer, SharedStoryError } from './sharedStory'
import type { StoryRepository, StoredStory, PlayerState, RequestKind, CooperativeOperation, CooperativeView } from './storyRepository'
import type { StudioRecord, StudioRequest, StudioResult } from './studioNarration'
import type { SharedStoryProgress } from './sharedStoryProgress'
import { storyStorageError } from './storyStorageErrors'
import type { AdventureRequest, AdventureResult, AdventureTurn } from './sharedAdventure'
import { PERMANENT_STORY_EXPIRY } from './storyRetention'
import { JOURNEY_TURNS, journeySnapshot, type JourneyOperation, type JourneyRecord, type JourneyResult } from './personalJourney'
import {
  SHARED_MEDIA_PENDING_GRACE_MS as MEDIA_PENDING_GRACE_MS, type SharedGiftReply, type SharedMediaRecord,
  type SharedVoiceRecord
} from './sharedStoryMedia'

const schema = `
CREATE TABLE IF NOT EXISTS muse_retention_migrations (
  name TEXT PRIMARY KEY, applied_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS muse_studio_audio (
  story_id TEXT NOT NULL REFERENCES shared_stories(id) ON DELETE CASCADE,
  scene_index INTEGER NOT NULL CHECK (scene_index BETWEEN 0 AND 11),
  fingerprint TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'ready', 'failed')),
  characters INTEGER NOT NULL CHECK (characters BETWEEN 1 AND 5000),
  size INTEGER NOT NULL DEFAULT 0 CHECK (size BETWEEN 0 AND 5242880),
  created_at TEXT NOT NULL, PRIMARY KEY(story_id, scene_index)
);
CREATE TABLE IF NOT EXISTS muse_studio_budget (id INTEGER PRIMARY KEY CHECK (id = 1), used INTEGER NOT NULL);
INSERT OR IGNORE INTO muse_studio_budget VALUES (1, 0);
CREATE TABLE IF NOT EXISTS muse_studio_purge (object_key TEXT PRIMARY KEY, retain_until TEXT NOT NULL);
CREATE TRIGGER IF NOT EXISTS muse_studio_queue_purge AFTER DELETE ON muse_studio_audio
BEGIN
  INSERT OR IGNORE INTO muse_studio_purge VALUES (old.object_key,
    max(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', julianday(old.created_at) + 5.0 / 1440.0)));
END;
CREATE TABLE IF NOT EXISTS shared_stories (
  id TEXT PRIMARY KEY, owner_id TEXT, owner_hash TEXT NOT NULL, play_hash TEXT NOT NULL,
  brief TEXT NOT NULL, content TEXT NOT NULL, answer_normalized TEXT NOT NULL,
  alternative_answers_normalized TEXT NOT NULL DEFAULT '[]',
  expires_at TEXT NOT NULL DEFAULT '${PERMANENT_STORY_EXPIRY}', media_attempts INTEGER NOT NULL DEFAULT 0, voice_attempts INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS story_expiry ON shared_stories(expires_at);
CREATE TABLE IF NOT EXISTS shared_story_sessions (
  story_id TEXT NOT NULL REFERENCES shared_stories(id) ON DELETE CASCADE,
  player_hash TEXT NOT NULL, current_scene INTEGER NOT NULL DEFAULT 0,
  solved INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0,
  revealed_hints INTEGER NOT NULL DEFAULT 0, skipped INTEGER NOT NULL DEFAULT 0 CHECK (skipped IN (0, 1)),
  last_attempt_at INTEGER, PRIMARY KEY (story_id, player_hash)
);
CREATE TABLE IF NOT EXISTS muse_cooperative_players (
  story_id TEXT NOT NULL REFERENCES shared_stories(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, display_name TEXT NOT NULL,
  position INTEGER NOT NULL, joined_at TEXT NOT NULL,
  PRIMARY KEY(story_id, user_id), UNIQUE(story_id, position)
);
CREATE TABLE IF NOT EXISTS muse_cooperative_turns (
  story_id TEXT PRIMARY KEY REFERENCES shared_stories(id) ON DELETE CASCADE,
  current_user_id TEXT NOT NULL, turn_number INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS shared_story_replies (
  story_id TEXT NOT NULL, session_hash TEXT NOT NULL, message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 1000),
  created_at TEXT NOT NULL, PRIMARY KEY (story_id, session_hash),
  FOREIGN KEY (story_id, session_hash) REFERENCES shared_story_sessions(story_id, player_hash) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS shared_story_replies_story ON shared_story_replies(story_id, created_at);
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
  revision INTEGER NOT NULL, result TEXT, cooperative_user_id TEXT,
  PRIMARY KEY(story_id, player_hash, request_id),
  FOREIGN KEY(story_id, player_hash) REFERENCES muse_adventure_sessions(story_id, player_hash) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS muse_adventure_budgets (
  bucket TEXT PRIMARY KEY, used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS muse_personal_journeys (
  id TEXT PRIMARY KEY, owner_id TEXT, capability_hash TEXT NOT NULL, record TEXT NOT NULL,
  expires_at TEXT NOT NULL DEFAULT '${PERMANENT_STORY_EXPIRY}'
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
END;
CREATE TABLE IF NOT EXISTS shared_story_voice (
  id TEXT PRIMARY KEY, story_id TEXT NOT NULL REFERENCES shared_stories(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE, kind TEXT NOT NULL CHECK (kind = 'voice'),
  mime TEXT NOT NULL CHECK (mime = 'audio/wav'), size INTEGER NOT NULL CHECK (size > 0 AND size <= 5242880),
  status TEXT NOT NULL CHECK (status IN ('pending', 'ready')), upload_hash TEXT NOT NULL,
  upload_expires_at TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS shared_story_voice_one_ready ON shared_story_voice(story_id) WHERE status = 'ready';
CREATE TABLE IF NOT EXISTS shared_story_voice_purge (
  object_key TEXT PRIMARY KEY, queued_at TEXT NOT NULL, retain_until TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS shared_story_voice_queue_purge AFTER DELETE ON shared_story_voice
BEGIN
  INSERT INTO shared_story_voice_purge(object_key, queued_at, retain_until)
    VALUES (old.object_key, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
      CASE WHEN old.status = 'pending' THEN strftime('%Y-%m-%dT%H:%M:%fZ', julianday(old.created_at) + 125.0 / 1440.0) ELSE strftime('%Y-%m-%dT%H:%M:%fZ', 'now') END)
    ON CONFLICT(object_key) DO UPDATE SET retain_until = max(retain_until, excluded.retain_until);
END;`

export class SqliteStoryRepository implements StoryRepository {
  private readonly filename: string
  async progress(storyId: string, adventure = false): Promise<SharedStoryProgress> {
    return this.transaction(db => {
      const row = db.prepare(`SELECT count(*) AS opened,
        coalesce(sum(CASE WHEN solved = 0 AND skipped = 0 THEN 1 ELSE 0 END), 0) AS in_progress,
        coalesce(sum(CASE WHEN solved = 1 THEN 1 ELSE 0 END), 0) AS solved,
        coalesce(sum(CASE WHEN solved = 0 AND skipped = 1 THEN 1 ELSE 0 END), 0) AS skipped,
        max(current_scene) AS furthest_scene FROM shared_story_sessions WHERE story_id = ?`).get(storyId)!
      const turns = adventure ? db.prepare(`SELECT max(completed) AS furthest FROM
        (SELECT count(*) AS completed FROM muse_adventure_requests WHERE story_id = ? AND status = 'done' GROUP BY player_hash)`).get(storyId)! : null
      return { opened: Number(row.opened), inProgress: Number(row.in_progress), solved: Number(row.solved),
        skipped: Number(row.skipped), furthestScene: adventure
          ? row.opened ? Number(turns?.furthest || 0) : null
          : row.furthest_scene === null ? null : Number(row.furthest_scene) }
    })
  }
  async studio(request: StudioRequest): Promise<StudioResult> {
    return this.transaction((db, now) => {
      const result: StudioResult = { records: [], reserved: false, keys: [] }
      const cutoff = new Date(now - 120000).toISOString()
      const queue = (key: string, created: string) => db.prepare('INSERT OR IGNORE INTO muse_studio_purge VALUES (?, ?)')
        .run(key, new Date(Math.max(now, Date.parse(created) + 300000)).toISOString())
      const stale = db.prepare("SELECT * FROM muse_studio_audio WHERE status = 'pending' AND created_at <= ?").all(cutoff)
      for (const row of stale) queue(String(row.object_key), String(row.created_at))
      db.prepare("UPDATE muse_studio_audio SET status = 'failed' WHERE status = 'pending' AND created_at <= ?").run(cutoff)
      if (request.operation === 'purge') {
        result.keys = db.prepare("SELECT object_key FROM muse_studio_purge WHERE retain_until <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now') ORDER BY retain_until LIMIT 20")
          .all().map(row => String(row.object_key))
      } else if (request.operation === 'purged') {
        for (const key of request.keys) db.prepare('DELETE FROM muse_studio_purge WHERE object_key = ?').run(key)
      } else if (request.operation === 'status') {
        result.records = db.prepare('SELECT a.* FROM muse_studio_audio a JOIN shared_stories s ON s.id = a.story_id WHERE a.story_id = ? AND (s.expires_at IS NULL OR s.expires_at > ?) ORDER BY a.scene_index')
          .all(request.storyId, new Date(now).toISOString()) as StudioRecord[]
      } else if (request.operation === 'audio') {
        const args = [request.storyId, request.sceneIndex, new Date(now).toISOString()]
        let access = ''
        if (request.sessionHash !== undefined) {
          access = ' AND s.play_hash = ? AND EXISTS (SELECT 1 FROM shared_story_sessions p WHERE p.story_id = s.id AND p.player_hash = ? AND p.current_scene >= a.scene_index)'
          args.push(request.playHash ?? '', request.sessionHash)
        }
        result.records = db.prepare(`SELECT a.* FROM muse_studio_audio a JOIN shared_stories s ON s.id = a.story_id
          WHERE a.story_id = ? AND a.scene_index = ? AND a.status = 'ready' AND (s.expires_at IS NULL OR s.expires_at > ?)${access}`).all(...args) as StudioRecord[]
      } else if (request.operation === 'reserve') {
        const row = request.record
        if (!db.prepare('SELECT 1 FROM shared_stories WHERE id = ? AND (expires_at IS NULL OR expires_at > ?)').get(row.story_id, new Date(now).toISOString())) {
          throw new SharedStoryError('Story unavailable.', 404)
        }
        if (db.prepare('SELECT 1 FROM muse_studio_audio WHERE story_id = ? AND scene_index = ?').get(row.story_id, row.scene_index)) return result
        const charged = db.prepare('UPDATE muse_studio_budget SET used = used + ? WHERE id = 1 AND used + ? <= ?')
          .run(row.characters, row.characters, request.budget)
        if (!charged.changes) throw new SharedStoryError('Studio lifetime character budget exhausted.', 429)
        db.prepare("INSERT INTO muse_studio_audio VALUES (?, ?, ?, ?, 'pending', ?, 0, ?)")
          .run(row.story_id, row.scene_index, row.fingerprint, row.object_key, row.characters, new Date(now).toISOString())
        result.reserved = true
      } else if (request.operation === 'finish') {
        const row = request.record
        const updated = db.prepare("UPDATE muse_studio_audio SET status = ?, size = ? WHERE story_id = ? AND scene_index = ? AND object_key = ? AND fingerprint = ? AND status = 'pending'")
          .run(request.failed ? 'failed' : 'ready', request.failed ? 0 : row.size, row.story_id, row.scene_index, row.object_key, row.fingerprint)
        if (request.failed) queue(row.object_key, row.created_at)
        else if (!updated.changes) throw new SharedStoryError('Studio reservation expired or story was deleted.', 409)
      }
      return result
    })
  }
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
      const tableInfo = (table: string) => db!.prepare(`PRAGMA table_info(${table})`).all()
      const columns = (table: string) => tableInfo(table).map(column => column.name)
      if (!columns('muse_adventure_requests').includes('cooperative_user_id')) {
        db.exec('ALTER TABLE muse_adventure_requests ADD COLUMN cooperative_user_id TEXT')
      }
      if (!columns('shared_stories').includes('alternative_answers_normalized')) {
        db.exec("ALTER TABLE shared_stories ADD COLUMN alternative_answers_normalized TEXT NOT NULL DEFAULT '[]'")
      }
      if (!columns('shared_stories').includes('media_attempts')) {
        db.exec('ALTER TABLE shared_stories ADD COLUMN media_attempts INTEGER NOT NULL DEFAULT 0')
      }
      if (!columns('shared_stories').includes('voice_attempts')) {
        db.exec('ALTER TABLE shared_stories ADD COLUMN voice_attempts INTEGER NOT NULL DEFAULT 0')
      }
      if (!columns('shared_stories').includes('owner_id')) db.exec('ALTER TABLE shared_stories ADD COLUMN owner_id TEXT')
      if (!columns('muse_personal_journeys').includes('owner_id')) db.exec('ALTER TABLE muse_personal_journeys ADD COLUMN owner_id TEXT')
      if (!columns('shared_story_sessions').includes('revealed_hints')) {
        db.exec('ALTER TABLE shared_story_sessions ADD COLUMN revealed_hints INTEGER NOT NULL DEFAULT 0')
      }
      if (!columns('shared_story_sessions').includes('skipped')) {
        db.exec('ALTER TABLE shared_story_sessions ADD COLUMN skipped INTEGER NOT NULL DEFAULT 0 CHECK (skipped IN (0, 1))')
      }
      if (!db.prepare("SELECT 1 FROM muse_retention_migrations WHERE name = 'indefinite-story-retention'").get()) {
        db.prepare('UPDATE shared_stories SET expires_at = ?').run(PERMANENT_STORY_EXPIRY)
        const journeyRows = db.prepare('SELECT id, record FROM muse_personal_journeys').all()
        const updateJourney = db.prepare('UPDATE muse_personal_journeys SET record = ?, expires_at = ? WHERE id = ?')
        for (const row of journeyRows) {
          const record = JSON.parse(String(row.record)) as JourneyRecord
          record.expiresAt = null
          updateJourney.run(JSON.stringify(record), PERMANENT_STORY_EXPIRY, row.id)
        }
        db.prepare("INSERT INTO muse_retention_migrations(name, applied_at) VALUES ('indefinite-story-retention', ?)").run(new Date(Date.now()).toISOString())
      }
      if (db.prepare('PRAGMA foreign_key_check').all().length) {
        throw new Error('SQLite story storage migration produced invalid foreign-key references.')
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
      db.prepare('INSERT INTO shared_stories (id, owner_id, owner_hash, play_hash, brief, content, answer_normalized, alternative_answers_normalized, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(story.id, story.owner_id ?? null, story.owner_hash, story.play_hash, JSON.stringify(story.brief), JSON.stringify(story.content), story.answer_normalized, JSON.stringify((story.brief.alternativeAnswers ?? []).map(normalizeSharedAnswer)), story.expires_at)
    })
  }

  async findUnexpired(id: string) {
    return this.transaction(db => {
      const row = db.prepare('SELECT * FROM shared_stories WHERE id = ?').get(id)
      return row ? { ...row, brief: JSON.parse(String(row.brief)), content: JSON.parse(String(row.content)), alternative_answers_normalized: JSON.parse(String(row.alternative_answers_normalized)) } as StoredStory : null
    })
  }

  async updateContent(id: string, content: StoredStory['content']) {
    this.transaction(db => {
      const result = db.prepare('UPDATE shared_stories SET content = ? WHERE id = ?').run(JSON.stringify(content), id)
      if (!Number(result.changes)) throw new SharedStoryError('This story link is invalid, expired, or has been deleted.', 404)
    })
  }

  async listRetained(ownerId: string, after: string | null, limit: number) {
    return this.transaction(db => {
      const rows = db.prepare('SELECT * FROM shared_stories WHERE owner_id = ? AND (? IS NULL OR id > ?) ORDER BY id LIMIT ?').all(ownerId, after, after, limit)
      return rows.map(row => ({
        ...row, brief: JSON.parse(String(row.brief)), content: JSON.parse(String(row.content)),
        alternative_answers_normalized: JSON.parse(String(row.alternative_answers_normalized))
      })) as StoredStory[]
    })
  }

  async claimStoryOwner(id: string, ownerId: string) {
    return this.transaction(db => {
      db.prepare('UPDATE shared_stories SET owner_id = ? WHERE id = ? AND owner_id IS NULL').run(ownerId, id)
      const row = db.prepare('SELECT owner_id FROM shared_stories WHERE id = ?').get(id)
      return row?.owner_id === ownerId
    })
  }

  async delete(id: string) {
    this.transaction(db => { db.prepare('DELETE FROM shared_stories WHERE id = ?').run(id) })
  }

  async deletePersonalJourney(id: string, _capabilityHash: string, ownerId: string) {
    return this.transaction(db => Number(db.prepare('DELETE FROM muse_personal_journeys WHERE id=? AND owner_id=?').run(id, ownerId).changes) > 0)
  }

  async listPersonalJourneys(ownerId: string) {
    return this.transaction(db => db.prepare('SELECT record FROM muse_personal_journeys WHERE owner_id = ? ORDER BY id')
      .all(ownerId).map(row => JSON.parse(String(row.record)) as JourneyRecord))
  }

  async rotate(id: string, playHash: string) {
    this.transaction(db => { db.prepare('UPDATE shared_stories SET play_hash = ? WHERE id = ?').run(playHash, id) })
  }

  async mediaBegin(record: SharedMediaRecord, maxAttempts: number) {
    return this.transaction((db, now) => {
      const story = db.prepare('SELECT media_attempts FROM shared_stories WHERE id = ? AND (expires_at IS NULL OR expires_at > ?)').get(record.story_id, new Date(now).toISOString())
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

  async giftReady() {
    this.transaction(db => {
      db.prepare('SELECT voice_attempts FROM shared_stories LIMIT 0').all()
      db.prepare('SELECT story_id FROM shared_story_replies LIMIT 0').all()
      db.prepare('SELECT id FROM shared_story_voice LIMIT 0').all()
    })
  }

  async giftReplies(storyId: string): Promise<SharedGiftReply[]> {
    return this.transaction(db => db.prepare('SELECT message, created_at FROM shared_story_replies WHERE story_id = ? ORDER BY created_at')
      .all(storyId).map(row => ({ message: String(row.message), createdAt: String(row.created_at) })))
  }

  async giftReply(storyId: string, sessionHash: string, message: string): Promise<SharedGiftReply> {
    return this.transaction((db, now) => {
      const story = db.prepare('SELECT brief FROM shared_stories WHERE id = ? AND (expires_at IS NULL OR expires_at > ?)').get(storyId, new Date(now).toISOString())
      const state = db.prepare('SELECT solved, skipped FROM shared_story_sessions WHERE story_id = ? AND player_hash = ?').get(storyId, sessionHash)
      if (!story || !state) throw new SharedStoryError('Replies are unavailable for this story or player session.', 403)
      const gift = JSON.parse(String(story.brief)).gift
      if (gift?.allowReply !== true || (!Boolean(state.solved) && !Boolean(state.skipped))) {
        throw new SharedStoryError('Replies are available only after the creator has opted in and the story is revealed.', 403)
      }
      const existing = db.prepare('SELECT message, created_at FROM shared_story_replies WHERE story_id = ? AND session_hash = ?').get(storyId, sessionHash)
      if (!existing) {
        const countRow = db.prepare('SELECT count(*) AS count FROM shared_story_replies WHERE story_id = ?').get(storyId)
        if (!countRow) throw new SharedStoryError('Could not verify the reply limit for this story.', 503)
        const count = Number(countRow.count)
        if (count >= 100) throw new SharedStoryError('This story has reached its limit of 100 replies.', 429)
      }
      const createdAt = new Date(now).toISOString()
      db.prepare(`INSERT INTO shared_story_replies(story_id, session_hash, message, created_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(story_id, session_hash) DO UPDATE SET
          message = excluded.message,
          created_at = CASE WHEN shared_story_replies.message = excluded.message THEN shared_story_replies.created_at ELSE excluded.created_at END`)
        .run(storyId, sessionHash, message, createdAt)
      const row = db.prepare('SELECT message, created_at FROM shared_story_replies WHERE story_id = ? AND session_hash = ?').get(storyId, sessionHash)
      if (!row) throw new SharedStoryError('Your reply could not be saved. Please try again.', 503)
      return { message: String(row.message), createdAt: String(row.created_at) }
    })
  }

  async voiceBegin(record: SharedVoiceRecord, maxAttempts: number) {
    return this.transaction((db, now) => {
      const story = db.prepare('SELECT voice_attempts FROM shared_stories WHERE id = ? AND (expires_at IS NULL OR expires_at > ?)').get(record.story_id, new Date(now).toISOString())
      if (!story) throw new SharedStoryError('This story link is invalid, expired, or has been deleted.', 404)
      if (Number(story.voice_attempts) >= maxAttempts) return false
      db.prepare('UPDATE shared_stories SET voice_attempts = voice_attempts + 1 WHERE id = ?').run(record.story_id)
      db.prepare("DELETE FROM shared_story_voice WHERE story_id = ? AND status = 'pending'").run(record.story_id)
      db.prepare(`INSERT INTO shared_story_voice(id, story_id, object_key, kind, mime, size, status, upload_hash, upload_expires_at, created_at)
        VALUES (?, ?, ?, 'voice', ?, ?, 'pending', ?, ?, ?)`)
        .run(record.id, record.story_id, record.object_key, record.mime, record.size, record.upload_hash, record.upload_expires_at, record.created_at)
      return true
    })
  }

  async voiceGet(id: string) {
    return this.transaction(db => {
      const row = db.prepare('SELECT * FROM shared_story_voice WHERE id = ?').get(id)
      return row ? { ...row, size: Number(row.size) } as SharedVoiceRecord : null
    })
  }

  async voiceReady(storyId: string) {
    return this.transaction(db => {
      const row = db.prepare("SELECT * FROM shared_story_voice WHERE story_id = ? AND status = 'ready'").get(storyId)
      return row ? { ...row, size: Number(row.size) } as SharedVoiceRecord : null
    })
  }

  async voiceActivate(storyId: string, id: string) {
    this.transaction((db, now) => {
      if (!db.prepare("SELECT 1 FROM shared_story_voice WHERE id = ? AND story_id = ? AND status = 'pending' AND upload_expires_at > ?")
        .get(id, storyId, new Date(now).toISOString())) {
        throw new SharedStoryError('This voice upload is no longer available. Choose the recording again.', 409)
      }
      db.prepare("DELETE FROM shared_story_voice WHERE story_id = ? AND status = 'ready'").run(storyId)
      db.prepare("UPDATE shared_story_voice SET status = 'ready' WHERE id = ?").run(id)
    })
  }

  async voiceDiscard(storyId: string, id?: string) {
    this.transaction(db => {
      if (id) db.prepare('DELETE FROM shared_story_voice WHERE story_id = ? AND id = ?').run(storyId, id)
      else db.prepare("DELETE FROM shared_story_voice WHERE story_id = ? AND status = 'ready'").run(storyId)
    })
  }

  async voicePurgeQueue(limit: number) {
    return this.transaction((db, now) => {
      db.prepare("DELETE FROM shared_story_voice WHERE status = 'pending' AND upload_expires_at < ?")
        .run(new Date(now - MEDIA_PENDING_GRACE_MS).toISOString())
      return db.prepare('SELECT object_key FROM shared_story_voice_purge WHERE retain_until <= ? ORDER BY queued_at LIMIT ?')
        .all(new Date(now).toISOString(), limit).map(row => String(row.object_key))
    })
  }

  async voicePurged(keys: string[]) {
    this.transaction(db => {
      for (const key of keys) db.prepare('DELETE FROM shared_story_voice_purge WHERE object_key = ?').run(key)
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
          expiresAt: null, opening: null, used: 0, turn: null,
          lastAction: '', scenes: [], responses: [], creationStatus: 'pending'
        }
        db.prepare('INSERT INTO muse_personal_journeys (id, owner_id, capability_hash, record, expires_at) VALUES (?, ?, ?, ?, ?)')
          .run(input.id, input.accountId, input.capabilityHash, JSON.stringify(record), PERMANENT_STORY_EXPIRY)
        db.prepare("INSERT INTO muse_personal_journey_requests VALUES (?, ?, ?, 'create', 'pending', ?, 0)")
          .run(input.id, input.requestId, input.fingerprint, now)
        return { record, snapshot: journeySnapshot(record, true), status: 'reserved' }
      }
      if (!row || row.owner_id !== input.accountId) return null
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
      const brief = JSON.parse(String(story.brief))
      const budget = brief.adventure?.actionBudget
      if (!Number.isInteger(budget) || budget < 1) throw new SharedStoryError('Adventure: not enabled')
      const cooperative = brief.adventure?.cooperative === true
      const currentCooperativeTurn = () => {
        if (!cooperative) return
        if (!input.cooperativeUserId) throw new SharedStoryError('Cooperative: sign in to take part.', 401)
        const member = db.prepare('SELECT 1 FROM muse_cooperative_players WHERE story_id = ? AND user_id = ?')
          .get(input.storyId, input.cooperativeUserId)
        const turn = db.prepare('SELECT current_user_id FROM muse_cooperative_turns WHERE story_id = ?').get(input.storyId)
        if (!member || !turn) throw new SharedStoryError('Cooperative: join this story before playing.', 403)
        if (turn.current_user_id !== input.cooperativeUserId) throw new SharedStoryError('Cooperative: it is another participant’s turn.', 409)
      }
      if (cooperative) {
        if (!input.cooperativeUserId) throw new SharedStoryError('Cooperative: sign in to take part.', 401)
        const member = db.prepare('SELECT 1 FROM muse_cooperative_players WHERE story_id = ? AND user_id = ?')
          .get(input.storyId, input.cooperativeUserId)
        if (!member) throw new SharedStoryError('Cooperative: join this story before playing.', 403)
      }
      const advanceCooperativeTurn = () => {
        if (!cooperative || !input.cooperativeUserId) return
        const next = db.prepare(`SELECT user_id FROM muse_cooperative_players
          WHERE story_id = ? AND position > (SELECT position FROM muse_cooperative_players WHERE story_id = ? AND user_id = ?)
          ORDER BY position LIMIT 1`).get(input.storyId, input.storyId, input.cooperativeUserId) as { user_id?: string } | undefined
        const nextUserId = next?.user_id ?? String(db.prepare('SELECT user_id FROM muse_cooperative_players WHERE story_id = ? ORDER BY position LIMIT 1').get(input.storyId)!.user_id)
        db.prepare('UPDATE muse_cooperative_turns SET current_user_id = ?, turn_number = turn_number + 1 WHERE story_id = ?')
          .run(nextUserId, input.storyId)
      }
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
        if (cooperative && previous.cooperative_user_id !== input.cooperativeUserId) throw new SharedStoryError('Adventure: cooperative turn owner changed', 409)
        currentCooperativeTurn()
        const current = view()
        if (player.solved || player.skipped || current.revision !== previous.revision) throw new SharedStoryError('Adventure: stale or revealed state', 409)
        if (!input.failed && !input.turn) throw new SharedStoryError('Adventure: missing turn')
        if (!input.failed) {
          db.prepare('UPDATE muse_adventure_sessions SET turn = ? WHERE story_id = ? AND player_hash = ?').run(JSON.stringify(input.turn), input.storyId, input.sessionHash)
          advanceCooperativeTurn()
        }
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
      currentCooperativeTurn()
      if (player.solved || player.skipped) throw new SharedStoryError('Adventure: already revealed', 409)
      if (current.pending) throw new SharedStoryError('Adventure: action in progress; reopen to refresh', 409)
      if (input.revision !== current.revision) throw new SharedStoryError('Adventure: stale state; reopen to refresh', 409)
      if (current.actionsRemaining === 0) throw new SharedStoryError('Adventure: 12-action cap reached. Final guesses, hints and audio remain available.', 409)
      if (current.budgetRemaining === 0 || Number(db.prepare('SELECT used FROM muse_adventure_budgets WHERE bucket = ?').get(dayBucket)!.used) >= input.cap) throw new SharedStoryError('Adventure: AI budget reached. Final guesses, hints and audio remain available.', 429)
      db.prepare('UPDATE muse_adventure_budgets SET used = used + 1 WHERE bucket IN (?, ?)').run(storyBucket, dayBucket)
      db.prepare('UPDATE muse_adventure_sessions SET used = used + 1 WHERE story_id = ? AND player_hash = ?').run(input.storyId, input.sessionHash)
      db.prepare("INSERT INTO muse_adventure_requests(story_id, player_hash, request_id, fingerprint, status, reserved_at, revision, cooperative_user_id) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)").run(input.storyId, input.sessionHash, input.requestId!, input.fingerprint!, now, current.revision + 1, input.cooperativeUserId ?? null)
      return { view: view(), status: 'reserved' }
    })
  }

  async cooperative(input: CooperativeOperation): Promise<CooperativeView> {
    return this.transaction(db => {
      const story = db.prepare('SELECT brief FROM shared_stories WHERE id = ?').get(input.storyId)
      if (!story) throw new SharedStoryError('Cooperative: story unavailable', 404)
      const brief = JSON.parse(String(story.brief))
      if (brief.adventure?.cooperative !== true) throw new SharedStoryError('Cooperative: this story is not enabled for group play.', 409)
      if (input.operation === 'join') {
        const name = input.displayName?.trim()
        const existing = db.prepare('SELECT 1 FROM muse_cooperative_players WHERE story_id = ? AND user_id = ?').get(input.storyId, input.userId)
        if (!existing) {
          if (!name) throw new SharedStoryError('Cooperative: enter a display name to join.', 400)
          if (name.length > 40 || /[\u0000-\u001f]/.test(name)) {
            throw new SharedStoryError('Choose a display name of 1 to 40 characters.')
          }
          const count = Number(db.prepare('SELECT COUNT(*) AS count FROM muse_cooperative_players WHERE story_id = ?').get(input.storyId)!.count)
          if (count >= 20) throw new SharedStoryError('Cooperative: this story is full (20 participants maximum).', 409)
          const position = count + 1
          const duplicateName = db.prepare('SELECT 1 FROM muse_cooperative_players WHERE story_id = ? AND display_name = ?')
            .get(input.storyId, name)
          const displayName = duplicateName ? `Participant ${position}` : name
          db.prepare('INSERT INTO muse_cooperative_players(story_id, user_id, display_name, position, joined_at) VALUES (?, ?, ?, ?, ?)')
            .run(input.storyId, input.userId, displayName, position, new Date().toISOString())
          db.prepare('INSERT INTO muse_cooperative_turns(story_id, current_user_id, turn_number) VALUES (?, ?, 1) ON CONFLICT DO NOTHING')
            .run(input.storyId, input.userId)
        }
      }
      const own = db.prepare('SELECT display_name FROM muse_cooperative_players WHERE story_id = ? AND user_id = ?').get(input.storyId, input.userId) as { display_name?: string } | undefined
      if (!own) throw new SharedStoryError('Cooperative: join this story before viewing progress.', 403)
      const current = db.prepare(`SELECT t.current_user_id, t.turn_number, p.display_name
        FROM muse_cooperative_turns t JOIN muse_cooperative_players p
          ON p.story_id = t.story_id AND p.user_id = t.current_user_id
        WHERE t.story_id = ?`).get(input.storyId) as { current_user_id: string; turn_number: number; display_name: string } | undefined
      if (!current) throw new SharedStoryError('Cooperative: turn state unavailable.', 503)
      if (input.operation === 'pass') {
        if (current.current_user_id !== input.userId) throw new SharedStoryError('Cooperative: it is another participant’s turn.', 409)
        if (db.prepare("SELECT 1 FROM muse_adventure_requests WHERE story_id = ? AND player_hash = ? AND status = 'pending'")
          .get(input.storyId, input.sessionHash ?? '')) {
          throw new SharedStoryError('Cooperative: wait for the current action to finish before passing', 409)
        }
        const next = db.prepare(`SELECT user_id FROM muse_cooperative_players
          WHERE story_id = ? AND position > (SELECT position FROM muse_cooperative_players WHERE story_id = ? AND user_id = ?)
          ORDER BY position LIMIT 1`).get(input.storyId, input.storyId, input.userId) as { user_id?: string } | undefined
        const nextUserId = next?.user_id ?? String(db.prepare('SELECT user_id FROM muse_cooperative_players WHERE story_id = ? ORDER BY position LIMIT 1').get(input.storyId)!.user_id)
        db.prepare('UPDATE muse_cooperative_turns SET current_user_id = ?, turn_number = turn_number + 1 WHERE story_id = ?')
          .run(nextUserId, input.storyId)
      }
      const currentTurn = db.prepare(`SELECT t.current_user_id, t.turn_number, p.display_name
        FROM muse_cooperative_turns t JOIN muse_cooperative_players p
          ON p.story_id = t.story_id AND p.user_id = t.current_user_id
        WHERE t.story_id = ?`).get(input.storyId) as typeof current | undefined
      if (!currentTurn) throw new SharedStoryError('Cooperative: turn state unavailable.', 503)
      const members = db.prepare('SELECT display_name, position FROM muse_cooperative_players WHERE story_id = ? ORDER BY position')
        .all(input.storyId).map((row: Record<string, unknown>) => ({ displayName: String(row.display_name), position: Number(row.position) }))
      return {
        members, currentTurnName: String(currentTurn.display_name), turnNumber: Number(currentTurn.turn_number),
        isYourTurn: currentTurn.current_user_id === input.userId, yourName: String(own.display_name)
      }
    })
  }

  cooperativeReady(): Promise<void> { return Promise.resolve() }

  async advance(id: string, sessionHash: string, action: 'open' | 'next' | 'guess' | 'hint' | 'skip', guess: string, playHash?: string, cooperativeUserId?: string): Promise<PlayerState> {
    return this.transaction((db, now) => {
      const story = db.prepare('SELECT brief, content, play_hash, answer_normalized, alternative_answers_normalized FROM shared_stories WHERE id = ?').get(id)
      if (!story || (playHash !== undefined && story.play_hash !== playHash)) throw new SharedStoryError('This story link is invalid, expired, or has been deleted.', 404)
      if (!['open', 'next', 'guess', 'hint', 'skip'].includes(action)) throw new SharedStoryError('Invalid story action.')
      const cooperative = JSON.parse(String(story.brief)).adventure?.cooperative === true
      if (cooperative && action !== 'open') {
        if (!cooperativeUserId) throw new SharedStoryError('Cooperative: sign in to take part.', 401)
        const member = db.prepare('SELECT 1 FROM muse_cooperative_players WHERE story_id = ? AND user_id = ?').get(id, cooperativeUserId)
        const turn = db.prepare('SELECT current_user_id FROM muse_cooperative_turns WHERE story_id = ?').get(id)
        if (!member) throw new SharedStoryError('Cooperative: join this story before playing.', 403)
        if (!turn || turn.current_user_id !== cooperativeUserId) throw new SharedStoryError('Cooperative: it is another participant’s turn.', 409)
      }
      if (action === 'open') db.prepare('INSERT INTO shared_story_sessions(story_id, player_hash) VALUES (?, ?) ON CONFLICT DO NOTHING').run(id, sessionHash)
      const player = db.prepare('SELECT * FROM shared_story_sessions WHERE story_id = ? AND player_hash = ?').get(id, sessionHash)
      if (!player) throw new SharedStoryError('Player session is invalid. Reopen the story link.')
      let scene = Number(player.current_scene)
      let solved = Boolean(player.solved)
      let skipped = Boolean(player.skipped)
      if (action === 'skip' && JSON.parse(String(story.brief)).unlockPolicy !== 'allow-skip') {
        throw new SharedStoryError('The sender chose Solve to unlock for this story.', 403)
      }
      let attempts = Number(player.attempts)
      let lastAttempt = player.last_attempt_at as number | null
      let revealedHints = Number(player.revealed_hints)
      if (!solved && !skipped && action === 'guess') {
        if (attempts >= 30) throw new SharedStoryError('Guess limit reached', 429)
        if (lastAttempt !== null && lastAttempt > now - 2000) throw new SharedStoryError('Please wait before guessing again', 429)
        solved = guess === story.answer_normalized || JSON.parse(String(story.alternative_answers_normalized)).includes(guess)
        attempts += 1
        lastAttempt = now
      } else if (!solved && !skipped && action === 'next') {
        if (JSON.parse(String(story.brief)).adventure) throw new SharedStoryError('Use a freeform adventure action instead of Next.')
        scene = Math.min(scene + 1, JSON.parse(String(story.content)).scenes.length - 1)
      } else if (!solved && !skipped && action === 'hint') {
        revealedHints = Math.min(revealedHints + 1, (JSON.parse(String(story.brief)).assistanceHints ?? []).length)
      } else if (!solved && !skipped && action === 'skip') {
        skipped = true
        db.prepare("UPDATE muse_adventure_requests SET status = 'failed', result = NULL WHERE story_id = ? AND player_hash = ? AND status = 'pending'").run(id, sessionHash)
      }
      db.prepare('UPDATE shared_story_sessions SET current_scene = ?, solved = ?, skipped = ?, attempts = ?, last_attempt_at = ?, revealed_hints = ? WHERE story_id = ? AND player_hash = ?')
        .run(scene, Number(solved), Number(skipped), attempts, lastAttempt, revealedHints, id, sessionHash)
      if (cooperative && action !== 'open' && cooperativeUserId) {
        const next = db.prepare(`SELECT user_id FROM muse_cooperative_players
          WHERE story_id = ? AND position > (SELECT position FROM muse_cooperative_players WHERE story_id = ? AND user_id = ?)
          ORDER BY position LIMIT 1`).get(id, id, cooperativeUserId) as { user_id?: string } | undefined
        const nextUserId = next?.user_id ?? String(db.prepare('SELECT user_id FROM muse_cooperative_players WHERE story_id = ? ORDER BY position LIMIT 1').get(id)!.user_id)
        db.prepare('UPDATE muse_cooperative_turns SET current_user_id = ?, turn_number = turn_number + 1 WHERE story_id = ?')
          .run(nextUserId, id)
      }
      return { current_scene: scene, solved, skipped, revealed_hints: revealedHints }
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

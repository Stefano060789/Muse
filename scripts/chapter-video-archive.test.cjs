const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const originalEnv = { ...process.env }
const originalFetch = global.fetch
class SharedStoryError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}

async function main() {
  const rows = new Map(), objects = new Map()
  let heartbeat = null, providerStatus = 'completed', failAssetDelete = false, onDownload = null, bucketPublic = false
  let invalidRange = false, externalUrl = false, storageFetches = 0
  const removedAssets = []
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.operation = 'read'; this.max = Infinity }
    select() { return this }
    eq(field, value) { this.filters.push(row => row[field] === value); return this }
    gt(field, value) { this.filters.push(row => row[field] > value); return this }
    lte(field, value) { this.filters.push(row => row[field] <= value); return this }
    or(value) {
      const stamp = value.split('lease_until.lt.')[1]
      this.filters.push(row => row.lease_until === null || row.lease_until < stamp)
      return this
    }
    order(field, options = {}) { this.orderField = field; this.ascending = options.ascending !== false; return this }
    limit(value) { this.max = value; return this }
    insert(value) { this.operation = 'insert'; this.value = value; return this }
    update(value) { this.operation = 'update'; this.value = value; return this }
    delete() { this.operation = 'delete'; return this }
    upsert(value) { this.operation = 'upsert'; this.value = value; return this }
    async maybeSingle() {
      const result = await this.execute()
      return { ...result, data: result.data?.[0] ?? null }
    }
    then(resolve, reject) { return this.execute().then(resolve, reject) }
    async execute() {
      if (this.table === 'muse_chapter_video_maintenance') {
        if (this.operation === 'upsert') { heartbeat = this.value.completed_at; return { data: null, error: null } }
        return { data: heartbeat ? [{ id: true, completed_at: heartbeat }] : [], error: null }
      }
      if (this.operation === 'insert') {
        rows.set(this.value.id, structuredClone(this.value))
        return { data: null, error: null }
      }
      let found = [...rows.values()].filter(row => this.filters.every(test => test(row)))
      if (this.orderField) found.sort((a, b) => String(a[this.orderField]).localeCompare(String(b[this.orderField])) * (this.ascending ? 1 : -1))
      found = found.slice(0, this.max)
      if (this.operation === 'update') for (const row of found) Object.assign(row, structuredClone(this.value))
      if (this.operation === 'delete') for (const row of found) rows.delete(row.id)
      return { data: structuredClone(found), error: null }
    }
  }
  const client = {
    from: table => new Query(table),
    storage: {
      getBucket: async () => ({ data: { public: bucketPublic, allowed_mime_types: ['video/mp4'], file_size_limit: 31457280 }, error: null }),
      from: () => ({
        upload: async (key, bytes) => { objects.set(key, Buffer.from(bytes)); return { error: null } },
        createSignedUrl: async key => ({
          data: objects.has(key) ? { signedUrl: `https://${externalUrl ? 'attacker.example' : 'synthetic.example'}/${key}` } : null,
          error: objects.has(key) ? null : {}
        }),
        remove: async keys => { keys.forEach(key => objects.delete(key)); return { error: null } }
      })
    }
  }
  const source = fs.readFileSync(path.join(root, 'src/lib/chapterVideoArchive.ts'), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const module = { exports: {} }
  new Function('module', 'exports', 'require', code)(module, module.exports, name => {
    if (name === '@supabase/supabase-js') return { createClient: () => client }
    if (name === './sharedStory') return { SharedStoryError }
    if (name === './heygenReel') return {
      heygenReelStatus: async () => ({ status: providerStatus, url: 'https://resource.heygen.ai/synthetic.mp4' }),
      downloadHeygenVideo: async () => {
        if (onDownload) await onDownload()
        return Buffer.from([0, 0, 0, 16, ...Buffer.from('ftypisom'), 1, 2, 3, 4])
      },
      deleteHeygenAsset: async asset => {
        if (failAssetDelete) throw new Error('simulated provider deletion failure')
        removedAssets.push(asset)
      }
    }
    return require(name)
  })
  const archive = module.exports
  process.env.MUSE_CHAPTER_VIDEO_ARCHIVE_ENABLED = 'true'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://synthetic.example'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service-key'
  await assert.rejects(archive.beginChapterVideo('local-development', 'x', 'y', 1), /signed-in account/)
  global.fetch = async (url, init) => {
    storageFetches++
    if (invalidRange) return new Response('invalid', { status: 200 })
    const key = new URL(url).pathname.slice(1)
    const bytes = objects.get(key)
    const match = /^bytes=(\d+)-(\d+)$/.exec(init.headers.Range)
    if (!bytes || !match) throw new Error('Unexpected storage request')
    const first = Number(match[1]), last = Math.min(Number(match[2]), bytes.length - 1)
    return new Response(bytes.subarray(first, last + 1), {
      status: 206, headers: { 'Content-Range': `bytes ${first}-${last}/${bytes.length}` }
    })
  }
  await assert.rejects(archive.assertChapterVideoReady(), /cleanup service/)
  heartbeat = new Date().toISOString()
  bucketPublic = true
  await assert.rejects(archive.assertChapterVideoReady(), /private storage/)
  bucketPublic = false
  heartbeat = new Date(Date.now() - 21 * 60000).toISOString()
  await assert.rejects(archive.assertChapterVideoReady(), /cleanup service/)
  heartbeat = new Date().toISOString()
  const chapter = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const story = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const job = await archive.beginChapterVideo('owner-a', chapter, story, 2)
  await archive.registerChapterVideoAsset(job, 'asset-1')
  await archive.finishChapterVideoStart(job, 'provider-reference')
  assert.equal((await archive.listChapterVideos('owner-b')).videos.length, 0)
  await assert.rejects(archive.chapterVideoStatus('owner-b', job.id), /not found/)
  failAssetDelete = true
  await assert.rejects(archive.chapterVideoStatus('owner-a', job.id), /cleanup failed/)
  assert.deepEqual(rows.get(job.id).asset_ids, ['asset-1'], 'Failed cleanup stays queued')
  failAssetDelete = false
  const ready = await archive.chapterVideoStatus('owner-a', job.id)
  assert.equal(ready.status, 'ready')
  assert.deepEqual(removedAssets, ['asset-1'])
  assert.equal(ready.chapterId, chapter)
  assert.equal(ready.storyId, story)
  assert.equal(ready.chapterNumber, 2)
  assert.ok(Date.parse(ready.expiresAt) - Date.now() > 7 * 86400000 - 5000)
  assert.ok(Date.parse(ready.expiresAt) - Date.now() <= 7 * 86400000)
  assert.equal((await archive.readChapterVideo('owner-a', job.id)).bytes.toString('ascii', 4, 8), 'ftyp')
  await assert.rejects(archive.readChapterVideo('owner-b', job.id), /not found/)
  invalidRange = true
  await assert.rejects(archive.readChapterVideo('owner-a', job.id), /unavailable/)
  invalidRange = false; externalUrl = true
  const before = storageFetches
  await assert.rejects(archive.readChapterVideo('owner-a', job.id), /unavailable/)
  assert.equal(storageFetches, before, 'An unexpected storage origin is never fetched')
  externalUrl = false
  const bigVideo = Buffer.alloc(archive.CHAPTER_VIDEO_CHUNK_BYTES + 50)
  bigVideo.write('ftyp', 4)
  objects.set(`${job.id}.mp4`, bigVideo)
  const first = await archive.readChapterVideo('owner-a', job.id, 0)
  const second = await archive.readChapterVideo('owner-a', job.id, archive.CHAPTER_VIDEO_CHUNK_BYTES)
  assert.equal(first.bytes.length, archive.CHAPTER_VIDEO_CHUNK_BYTES)
  assert.equal(second.bytes.length, 50)
  assert.equal(second.total, bigVideo.length)
  await assert.rejects(archive.readChapterVideo('owner-a', job.id, 1), /offset/)
  rows.get(job.id).expires_at = new Date(Date.now() - 1).toISOString()
  rows.get(job.id).next_check_at = new Date(Date.now() - 1).toISOString()
  await assert.rejects(archive.readChapterVideo('owner-a', job.id), /expired/)
  assert.ok(objects.has(`${job.id}.mp4`), 'Expiry blocks reads before the physical sweep')
  await archive.maintainChapterVideos()
  assert.equal(objects.has(`${job.id}.mp4`), false)
  assert.equal(rows.has(job.id), false)

  const deleting = await archive.beginChapterVideo('owner-a', chapter, story, 1)
  await archive.finishChapterVideoStart(deleting, 'provider-reference')
  onDownload = async () => { onDownload = null; await archive.deleteChapterVideo('owner-a', deleting.id) }
  await assert.rejects(archive.chapterVideoStatus('owner-a', deleting.id), /expired/)
  assert.ok(objects.has(`${deleting.id}.mp4`), 'Concurrent upload may finish after deletion is requested')
  await archive.maintainChapterVideos()
  assert.equal(objects.has(`${deleting.id}.mp4`), false, 'The cleanup queue removes a concurrent upload')
  assert.equal(rows.has(deleting.id), false)

  const pending = await archive.beginChapterVideo('owner-a', chapter, story, 1)
  await archive.registerChapterVideoAsset(pending, 'asset-2')
  await archive.finishChapterVideoStart(pending, 'provider-reference')
  providerStatus = 'processing'
  await archive.deleteChapterVideo('owner-a', pending.id)
  assert.equal(rows.get(pending.id).asset_ids[0], 'asset-2', 'Running jobs keep their references until terminal')
  await assert.rejects(archive.readChapterVideo('owner-a', pending.id), /expired/)
  providerStatus = 'completed'
  rows.get(pending.id).next_check_at = new Date(Date.now() - 1).toISOString()
  await archive.maintainChapterVideos()
  assert.ok(removedAssets.includes('asset-2'))
  assert.equal(rows.has(pending.id), false)
  console.log('PASS chapter video owner isolation, expiry, provider photo cleanup, deletion races and maintenance')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => {
  global.fetch = originalFetch
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key]
  Object.assign(process.env, originalEnv)
})

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const original = process.env.MUSE_CHAPTER_VIDEO_CRON_SECRET
async function main() {
  let runs = 0, fail = false
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'api', 'chapter-video-maintenance.ts'), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const mod = { exports: {} }
  new Function('module', 'exports', 'require', code)(mod, mod.exports, name => {
    if (name === '../../lib/chapterVideoArchive') return { maintainChapterVideos: async () => { runs++; if (fail) throw new Error('test') } }
    return require(name)
  })
  async function invoke(method, authorization) {
    const res = {
      statusCode: 200, body: null, setHeader() {},
      status(code) { this.statusCode = code; return this },
      json(body) { this.body = body; return this }
    }
    await mod.exports.default({ method, headers: { authorization } }, res)
    return res
  }
  delete process.env.MUSE_CHAPTER_VIDEO_CRON_SECRET
  assert.equal((await invoke('GET', '')).statusCode, 503)
  process.env.MUSE_CHAPTER_VIDEO_CRON_SECRET = 'synthetic-only-secret-32-characters-long'
  assert.equal((await invoke('POST', '')).statusCode, 405)
  assert.equal((await invoke('GET', 'Bearer wrong')).statusCode, 401)
  assert.equal(runs, 0)
  assert.equal((await invoke('GET', `Bearer ${process.env.MUSE_CHAPTER_VIDEO_CRON_SECRET}`)).statusCode, 200)
  assert.equal(runs, 1)
  fail = true
  assert.equal((await invoke('GET', `Bearer ${process.env.MUSE_CHAPTER_VIDEO_CRON_SECRET}`)).statusCode, 503)
  console.log('PASS maintenance requires secret and reports failures')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => {
  if (original === undefined) delete process.env.MUSE_CHAPTER_VIDEO_CRON_SECRET
  else process.env.MUSE_CHAPTER_VIDEO_CRON_SECRET = original
})

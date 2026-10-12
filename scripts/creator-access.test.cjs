const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const root = path.resolve(__dirname, '..')
const output = fs.mkdtempSync(path.join(__dirname, '.creator-access-tests-'))
const original = { ...process.env }
async function main() {
try {
  execFileSync(process.execPath, [path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
    'src/lib/creatorAccess.ts', '--outDir', output, '--module', 'commonjs', '--target', 'es2020',
    '--esModuleInterop', '--skipLibCheck', '--noEmit', 'false'], { cwd: root, stdio: 'inherit' })
  const { requireCreatorAccess } = require(path.join(output, 'creatorAccess.js'))
  const check = value => {
    const res = { statusCode: 0, body: null, setHeader() {}, status(code) { this.statusCode = code; return this }, json(body) { this.body = body } }
    return { allowed: requireCreatorAccess({ headers: { 'x-muse-creator-code': value } }, res), res }
  }
  delete process.env.VERCEL
  delete process.env.MUSE_CREATOR_ACCESS_CODE
  assert.equal(check(undefined).allowed, true)
  process.env.VERCEL = '1'
  assert.equal(check(undefined).res.statusCode, 503)
  process.env.MUSE_CREATOR_ACCESS_CODE = 'too-short'
  assert.equal(check('too-short').res.statusCode, 503)
  process.env.MUSE_CREATOR_ACCESS_CODE = 'fixture-code-not-a-real-secret'
  for (const value of [undefined, '', 'incorrect', ['fixture-code-not-a-real-secret'], 'x'.repeat(513)]) {
    assert.equal(check(value).res.statusCode, 401)
  }
  assert.equal(check('fixture-code-not-a-real-secret').allowed, true)
  const shared = fs.readFileSync(path.join(root, 'src', 'pages', 'api', 'shared-story.ts'), 'utf8')
  assert.ok(shared.includes("!['open', 'next', 'guess', 'hint', 'adventure'].includes(String(action)) && !requireCreatorAccess(req, res)"))
  for (const name of ['personal-story', 'story', 'profile', 'tts']) {
    assert.ok(fs.readFileSync(path.join(root, 'src', 'pages', 'api', `${name}.ts`), 'utf8').includes('if (!requireCreatorAccess(req, res)) return'))
  }
  const ts = require('typescript')
  const vm = require('node:vm')
  const source = fs.readFileSync(path.join(root, 'src', 'pages', 'api', 'personal-story.ts'), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const exports = {}
  vm.runInNewContext(compiled, {
    exports,
    require(name) {
      if (name.endsWith('/creatorAccess')) return { requireCreatorAccess }
      return new Proxy({}, { get() { throw new Error('Unauthorized request reached generation dependencies') } })
    }
  })
  for (const origin of [undefined, 'https://muse.example']) {
    const res = { statusCode: 0, setHeader() {}, status(code) { this.statusCode = code; return this }, json() {} }
    await exports.default({ method: 'POST', headers: { host: 'muse.example', ...(origin ? { origin } : {}) }, body: {} }, res)
    assert.equal(res.statusCode, 401, 'Personal generation must require creator access with or without Origin')
  }
  console.log('PASS creator gate: local compatibility, hosted fail-closed configuration, invalid codes rejected, valid code accepted, public player remains ungated')
} finally {
  process.env = original
  fs.rmSync(output, { recursive: true, force: true })
}
}
main().catch(error => { console.error(error); process.exitCode = 1 })

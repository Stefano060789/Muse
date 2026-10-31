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
      'src/lib/operationsAccess.ts', '--outDir', output, '--module', 'commonjs', '--target', 'es2020',
      '--esModuleInterop', '--skipLibCheck', '--noEmit', 'false'], { cwd: root, stdio: 'inherit' })
    const { requireOperationsAccess } = require(path.join(output, 'operationsAccess.js'))
    const check = (value, env = {}) => {
      Object.assign(process.env, env)
      const res = { statusCode: 0, body: null, setHeader() {}, status(code) { this.statusCode = code; return this }, json(body) { this.body = body } }
      const allowed = requireOperationsAccess({ headers: { 'x-muse-operations-code': value } }, res)
      return { allowed, res }
    }
    delete process.env.VERCEL
    delete process.env.NODE_ENV
    delete process.env.MUSE_OPERATIONS_ACCESS_CODE
    assert.equal(check(undefined).allowed, true, 'local operations can run without a credential')
    process.env.VERCEL = '1'
    assert.equal(check(undefined).res.statusCode, 503, 'hosted operations fail closed when unconfigured')
    process.env.MUSE_OPERATIONS_ACCESS_CODE = 'short'
    assert.equal(check('short').res.statusCode, 503, 'short operations credentials are rejected')
    process.env.MUSE_OPERATIONS_ACCESS_CODE = 'fixture-operations-not-a-real-secret'
    for (const value of [undefined, '', 'incorrect', ['fixture-operations-not-a-real-secret'], 'x'.repeat(513)]) {
      assert.equal(check(value).res.statusCode, 401)
    }
    assert.equal(check('fixture-operations-not-a-real-secret').allowed, true)

    const ts = require(path.join(root, 'node_modules', 'typescript'))
    const authSource = fs.readFileSync(path.join(root, 'src/lib/accountAuth.ts'), 'utf8')
    const authJs = ts.transpileModule(authSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
    const authExports = {}
    let getUser = async token => token === 'valid-token'
      ? { data: { user: { id: 'fixture-account', email: 'fixture@example.test' } }, error: null }
      : { data: { user: null }, error: new Error('invalid token') }
    class SharedStoryError extends Error { constructor(message, status) { super(message); this.status = status } }
    require('node:vm').runInNewContext(authJs, {
      exports: authExports,
      process: { env: process.env },
      require(name) {
        if (name === '@supabase/supabase-js') return { createClient: () => ({ auth: { getUser } }) }
        if (name === './sharedStory') return { SharedStoryError }
        if (name === './storyRepository') return { storyStorageMode: () => process.env.STORY_STORAGE || 'supabase' }
        if (name === './shareConsent') return { hasShareConsent: metadata => metadata?.muse_share_teaser_consent?.version === '2026-10-18' }
        throw new Error(`Unexpected account auth dependency: ${name}`)
      }
    })
    process.env.NODE_ENV = 'production'
    process.env.VERCEL = '1'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock.invalid'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fixture-anon-key'
    process.env.STORY_STORAGE = 'sqlite'
    const authRequest = authorization => ({ headers: authorization ? { authorization } : {} })
    const authResponse = () => ({ statusCode: 0, body: null, status(code) { this.statusCode = code; return this }, json(body) { this.body = body } })
    const missingAuthResponse = authResponse()
    assert.equal(await authExports.requireAccount(authRequest(), missingAuthResponse), null)
    assert.equal(missingAuthResponse.statusCode, 401)
    const invalidAuthResponse = authResponse()
    assert.equal(await authExports.requireAccount(authRequest('Bearer invalid-token'), invalidAuthResponse), null)
    assert.equal(invalidAuthResponse.statusCode, 401)
    assert.deepEqual(JSON.parse(JSON.stringify(await authExports.requireAccount(authRequest('Bearer valid-token'), authResponse()))),
      { id: 'fixture-account', email: 'fixture@example.test' })
    getUser = async () => ({
      data: { user: { id: 'fixture-account', email: 'fixture@example.test',
        user_metadata: { muse_share_teaser_consent: { version: '2026-10-18', acceptedAt: new Date().toISOString() } } } },
      error: null
    })
    assert.equal((await authExports.requireAccount(authRequest('Bearer valid-token'), authResponse())).shareTeaserConsent, true)
    getUser = async () => { throw new Error('auth service unavailable') }
    await assert.rejects(authExports.requireAccount(authRequest('Bearer valid-token'), authResponse()), error => error.status === 503)
    delete process.env.VERCEL
    delete process.env.NODE_ENV
    delete process.env.STORY_STORAGE
    process.env.STORY_STORAGE = 'sqlite'
    assert.deepEqual(JSON.parse(JSON.stringify(await authExports.requireAccount(authRequest(), authResponse()))),
      { id: 'local-development' })

    const shared = fs.readFileSync(path.join(root, 'src/pages/api/shared-story.ts'), 'utf8')
    assert.match(shared, /const PLAYER_ACTIONS = \['open', 'next', 'guess', 'hint', 'skip', 'adventure', 'media', 'voice', 'reply', 'studio-audio'\]/)
    assert.match(shared, /requireAccount\(req, res\)/)
    assert.match(shared, /story\.owner_id !== account\.id/)
    assert.match(shared, /listRetained\(account!\.id/)
    assert.match(shared, /owner_id: account!\.id/)
    for (const name of ['personal-story', 'story', 'profile', 'tts', 'shared-story-upload']) {
      assert.ok(fs.readFileSync(path.join(root, `src/pages/api/${name}.ts`), 'utf8').includes('requireAccount(req, res)'))
    }
    const accountPage = fs.readFileSync(path.join(root, 'src/pages/account.tsx'), 'utf8')
    assert.match(accountPage, /supabase\.auth\.signUp/)
    assert.match(accountPage, /supabase\.auth\.signInWithPassword/)
    assert.match(accountPage, /Create account/)
    for (const name of ['shared.tsx', 'story.tsx', 'library.tsx']) {
      const ui = fs.readFileSync(path.join(root, `src/pages/${name}`), 'utf8')
      assert.ok(!ui.includes('x-muse-creator-code'), `${name} must not send a deployment-wide creator code`)
    }
    assert.ok(fs.readFileSync(path.join(root, 'src/pages/shared.tsx'), 'utf8').includes('accountFetch'))
    assert.ok(fs.readFileSync(path.join(root, 'src/pages/library.tsx'), 'utf8').includes('action: \'library\''))
    console.log('PASS account authorization: operations credential is separate; hosted creator APIs require account identity, check story ownership, and leave recipient actions unauthenticated')
  } finally {
    process.env = original
    fs.rmSync(output, { recursive: true, force: true })
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })

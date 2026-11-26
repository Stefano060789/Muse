const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const saved = { env: { ...process.env }, error: console.error }
class SharedStoryError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}
async function main() {
  let row = null
  let fromCalls = 0
  let rpcCalls = 0
  let failRpc = false
  const logs = []
  console.error = message => logs.push(String(message))
  const client = {
    from() {
      fromCalls++
      throw new Error('Direct table access must not be used for hosted unit reservations')
    },
    async rpc(name, params) {
      rpcCalls++
      if (name !== 'muse_consume_operation_units') return { data: null, error: { code: 'unknown' } }
      if (failRpc) return { data: null, error: { code: 'PGRST301', message: 'SECRET FAILURE' } }
      if (!row) row = { bucket: params.p_bucket, used: 0, expires_at: params.p_expires_at }
      const used = row.used
      if (used + params.p_units > params.p_limit) return { data: { allowed: false, used, notify: false }, error: null }
      row.used += params.p_units
      return { data: { allowed: true, used: row.used, notify: false }, error: null }
    }
  }
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'operationsStore.ts'), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const mod = { exports: {} }
  new Function('module', 'exports', 'require', code)(mod, mod.exports, name => {
    if (name === '@supabase/supabase-js') return { createClient: () => client }
    if (name === './sharedStory') return { SharedStoryError }
    return require(name)
  })
  process.env.VERCEL = '1'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://synthetic.example'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-key'
  const bucket = 'heygen-reel-pilot-v1', expiry = '9999-12-31T23:59:59.000Z'
  const results = await Promise.allSettled(Array.from({ length: 30 }, () => mod.exports.consumeOperationUnits(bucket, 27, expiry, 2)))
  const accepted = results.filter(result => result.status === 'fulfilled' && result.value.allowed).length
  assert.ok(accepted > 0)
  assert.equal(row.used, accepted * 2)
  assert.ok(row.used <= 27, 'Concurrent reservations cannot exceed the pilot budget')
  assert.equal(fromCalls, 0, 'Hosted unit reservations should not use direct table upserts/selects')
  assert.ok(rpcCalls >= 30, 'Hosted unit reservations should call the RPC path')
  row.used = 26
  assert.equal((await mod.exports.consumeOperationUnits(bucket, 27, expiry, 2)).allowed, false)
  assert.equal(row.used, 26, 'Rejected multi-unit reservation is not partly consumed')
  failRpc = true
  await assert.rejects(
    () => mod.exports.consumeOperationUnits(bucket, 27, expiry, 2),
    error => error instanceof SharedStoryError && error.status === 503 && /Operational safety controls are unavailable/.test(error.message)
  )
  assert.ok(logs.some(entry => entry.includes('operations-units-rpc-error') && entry.includes('PGRST301')))
  assert.ok(logs.every(entry => !entry.includes('SECRET FAILURE')), 'RPC diagnostics never log provider/database messages')
  console.log('PASS hosted unit reservations use RPC, preserve atomic limits, and fail closed with safe diagnostics')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => {
  console.error = saved.error
  for (const key of Object.keys(process.env)) if (!(key in saved.env)) delete process.env[key]
  Object.assign(process.env, saved.env)
})

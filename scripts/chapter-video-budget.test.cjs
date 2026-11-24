const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const saved = { ...process.env }
class SharedStoryError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}
async function main() {
  let row = null
  const client = {
    from() {
      let action = 'read', value, conditions = []
      const query = {
        async upsert(item) {
          if (!row) row = { ...item }
          return { error: null }
        },
        select() { return this },
        update(item) { action = 'update'; value = item; return this },
        eq(field, expected) { conditions.push([field, expected]); return this },
        async maybeSingle() {
          if (!row || conditions.some(([field, expected]) => row[field] !== expected)) return { data: null, error: null }
          if (action === 'update') Object.assign(row, value)
          return { data: { ...row }, error: null }
        }
      }
      return query
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
  row.used = 26
  assert.equal((await mod.exports.consumeOperationUnits(bucket, 27, expiry, 2)).allowed, false)
  assert.equal(row.used, 26, 'Rejected multi-unit reservation is not partly consumed')
  console.log('PASS hosted optimistic budget reservation handles contention without overspending')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => {
  for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]
  Object.assign(process.env, saved)
})

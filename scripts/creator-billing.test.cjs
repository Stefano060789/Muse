const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const savedEnv = { ...process.env }
process.env.NODE_ENV = 'production'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://billing-fixture.example'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-service-role-key'
process.env.MUSE_CREATOR_EMAILS = 'bonomistefano@outlook.it'

let authUser = { email: 'bonomistefano@outlook.it', email_confirmed_at: '2026-01-01T00:00:00Z' }
let rpcResult = { allowed: false, reason: 'interaction_limit' }
const calls = []
const fakeDatabase = {
  auth: { admin: { async getUserById(ownerId) { calls.push(['user', ownerId]); return { data: { user: authUser }, error: null } } } },
  async rpc(name, input) { calls.push([name, input]); return { data: name === 'muse_billing_status' ? {
    tier: 'plus', status: 'trialing', trialStartedAt: '2026-11-01T00:00:00Z', trialEndsAt: '2026-12-01T00:00:00Z',
    periodStartedAt: '2026-11-01T00:00:00Z', periodEndsAt: '2026-12-01T00:00:00Z',
    storiesUsed: 1, storyLimit: 10, interactionsUsed: 120, interactionLimit: 120, canGenerate: true
  } : rpcResult, error: null } }
}

class SharedStoryError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}
const source = fs.readFileSync(path.join(__dirname, '../src/lib/billing.ts'), 'utf8')
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
}).outputText
const compiledModule = { exports: {} }
new Function('module', 'exports', 'require', javascript)(compiledModule, compiledModule.exports, id => {
  if (id === '@supabase/supabase-js') return { createClient: () => fakeDatabase }
  if (id === 'stripe') return class Stripe {}
  if (id === './sharedStory') return { SharedStoryError }
  if (id === './stripeSandbox') return {
    sandboxApiKey() { throw new Error('Stripe is not used in this test') },
    requireSandboxSubscription() {}, requireSandboxAccount() {}
  }
  throw new Error(`Unexpected runtime dependency: ${id}`)
})

async function main() {
  const { getBillingStatus, reserveBillingUsage } = compiledModule.exports
  await reserveBillingUsage('creator-owner', 'interaction:1', 'interaction')
  assert.ok(calls.some(([name, value]) => name === 'muse_reserve_billing_usage' && value.p_usage_kind === 'interaction'),
    'Creator still passes through the server billing reservation')
  assert.ok(calls.some(([name]) => name === 'user'), 'Creator exemption verifies the account via Supabase Auth')
  assert.equal((await getBillingStatus('creator-owner')).interactionUnlimited, true)

  calls.length = 0
  await assert.rejects(() => reserveBillingUsage('creator-owner', 'story:1', 'story'), error => error.status === 402,
    'Creator exemption does not remove story creation limits')
  assert.ok(!calls.some(([name]) => name === 'user'), 'Story creation does not use creator interaction override')

  authUser = { email: 'another@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' }
  assert.equal((await getBillingStatus('other-owner')).interactionUnlimited, false)
  await assert.rejects(() => reserveBillingUsage('other-owner', 'interaction:2', 'interaction'), error => error.status === 402)

  authUser = { email: 'bonomistefano@outlook.it', email_confirmed_at: null }
  assert.equal((await getBillingStatus('unverified-owner')).interactionUnlimited, false,
    'An unverified email never receives creator privileges')
  await assert.rejects(() => reserveBillingUsage('unverified-owner', 'interaction:3', 'interaction'), error => error.status === 402)

  authUser = { email: 'bonomistefano@outlook.it', email_confirmed_at: '2026-01-01T00:00:00Z' }
  rpcResult = { allowed: false, reason: 'trial_or_subscription_ended' }
  await assert.rejects(() => reserveBillingUsage('creator-owner', 'interaction:4', 'interaction'), error => error.status === 402,
    'Creator still needs an active trial or subscription')
  console.log('PASS verified creator override waives only monthly interaction cap and leaves other billing gates intact')
}

main().finally(() => {
  for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key]
  for (const [key, value] of Object.entries(savedEnv)) process.env[key] = value
})

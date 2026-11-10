const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
class SharedStoryError extends Error {
  constructor(message, status) { super(message); this.status = status }
}
function load(relative, mocks = {}) {
  const result = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
  }).outputText
  new Function('module', 'exports', 'require', code)(result, result.exports, id => {
    if (Object.hasOwn(mocks, id)) return mocks[id]
    if (id.endsWith('/sharedStory')) return { SharedStoryError }
    if (id.startsWith('.')) return load(path.join(path.dirname(relative), id + '.ts'), mocks)
    return require(id)
  })
  return result.exports
}

async function main() {
  // Isolate configuration; never read the developer's credential environment.
  const originalEnv = process.env
  process.env = { NODE_ENV: 'test' }
  try {
    const guard = load('src/lib/stripeSandbox.ts')
    const catalogue = load('src/lib/stripeCatalogue.ts').STRIPE_TEST_CATALOGUE
    assert.deepEqual(Object.values(catalogue).map(plan => plan.unitAmount), [899, 8999])
    assert.equal(catalogue.annual.fulfillment, 'catalogue-only')
    assert.equal(catalogue.monthly.priceId, 'price_1UYpG5C5ufGRzg9R3hgrKDlg')
    assert.equal(catalogue.annual.priceId, 'price_1UYpNIC5ufGRzg9RuzXzBfyA')
    assert.equal(catalogue.monthly.productId, 'prod_VZzEGTdZZFjCf5')
    assert.equal(catalogue.annual.productId, catalogue.monthly.productId)
    assert.equal('gift' in catalogue, false)
    assert.throws(() => guard.requireStripeSandbox(), /disabled/)
    for (const value of ['false', '1', 'TRUE', 'sandbox']) {
      process.env.MUSE_STRIPE_SANDBOX_ENABLED = value
      assert.throws(() => guard.requireStripeSandbox(), /disabled/)
    }
    process.env.MUSE_STRIPE_SANDBOX_ENABLED = 'true'
    assert.throws(() => guard.requireStripeSandbox(), /isolated test billing storage/)
    for (const value of ['true', '1', 'production', '']) {
      process.env.MUSE_STRIPE_ISOLATED_BILLING_STORAGE_ACK = value
      assert.throws(() => guard.requireStripeSandbox(), /isolated test billing storage/)
    }
    process.env.MUSE_STRIPE_ISOLATED_BILLING_STORAGE_ACK = 'isolated-test-database'
    for (const key of [undefined, 'sk_live_fixture', 'rk_live_fixture', 'pk_test_fixture', 'invalid']) {
      if (key === undefined) delete process.env.STRIPE_SECRET_KEY
      else process.env.STRIPE_SECRET_KEY = key
      assert.throws(() => guard.sandboxApiKey(), /Only Stripe test/)
    }
    process.env.STRIPE_SECRET_KEY = 'sk_test_fixture'
    assert.equal(guard.sandboxApiKey(), 'sk_test_fixture')
    process.env.STRIPE_SECRET_KEY = 'rk_test_fixture'
    assert.equal(guard.sandboxApiKey(), 'rk_test_fixture')
    assert.equal(guard.sandboxMonthlyPriceId(), catalogue.monthly.priceId)
    process.env.STRIPE_MONTHLY_PRICE_ID = ''
    assert.throws(() => guard.sandboxMonthlyPriceId(), /not configured/)
    process.env.STRIPE_MONTHLY_PRICE_ID = 'price_monthlyFixture'
    process.env.NEXT_PUBLIC_SITE_URL = 'https://muse.example'
    process.env.STRIPE_WEBHOOK_SECRET = 'fixture-signature'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://database.example'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-service'
    const price = {
      id: process.env.STRIPE_MONTHLY_PRICE_ID, product: catalogue.monthly.productId, livemode: false, currency: 'eur', unit_amount: 899,
      type: 'recurring', billing_scheme: 'per_unit',
      recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' }
    }
    guard.requireSandboxMonthlyPrice(price)
    for (const change of [
      { livemode: true }, { livemode: undefined }, { id: 'price_other' }, { currency: 'usd' },
      { product: 'prod_other' }, { product: undefined },
      { unit_amount: 8999 }, { type: 'one_time' }, { recurring: null },
      { recurring: { ...price.recurring, interval: 'year' } },
      { recurring: { ...price.recurring, interval_count: 12 } },
      { recurring: { ...price.recurring, usage_type: 'metered' } },
      { billing_scheme: 'tiered' }
    ]) assert.throws(() => guard.requireSandboxMonthlyPrice({ ...price, ...change }))
    const session = {
      id: 'cs_test_fixture', livemode: false, url: 'https://checkout.stripe.com/c/pay/cs_test_fixture'
    }
    guard.requireSandboxCheckout(session)
    for (const change of [
      { livemode: true }, { livemode: undefined }, { id: 'cs_live_fixture' },
      { url: 'https://checkout.stripe.com/c/pay/cs_live_fixture' },
      { url: 'https://checkout.stripe.com.evil.example/c/pay/cs_test_fixture' }, { url: null }
    ]) assert.throws(() => guard.requireSandboxCheckout({ ...session, ...change }))
    const subscription = {
      id: 'sub_fixture', livemode: false, status: 'active', customer: 'cus_fixture',
      metadata: { muse_app: 'muse', muse_environment: 'sandbox', muse_owner_id: 'owner' },
      items: { data: [{ price, quantity: 1 }] }
    }
    guard.requireSandboxSubscription(subscription)
    for (const change of [
      { livemode: true }, { livemode: undefined }, { metadata: {} },
      { metadata: { ...subscription.metadata, muse_app: 'other' } },
      { items: { data: [] } }, { items: { data: [...subscription.items.data, ...subscription.items.data] } },
      { items: { data: [{ price, quantity: 2 }] } }
    ]) assert.throws(() => guard.requireSandboxSubscription({ ...subscription, ...change }))

    let signedIn = true, checkoutCalls = 0, databaseCalls = 0, applied = 0, checkoutParams
    let returnedPrice = price, returnedSession = session, invalidSignature = false, providerFailure = false
    let accountId = 'acct_1UQsxxC5ufGRzg9R', accountFailure = false
    let event = { id: 'evt_fixture', type: 'customer.subscription.updated', livemode: false, data: { object: subscription } }
    const stripe = {
      accounts: { retrieve: async () => {
        if (accountFailure) throw new Error('Account lookup unavailable')
        return { id: accountId }
      } },
      prices: { retrieve: async () => {
        if (providerFailure) throw new Error('Private provider diagnostic')
        return returnedPrice
      } },
      checkout: { sessions: { create: async params => { checkoutCalls++; checkoutParams = params; return returnedSession } } },
      webhooks: { constructEvent: () => {
        if (invalidSignature) throw new Error('Invalid signature')
        return event
      } }
    }
    const billingMock = {
      stripeClient: () => { guard.sandboxApiKey(); return stripe },
      getBillingStatus: async () => ({ status: 'trialing' }),
      applyStripeSubscription: async sub => { guard.requireSandboxSubscription(sub); applied++ }
    }
    const mocks = {
      '../../lib/billing': billingMock,
      '../../lib/accountAuth': { requireAccount: async (_req, res) => {
        if (!signedIn) { res.status(401).json({ error: 'Sign in' }); return null }
        return { id: 'owner', email: 'owner@example.test' }
      } },
      '../../lib/operations': { apiSafety: async () => true },
      '@supabase/supabase-js': { createClient: () => {
        databaseCalls++
        return { from: () => ({ insert: async () => ({ error: null }), delete: () => ({ eq: async () => ({}) }) }) }
      } }
    }
    const checkout = load('src/pages/api/billing.ts', mocks).default
    const webhook = load('src/pages/api/stripe-webhook.ts', mocks).default
    function response() {
      return { statusCode: 0, body: null, setHeader() {}, status(code) { this.statusCode = code; return this },
        json(body) { this.body = body; return this } }
    }
    async function request(handler, body = {}, headers = {}) {
      const req = { method: 'POST', body, headers: { host: 'muse.example', ...headers },
        async *[Symbol.asyncIterator]() { yield Buffer.from('{}') } }
      const res = response()
      await handler(req, res)
      return res
    }
    signedIn = false
    assert.equal((await request(checkout, { action: 'subscribe' })).statusCode, 401)
    assert.equal(checkoutCalls, 0)
    signedIn = true
    assert.equal((await request(checkout, { action: 'subscribe' }, { origin: 'https://other.example' })).statusCode, 403)
    delete process.env.MUSE_STRIPE_ISOLATED_BILLING_STORAGE_ACK
    assert.equal((await request(checkout, { action: 'subscribe' })).statusCode, 503)
    assert.equal((await request(webhook)).statusCode, 503)
    assert.equal(databaseCalls, 0)
    assert.equal(checkoutCalls, 0)
    process.env.MUSE_STRIPE_ISOLATED_BILLING_STORAGE_ACK = 'isolated-test-database'
    delete process.env.MUSE_STRIPE_SANDBOX_ENABLED
    assert.equal((await request(checkout, { action: 'subscribe' })).statusCode, 503)
    assert.equal((await request(webhook)).statusCode, 503)
    assert.equal(checkoutCalls, 0)
    assert.equal(databaseCalls, 0)
    process.env.MUSE_STRIPE_SANDBOX_ENABLED = 'true'
    for (const planId of ['annual', 'gift']) {
      assert.equal((await request(checkout, { action: 'subscribe', planId })).statusCode, 400)
    }
    process.env.STRIPE_SECRET_KEY = 'sk_live_fixture'
    assert.equal((await request(checkout, { action: 'subscribe' })).statusCode, 503)
    assert.equal((await request(webhook, {}, { 'stripe-signature': 'fixture' })).statusCode, 400)
    assert.equal(checkoutCalls, 0)
    assert.equal(databaseCalls, 0)
    process.env.STRIPE_SECRET_KEY = 'sk_test_fixture'
    accountId = 'acct_other'
    assert.equal((await request(checkout, { action: 'subscribe' })).statusCode, 503)
    assert.equal(checkoutCalls, 0)
    accountId = 'acct_1UQsxxC5ufGRzg9R'
    accountFailure = true
    assert.equal((await request(checkout, { action: 'subscribe' })).statusCode, 503)
    assert.equal(checkoutCalls, 0)
    accountFailure = false
    returnedPrice = { ...price, livemode: true }
    assert.equal((await request(checkout, { action: 'subscribe' })).statusCode, 400)
    assert.equal(checkoutCalls, 0)
    returnedPrice = price
    returnedSession = { ...session, livemode: true }
    let result = await request(checkout, { action: 'subscribe' })
    assert.equal(result.statusCode, 503)
    assert.equal(result.body.url, undefined)
    returnedSession = session
    result = await request(checkout, { action: 'subscribe' })
    assert.equal(result.statusCode, 200)
    assert.equal(result.body.url, session.url)
    assert.equal(checkoutParams.automatic_tax.enabled, false)
    assert.equal(checkoutParams.subscription_data.metadata.muse_app, 'muse')
    assert.equal(checkoutParams.subscription_data.metadata.muse_owner_id, 'owner')
    assert.deepEqual(checkoutParams.line_items, [{ price: price.id, quantity: 1 }])
    providerFailure = true
    result = await request(checkout, { action: 'subscribe' })
    assert.equal(result.statusCode, 503)
    assert.equal(result.body.error, 'Billing is temporarily unavailable.')
    providerFailure = false
    delete process.env.STRIPE_MONTHLY_PRICE_ID
    returnedPrice = { ...price, id: catalogue.monthly.priceId }
    assert.equal((await request(checkout, { action: 'subscribe' })).statusCode, 200)
    assert.equal(checkoutParams.line_items[0].price, catalogue.monthly.priceId)
    process.env.STRIPE_MONTHLY_PRICE_ID = price.id
    returnedPrice = price

    async function deliver(nextEvent) {
      event = nextEvent
      return request(webhook, {}, { 'stripe-signature': 'fixture' })
    }
    const validEvent = { ...event }
    invalidSignature = true
    assert.equal((await deliver(validEvent)).statusCode, 400)
    invalidSignature = false
    assert.equal((await deliver({ ...validEvent, account: 'acct_other' })).statusCode, 400)
    accountId = 'acct_other'
    assert.equal((await deliver(validEvent)).statusCode, 503)
    accountId = 'acct_1UQsxxC5ufGRzg9R'
    accountFailure = true
    assert.equal((await deliver(validEvent)).statusCode, 503)
    accountFailure = false
    for (const livemode of [true, undefined]) {
      assert.equal((await deliver({ ...validEvent, livemode })).statusCode, 400)
    }
    assert.equal((await deliver({ ...validEvent, data: { object: { ...subscription, livemode: true } } })).statusCode, 400)
    result = await deliver({ ...validEvent, data: { object: { ...subscription, metadata: { muse_app: 'other' } } } })
    assert.equal(result.body.ignored, true)
    result = await deliver({ ...validEvent, type: 'checkout.session.completed' })
    assert.equal(result.body.ignored, true)
    assert.equal((await deliver({ ...validEvent, data: { object: { ...subscription,
      items: { data: [{ quantity: 1, price: { ...price, id: 'price_annualFixture' } }] } } } })).statusCode, 400)
    assert.equal(databaseCalls, 0, 'Rejected/foreign events must not touch storage')
    assert.equal(applied, 0)
    for (const type of ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted']) {
      assert.equal((await deliver({ ...validEvent, type })).statusCode, 200)
    }
    assert.equal(databaseCalls, 3)
    assert.equal(applied, 3)
    // Defense in depth: direct callers cannot bypass the webhook's guards.
    const actualBilling = load('src/lib/billing.ts', mocks)
    await assert.rejects(() => actualBilling.applyStripeSubscription({ ...subscription, livemode: true }))
    assert.equal(databaseCalls, 3)
    process.env.STRIPE_SECRET_KEY = 'sk_live_fixture'
    assert.throws(() => actualBilling.stripeClient(), /Only Stripe test/)
    delete process.env.MUSE_STRIPE_SANDBOX_ENABLED
    assert.throws(() => actualBilling.stripeClient(), /disabled/)
    console.log('PASS sandbox opt-in, keys, catalogue, monthly price/session guards, authenticated checkout, webhook routing and live rejection')
  } finally { process.env = originalEnv }
}
main().catch(error => { console.error(error); process.exitCode = 1 })

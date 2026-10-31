const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
function load(file, mocks = {}) {
  const module = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText
  new Function('module', 'exports', 'require', code)(module, module.exports, id => {
    if (id in mocks) return mocks[id]
    if (id.startsWith('.')) return load(path.join(path.dirname(file), id + '.ts'), mocks)
    return require(id)
  })
  return module.exports
}
const consent = load('src/lib/shareConsent.ts')
assert.equal(consent.hasShareConsent(undefined), false)
assert.equal(consent.hasShareConsent({}), false)
assert.equal(consent.hasShareConsent({ [consent.SHARE_CONSENT_METADATA_KEY]: true }), false)
const granted = consent.shareConsentUpdate(true)
assert.equal(consent.hasShareConsent(granted), true)
assert.equal(consent.hasShareConsent(consent.shareConsentUpdate(false)), false)
assert.equal(consent.hasShareConsent({ [consent.SHARE_CONSENT_METADATA_KEY]: { version: 'old', acceptedAt: new Date().toISOString() } }), false)
assert.equal(consent.hasShareConsent({ [consent.SHARE_CONSENT_METADATA_KEY]: { ...granted[consent.SHARE_CONSENT_METADATA_KEY], acceptedAt: 'invalid' } }), false)
const copy = load('src/lib/shareConsentCopy.ts')
for (const language of ['en-US', 'it-IT', 'es-ES', 'zh-CN', 'hi-IN', 'uk-UA', 'ar-SA']) {
  assert.ok(Object.values(copy.shareConsentCopy(language)).every(value => value.trim()))
}
const tick = () => new Promise(resolve => setImmediate(resolve))
let session = { user: { id: 'first', user_metadata: {} } }
const listeners = new Set()
let failSave = false
const client = { auth: {
  async getSession() { return { data: { session }, error: null } },
  onAuthStateChange(callback) { listeners.add(callback); return { data: { subscription: { unsubscribe() { listeners.delete(callback) } } } } },
  async updateUser({ data }) {
    if (failSave) return { data: { user: null }, error: new Error('storage failed') }
    session = { user: { ...session.user, user_metadata: { ...session.user.user_metadata, ...data } } }
    listeners.forEach(callback => callback('USER_UPDATED', session))
    return { data: { user: session.user }, error: null }
  }
} }
function mount() {
  const slots = [], cleanups = []
  let index = 0
  const react = {
    useState(initial) { const i = index++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value }] },
    useRef(initial) { const i = index++; return slots[i] || (slots[i] = { current: initial }) },
    useEffect(effect) { const i = index++; if (!(i in slots)) { slots[i] = true; cleanups.push(effect()) } }
  }
  const hook = load('src/lib/useShareConsent.ts', { react, './accountClient': { supabase: client } }).useShareConsent
  return { render() { index = 0; return hook() }, dispose() { cleanups.forEach(cleanup => cleanup?.()) } }
}
async function main() {
  let hook = mount()
  hook.render()
  await tick()
  assert.equal(hook.render().accepted, false, 'registration never grants permission')
  await hook.render().save(true)
  assert.equal(hook.render().accepted, true)
  assert.equal(await hook.render().verify(), true)
  hook.dispose()
  hook = mount()
  hook.render()
  await tick()
  assert.equal(hook.render().accepted, true, 'account permission survives remounts')
  const settings = mount()
  settings.render()
  await tick()
  await settings.render().save(false)
  assert.equal(hook.render().accepted, false, 'Settings revocation updates mounted share cards')
  assert.equal(await hook.render().verify(), false)
  failSave = true
  await assert.rejects(hook.render().save(true))
  assert.equal(hook.render().accepted, false)
  assert.equal(hook.render().failed, true, 'save failure stays visible and never grants consent')
  failSave = false
  await hook.render().save(true)
  session = { user: { id: 'second', user_metadata: {} } }
  listeners.forEach(callback => callback('SIGNED_IN', session))
  assert.equal(hook.render().accepted, false, 'permission is not transferred to another account')
  session = null
  listeners.forEach(callback => callback('SIGNED_OUT', session))
  assert.equal(await hook.render().verify(), false)
  settings.dispose()
  hook.dispose()
  assert.equal(listeners.size, 0)

  let providerCalls = 0, billingCalls = 0, allowed = false
  class SharedStoryError extends Error { constructor(message, status) { super(message); this.status = status } }
  const handler = load('src/pages/api/personal-story.ts', {
    '../../lib/accountAuth': { requireAccount: async () => ({ id: 'first', shareTeaserConsent: allowed }) },
    '../../lib/sharedStory': { SharedStoryError },
    '../../lib/operations': { apiSafety: async () => true, reportOperation() {} },
    '../../lib/providerConsent': { requireProviderConsent() {} },
    '../../lib/storyProvider': { storyProviderConfig() {} },
    '../../lib/storyRequestLimits': { storyDatabase: () => ({}), reserveStoryRequest: async () => {} },
    '../../lib/billing': { reserveBillingUsage: async () => { billingCalls++ } },
    '../../lib/personalStoryShare': { parsePersonalStoryShareInput: body => body, generatePersonalStoryShareTeaser: async () => { providerCalls++; return 'Teaser' } },
    '../../lib/personalStoryGenerator': {},
    '../../lib/sharedAdventure': { adventureGlobalCap: () => 12 },
    '../../lib/personalJourney': {},
    '../../lib/storyRomance': { StoryRomanceError: class extends Error {} }
  }).default
  function response() { return { setHeader() {}, status(code) { this.code = code; return this }, json(body) { this.body = body; return this } } }
  const request = { method: 'POST', headers: {}, body: { action: 'share-teaser', title: 'A story', mood: 'hopeful', language: 'en-US' } }
  let res = response()
  await handler(request, res)
  assert.equal(res.code, 403)
  assert.equal(billingCalls, 0)
  assert.equal(providerCalls, 0)
  allowed = true
  res = response()
  await handler(request, res)
  assert.equal(res.code, 200)
  assert.equal(billingCalls, 1)
  assert.equal(providerCalls, 1)
  console.log('PASS optional account consent persistence, revocation, account isolation, errors, versioning and server gating')
}
main().catch(error => { console.error(error); process.exitCode = 1 })

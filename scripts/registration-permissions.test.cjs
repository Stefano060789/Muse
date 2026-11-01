const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
function load(file, mocks = {}) {
  const module = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }
  }).outputText
  new Function('module', 'exports', 'require', code)(module, module.exports, id => {
    if (id in mocks) return mocks[id]
    if (id.startsWith('.')) return load(path.join(path.dirname(file), id + '.ts'), mocks)
    return require(id)
  })
  return module.exports
}
function flatten(node) {
  if (node == null || typeof node === 'boolean') return []
  if (Array.isArray(node)) return node.flatMap(flatten)
  return typeof node === 'object' ? [node, ...flatten(node.props?.children)] : [node]
}
const tick = () => new Promise(resolve => setImmediate(resolve))
function runner(file, exportName, mocks, props) {
  let cursor = 0, value
  const slots = [], pending = []
  const react = {
    useState(initial) {
      const i = cursor++
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial
      return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next }]
    },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } },
    useEffect(effect, deps) {
      const i = cursor++, previous = slots[i]
      if (!previous || deps.some((item, j) => item !== previous.deps[j])) {
        slots[i] = { deps, cleanup: previous?.cleanup }
        pending.push(() => { previous?.cleanup?.(); slots[i].cleanup = effect() })
      }
    }
  }
  const fn = load(file, { react, ...mocks })[exportName]
  return {
    render() { cursor = 0; value = fn(props); pending.splice(0).forEach(effect => effect()); return value },
    dispose() { slots.forEach(slot => slot?.cleanup?.()) }
  }
}
async function main() {
  const permissions = load('src/lib/accountPermissions.ts')
  class SharedStoryError extends Error { constructor(message, status) { super(message); this.status = status } }
  const provider = load('src/lib/providerConsent.ts', { './sharedStory': { SharedStoryError } })
  const share = load('src/lib/shareConsent.ts')
  const romance = load('src/lib/storyRomance.ts')
  assert.deepEqual(permissions.accountPermissions({}), { managed: false, services: false, romance: false })
  const audioGranted = permissions.accountPermissions(permissions.cloudAudioPermissionUpdate(true))
  assert.equal(audioGranted.managed, false, 'Audio opt-in never migrates legacy story permissions')
  assert.equal(audioGranted.services, false)
  assert.equal(audioGranted.cloudAudio, true)
  provider.requireCloudAudioConsent({}, audioGranted)
  const audioRevoked = permissions.accountPermissions(permissions.cloudAudioPermissionUpdate(false))
  assert.throws(() => provider.requireCloudAudioConsent({ consentVersion: provider.PROVIDER_CONSENT_VERSION }, audioRevoked), error => error.status === 403)
  assert.throws(() => provider.requireCloudAudioConsent({ consentVersion: provider.PROVIDER_CONSENT_VERSION }, permissions.accountPermissions({})), error => error.status === 403)
  const granted = permissions.accountPermissionsUpdate(true, true)
  const active = permissions.accountPermissions(granted)
  assert.equal(share.hasShareConsent(granted), true)
  provider.requireProviderConsent({}, active)
  romance.requireRomanceConfirmation('sweet', false, active)
  const revoked = permissions.accountPermissions(permissions.accountPermissionsUpdate(false, false))
  assert.throws(() => provider.requireProviderConsent({ consentVersion: provider.PROVIDER_CONSENT_VERSION }, revoked), error => error.status === 403)
  assert.throws(() => romance.requireRomanceConfirmation('sweet', true, revoked))
  assert.equal(share.hasShareConsent({ ...share.shareConsentUpdate(true), ...permissions.accountPermissionsUpdate(false, false) }), false)
  assert.throws(() => provider.requireProviderConsent({}, permissions.accountPermissions({})), error => error.status === 400)
  assert.equal(permissions.accountPermissions({ [permissions.ACCOUNT_PERMISSIONS_KEY]: { version: 'old', acceptedAt: 'invalid', services: true } }).services, false)
  for (const language of ['en-US', 'it-IT', 'es-ES', 'zh-CN', 'hi-IN', 'uk-UA', 'ar-SA']) {
    assert.ok(Object.values(load('src/lib/registrationCopy.ts').registrationCopy(language)).every(text => text.trim()))
    const audioCopy = load('src/lib/audioControlsCopy.ts')
    assert.ok(audioCopy.narrationPreview(language).trim())
    assert.equal(audioCopy.narrationPreview(language.split('-')[0]), audioCopy.narrationPreview(language))
    for (const style of ['calm', 'warm', 'curious', 'adventurous', 'playful', 'suspenseful']) assert.ok(audioCopy.narrationStyleLabel(style, language).trim())
  }
  let session = null, signup
  const listeners = new Set(), slots = [], effects = []
  let cursor = 0
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value }] },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } },
    useEffect(fn, deps) { const i = cursor++; const old = slots[i]; if (!old || deps.some((value, j) => value !== old[j])) effects.push(fn); slots[i] = deps }
  }
  const jsx = (type, props) => ({ type, props: props || {} })
  const client = { auth: {
    async getSession() { return { data: { session }, error: null } },
    onAuthStateChange(callback) { listeners.add(callback); return { data: { subscription: { unsubscribe() { listeners.delete(callback) } } } } },
    async signUp(options) { signup = options; return { data: { session: null, user: { email: options.email } }, error: null } }
  } }
  const savedAudioChoices = []
  const savedServiceChoices = []
  let pagePermissions = {
    managed: false, services: false, romance: false, ready: true, saving: false,
    save: async (services, romance) => { savedServiceChoices.push([services, romance]) },
    saveCloudAudio: async accepted => { savedAudioChoices.push(accepted) }
  }
  const account = load('src/pages/account.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'next/head': { default: 'Head' }, 'next/link': { default: 'Link' },
    '../lib/accountClient': { supabase: client },
    '../lib/useAccountPermissions': { useAccountPermissions: () => pagePermissions },
    '../lib/useShareConsent': { useShareConsent: () => ({ accepted: false, ready: true }) },
    '../lib/interfaceLanguage': { useInterfaceLanguage: () => 'en-US', interfaceText: key => key, loadInterfaceLanguage: () => 'en-US' },
    '../lib/storyPreferences': { loadStoryPreferences: () => ({ language: 'en-US' }) },
    '../lib/profilePreferences': { loadProfileDisplayName: () => '' },
    '../lib/storyProgressNotifications': { loadStoryProgressNotificationsEnabled: () => true }
  }).default
  async function render() {
    let nodes
    for (let i = 0; i < 3; i++) { cursor = 0; nodes = flatten(account()); effects.splice(0).forEach(effect => effect()); await tick() }
    return nodes.filter(node => node && typeof node === 'object')
  }
  let nodes = await render()
  nodes.find(node => node.type === 'button' && node.props.children === 'createAccount').props.onClick()
  nodes = await render()
  const form = nodes.find(node => node.type === 'form' && flatten(node).some(child => child?.type === 'input' && child.props.type === 'email'))
  form.props.onSubmit({ preventDefault() {} }); await tick()
  assert.equal(signup, undefined, 'Invoked disabled submission cannot bypass the registration tick')
  nodes.find(node => node.type === 'input' && node.props.type === 'email').props.onChange({ target: { value: 'reader@example.com' } })
  nodes.find(node => node.type === 'input' && node.props.type === 'password').props.onChange({ target: { value: 'fixture-password' } })
  const checks = nodes.filter(node => node.type === 'input' && node.props.type === 'checkbox')
  const services = checks.find(node => flatten(nodes.find(parent => parent.type === 'label' && flatten(parent).includes(node))).includes('I agree to Muse AI and audio processing for my stories.'))
  assert.equal(services.props.checked, false)
  services.props.onChange({ target: { checked: true } })
  nodes = await render()
  nodes.find(node => node.type === 'form' && flatten(node).some(child => child?.type === 'input' && child.props.type === 'email')).props.onSubmit({ preventDefault() {} })
  await tick()
  assert.equal(signup.email, 'reader@example.com')
  assert.deepEqual(permissions.accountPermissions(signup.options.data), { managed: true, services: true, romance: false })
  assert.equal(session, null, 'Confirmation-email registrations retain permission in signup metadata without a session')
  session = { user: { id: 'existing-settings-reader', email: 'reader@example.com', user_metadata: {} } }
  listeners.forEach(callback => callback('SIGNED_IN', session))
  nodes = await render()
  const processingSection = nodes.find(node => node.props['aria-labelledby'] === 'registration-permissions-heading')
  assert.ok(processingSection, 'Existing accounts without registration metadata can enable story processing in Settings')
  const processingCheckbox = flatten(processingSection).find(node => node?.type === 'input' && node.props.type === 'checkbox')
  assert.equal(processingCheckbox.props.checked, false)
  processingCheckbox.props.onChange({ target: { checked: true } }); await tick()
  assert.deepEqual(savedServiceChoices, [[true, false]], 'Existing accounts can grant AI processing without re-registering')
  const audioSection = nodes.find(node => node.props['aria-labelledby'] === 'cloud-audio-permission-heading')
  assert.ok(audioSection, 'Existing signed-in accounts can save audio permission in Settings')
  const audioCheckbox = flatten(audioSection).find(node => node?.type === 'input' && node.props.type === 'checkbox')
  assert.equal(audioCheckbox.props.checked, false)
  audioCheckbox.props.onChange({ target: { checked: true } }); await tick()
  assert.deepEqual(savedAudioChoices, [true])
  pagePermissions = { ...pagePermissions, managed: true, services: true }
  nodes = await render()
  assert.ok(nodes.some(node => node.props['aria-labelledby'] === 'share-consent-heading'),
    'Optional sharing consent remains manageable after enabling story processing')
  let current = { user: { id: 'reader-a', user_metadata: granted } }
  const authListeners = new Set()
  let finishInitial
  const authClient = { auth: {
    getSession: () => new Promise(resolve => { finishInitial = resolve }),
    onAuthStateChange(callback) { authListeners.add(callback); return { data: { subscription: { unsubscribe() { authListeners.delete(callback) } } } } },
    async updateUser({ data }) {
      current = { user: { ...current.user, user_metadata: data } }
      authListeners.forEach(callback => callback('USER_UPDATED', current))
      return { data: { user: current.user }, error: null }
    }
  } }
  const mountPermissions = () => runner('src/lib/useAccountPermissions.ts', 'useAccountPermissions', { './accountClient': { supabase: authClient } })
  const hook = mountPermissions()
  assert.equal(hook.render().ready, false)
  authListeners.forEach(callback => callback('SIGNED_IN', current))
  finishInitial({ data: { session: null }, error: null }); await tick()
  assert.equal(hook.render().services, true, 'A late initial session cannot overwrite authenticated permissions')
  assert.equal(hook.render().accountId, 'reader-a')
  authClient.auth.getSession = async () => ({ data: { session: current }, error: null })
  await hook.render().save(false, false)
  assert.equal(hook.render().services, false)
  hook.dispose()
  assert.equal(authListeners.size, 0)
  const remount = mountPermissions()
  remount.render(); await tick()
  assert.equal(remount.render().managed, true)
  assert.equal(remount.render().services, false, 'Revocation survives a remount')
  current = { user: { id: 'legacy-b', user_metadata: {} } }
  authListeners.forEach(callback => callback('SIGNED_IN', current))
  assert.equal(remount.render().managed, false, 'Account changes do not transfer a previous grant')
  assert.equal(remount.render().accountId, 'legacy-b')
  await remount.render().saveCloudAudio(true)
  assert.equal(remount.render().managed, false)
  assert.equal(remount.render().cloudAudio, true)
  assert.equal(remount.render().services, false, 'Saving audio leaves story AI permissions unchanged')
  await remount.render().saveCloudAudio(false)
  assert.equal(remount.render().cloudAudio, false)
  authClient.auth.updateUser = async () => {
    const formerUser = current.user
    current = { user: { id: 'different-account', user_metadata: {} } }
    authListeners.forEach(callback => callback('SIGNED_IN', current))
    return { data: { user: formerUser }, error: null }
  }
  await assert.rejects(() => remount.render().save(true, true), /account changed/)
  assert.equal(remount.render().accountId, 'different-account')
  assert.equal(remount.render().services, false)
  remount.dispose()
  const jsxMocks = { 'react/jsx-runtime': { jsx, jsxs: jsx }, 'next/link': { default: 'Link' },
    '../lib/interfaceLanguage': { useInterfaceLanguage: () => 'it-IT', interfaceText: key => key } }
  let componentPermissions = { managed: true, ready: true, services: true, accountId: 'managed-reader' }
  const consentChanges = []
  const consent = runner('src/components/ExplicitConsent.tsx', 'default', {
    ...jsxMocks, '../lib/useAccountPermissions': { useAccountPermissions: () => componentPermissions }
  }, { checked: false, onChange(value) { consentChanges.push(value) }, children: 'No repeated checkbox' })
  assert.equal(consent.render(), null)
  assert.deepEqual(consentChanges, [], 'Saved grants never write into a legacy checkbox')
  componentPermissions.services = false
  assert.ok(flatten(consent.render()).some(node => node?.props?.href === '/account'))
  assert.ok(!flatten(consent.render()).some(node => node?.props?.type === 'checkbox'))
  componentPermissions = { managed: false, ready: true, accountId: 'legacy-reader' }
  assert.ok(flatten(consent.render()).some(node => node?.props?.type === 'checkbox'), 'Legacy consent is unchanged')
  assert.deepEqual(consentChanges, [false], 'Switching accounts resets feature consent instead of transferring it')
  consent.dispose()
  const accountRequired = runner('src/components/ExplicitConsent.tsx', 'default', {
    ...jsxMocks, '../lib/useAccountPermissions': { useAccountPermissions: () => componentPermissions }
  }, { checked: false, onChange() {}, requireAccount: true, children: 'Account-level AI permission' })
  assert.ok(flatten(accountRequired.render()).some(node => node?.props?.href === '/account'))
  assert.ok(!flatten(accountRequired.render()).some(node => node?.props?.type === 'checkbox'),
    'Signed-in legacy accounts are directed to Settings instead of receiving per-story consent')
  componentPermissions = { managed: false, ready: true }
  assert.ok(flatten(accountRequired.render()).some(node => node?.props?.href === '/account'))
  assert.ok(!flatten(accountRequired.render()).some(node => node?.props?.type === 'checkbox'),
    'Guests are directed to registration instead of receiving per-story consent')
  accountRequired.dispose()
  componentPermissions = { managed: false, ready: true, accountId: 'legacy-reader' }
  const audioProps = { scope: 'cloudAudio', checked: false, onChange() {}, children: 'Cloud audio' }
  const audioComponent = runner('src/components/ExplicitConsent.tsx', 'default', {
    ...jsxMocks, '../lib/useAccountPermissions': { useAccountPermissions: () => componentPermissions }
  }, audioProps)
  assert.ok(flatten(audioComponent.render()).some(node => node?.props?.href === '/account'))
  assert.ok(!flatten(audioComponent.render()).some(node => node?.props?.type === 'checkbox'), 'Existing account audio opt-in lives only in Settings')
  componentPermissions.cloudAudio = true
  assert.equal(audioComponent.render(), null)
  componentPermissions.cloudAudio = false
  assert.ok(flatten(audioComponent.render()).some(node => node?.props?.href === '/account'))
  audioComponent.dispose()
  let bills = 0, serverPermissions = revoked
  const endpoint = load('src/pages/api/personal-story.ts', {
    '../../lib/accountAuth': { requireAccount: async () => ({ id: 'reader-a', permissions: serverPermissions }) },
    '../../lib/sharedStory': { SharedStoryError }, '../../lib/providerConsent': provider,
    '../../lib/operations': { apiSafety: async () => true, reportOperation: async () => {} },
    '../../lib/storyProvider': { storyProviderConfig() {} },
    '../../lib/billing': { reserveBillingUsage: async () => { bills++ } },
    '../../lib/storyRequestLimits': { reserveStoryRequest: async () => {}, storyDatabase: () => ({}) },
    '../../lib/sharedAdventure': { adventureGlobalCap: () => 20 },
    '../../lib/personalStoryShare': {}, '../../lib/personalJourney': {},
    '../../lib/personalStoryGenerator': {
      parsePersonalStoryRequest(body) { romance.requireRomanceConfirmation(body.romance, body.romanceConfirmed); return body },
      generatePersonalStory: async () => ({ title: 'Mocked story' })
    }
  }).default
  const response = () => ({ code: 0, body: null, setHeader() {}, status(code) { this.code = code; return this }, json(body) { this.body = body; return this } })
  let syntheses = 0
  const tts = load('src/pages/api/tts.ts', {
    '../../lib/accountAuth': { requireAccount: async () => ({ id: 'reader-a', permissions: serverPermissions }) },
    '../../lib/providerConsent': provider, '../../lib/sharedStory': { SharedStoryError },
    '../../lib/operations': { apiSafety: async () => true, reserveAiAttempt: async () => {}, reportOperation: async () => {} },
    '../../lib/googleNarration': { synthesizeGoogleNarration: async () => { syntheses++; return new Uint8Array([1, 2]) } }
  }).default
  const previousProvider = process.env.NEXT_PUBLIC_NARRATION_PROVIDER
  process.env.NEXT_PUBLIC_NARRATION_PROVIDER = 'google'
  try {
    serverPermissions = audioRevoked
    const deniedAudio = response()
    await tts({ method: 'POST', body: { text: 'Hello', consentVersion: provider.PROVIDER_CONSENT_VERSION } }, deniedAudio)
    assert.equal(deniedAudio.code, 403)
    assert.equal(syntheses, 0, 'Revoked saved audio permission blocks synthesis before paid use')
    serverPermissions = audioGranted
    const allowedAudio = { ...response(), send(body) { this.body = body; return this } }
    await tts({ method: 'POST', body: { text: 'Hello' } }, allowedAudio)
    assert.equal(allowedAudio.code, 200)
    assert.equal(syntheses, 1, 'Saved legacy audio consent needs no repeated body consent')
  } finally {
    if (previousProvider === undefined) delete process.env.NEXT_PUBLIC_NARRATION_PROVIDER
    else process.env.NEXT_PUBLIC_NARRATION_PROVIDER = previousProvider
    serverPermissions = revoked
  }
  const deniedResponse = response()
  await endpoint({ method: 'POST', headers: {}, body: { action: 'create', consentVersion: provider.PROVIDER_CONSENT_VERSION } }, deniedResponse)
  assert.equal(deniedResponse.code, 403)
  assert.equal(bills, 0, 'Revoked services are denied before billing')
  serverPermissions = permissions.accountPermissions({})
  const legacyAccountResponse = response()
  await endpoint({ method: 'POST', headers: {}, body: { action: 'create', consentVersion: provider.PROVIDER_CONSENT_VERSION } }, legacyAccountResponse)
  assert.equal(legacyAccountResponse.code, 403, 'A story-level checkbox cannot bypass missing account consent')
  assert.equal(bills, 0, 'Unmanaged accounts are denied before billing')
  serverPermissions = active
  const grantedResponse = response()
  await endpoint({ method: 'POST', headers: {}, body: { action: 'create', romance: 'sweet' } }, grantedResponse)
  assert.equal(grantedResponse.code, 200, 'Managed accounts need no repeat provider or romance body checkbox')
  assert.equal(bills, 1)
  console.log('PASS new-registration opt-in, optional adult permission, legacy behavior, revocation, versions and all seven translations')
  console.log('PASS permission remount/auth isolation, stale sessions, Settings revocation, compact consent UI and server-before-billing gating')
}
main().catch(error => { console.error(error); process.exitCode = 1 })

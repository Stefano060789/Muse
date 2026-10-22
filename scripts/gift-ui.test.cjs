const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
function source(relative) {
  return ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  }).outputText
}
function plainModule(relative) {
  const result = { exports: {} }
  new Function('module', 'exports', 'require', source(relative))(result, result.exports, id => id.startsWith('.') ? plainModule(path.join(path.dirname(relative), id + '.ts')) : require(id))
  return result.exports
}
const gifts = plainModule('src/lib/storyGift.ts')
const language = plainModule('src/lib/storyLanguage.ts')
const romance = plainModule('src/lib/storyRomance.ts')
function flatten(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return []
  if (Array.isArray(node)) return node.flatMap(flatten)
  if (typeof node !== 'object') return [node]
  return [node, ...flatten(node.props?.children)]
}
function label(node) { return flatten(node.props?.children).filter(value => typeof value === 'string' || typeof value === 'number').join('') }
async function mount(hash, player = null, owner = null, failures = {}, values = new Map()) {
  let cursor = 0, tree, requestCount = 0
  const slots = [], pending = [], requests = [], timers = [], timerDelays = [], activeTimers = new Set()
  const listeners = new Map()
  const jsx = (type, props) => ({ type, props: props || {} })
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value }]
    },
    useRef(initial) { const index = cursor++; return slots[index] ||= { current: initial } },
    useCallback(callback) { cursor++; return callback },
    useEffect(effect, deps) {
      const index = cursor++, previous = slots[index]
      if (!previous || !deps || deps.some((value, i) => value !== previous.deps?.[i])) pending.push(() => {
        previous?.cleanup?.()
        slots[index].cleanup = effect()
      })
      slots[index] = { deps, cleanup: previous?.cleanup }
    }
  }
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
  const browser = {
    location: { origin: 'https://muse.example', search: '', hash }, localStorage: storage,
    crypto: require('node:crypto').webcrypto,
    addEventListener(name, listener) { listeners.set(name, listener) },
    removeEventListener(name, listener) { if (listeners.get(name) === listener) listeners.delete(name) },
    history: { replaceState(_a, _b, url) { browser.location.hash = url.includes('#') ? '#' + url.split('#')[1] : '' } },
    setTimeout(callback, delay) {
      const id = timers.length + 1
      timers.push(() => { activeTimers.delete(id); callback() })
      timerDelays.push(delay)
      activeTimers.add(id)
      return id
    },
    clearTimeout(id) { activeTimers.delete(id) }, scrollTo() {}, confirm() { return true }
  }
  let narrationStops = 0
  const narrator = { stop() { narrationStops++ }, error: '', preferences: {} }
  let dictationLanguage
  const customRequire = id => {
    if (id === 'react') return react
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' }
    if (id === 'next/head' || id === 'next/link' || id.startsWith('../components/')) return { __esModule: true, default: id }
    if (id.endsWith('/storyGift')) return {
      ...gifts, loadGiftDraft: () => gifts.loadGiftDraft(storage),
      saveGiftDraft: draft => gifts.saveGiftDraft(draft, storage), removeGiftDraft: () => gifts.removeGiftDraft(storage)
    }
    if (id.endsWith('/browserDrafts')) return {
      readDraft(key, validate) {
        const raw = storage.getItem(key)
        if (raw === null) return null
        let value
        try { value = JSON.parse(raw) } catch { throw new Error('A saved draft could not be read. It has not been overwritten.') }
        if (!validate(value)) throw new Error('A saved draft has an unsupported format. It has not been overwritten.')
        return value
      },
      writeDraft(key, value) { storage.setItem(key, JSON.stringify(value)) },
      removeDraft(key) { storage.removeItem(key) }
    }
    if (id.endsWith('/storyPreferences')) return {
      loadStoryPreferences() {
        const raw = storage.getItem('muse-preferences')
        if (raw === null) return { language: 'en-US', duration: 10 }
        const value = JSON.parse(raw)
        if (!language.STORY_LANGUAGES.some(option => option.code === value?.language) ||
            ![5, 10, 15, 20].includes(value?.duration)) throw new Error('Saved story settings are invalid.')
        return value
      },
      saveStoryPreferences(value) {
        if (!language.STORY_LANGUAGES.some(option => option.code === value.language) ||
            ![5, 10, 15, 20].includes(value.duration)) throw new Error('Choose a supported language and story duration.')
        storage.setItem('muse-preferences', JSON.stringify(value))
      }
    }
    if (id.endsWith('/sharedStory')) return { SHARED_STORY_DURATIONS: [5, 10, 15, 20] }
    if (id.endsWith('/storyLanguage')) return plainModule('src/lib/storyLanguage.ts')
    if (id.endsWith('/storyRomance')) return romance
    if (id.endsWith('/storyRetention')) return plainModule('src/lib/storyRetention.ts')
    if (id.endsWith('/sharedStorySharing')) return { recipientShareDetails: () => null, sharedStoryPreviewText: () => 'Public scenes only' }
    if (id.endsWith('/storyLibrary')) return { loadStoryLibrary: () => ({ library: { entries: [] }, error: null }), latestCreatorStory: () => null, saveLibraryCreatorStory() {} }
    if (id.endsWith('/useStoryInteraction')) return { useStoryInteraction: (_before, language) => {
      dictationLanguage = language
      return { stopRecording() {}, cancelRecording() {}, recordingTarget: null, error: '' }
    } }
    if (id.endsWith('/useNarration')) return { useNarration: () => narrator }
    if (id.endsWith('/legalContact')) return { hasExplicitConsent: value => value === true, MUSE_AI_CONSENT_VERSION: 'test' }
    if (id.endsWith('/sharedStoryMedia')) return { formatMediaSize: () => '5 MB', SHARED_MEDIA_ATTEMPTS_PER_STORY: 6, validateVoiceBytes: () => ({ durationSeconds: 1 }) }
    if (id.endsWith('/sharedStoryGift')) return { validateVoiceBytes: () => ({ durationSeconds: 1 }) }
    throw new Error('Unexpected UI dependency ' + id)
  }
  const fetchMock = async (_url, options) => {
    const request = JSON.parse(options.body)
    requests.push(request)
    if (request.action === 'open' && player?.romance && request.romanceConfirmed !== true) {
      return { ok: true, json: async () => ({ romanceNotice: { romance: player.romance, language: player.language } }) }
    }
    if (request.action === 'open' && failures.invalidSavedSession && failures.invalidSavedSession === request.sessionToken) {
      return { ok: false, json: async () => ({ error: 'Player session is invalid. Reopen the story link.' }) }
    }
    if (request.action === 'open' && failures.open) return { ok: false, json: async () => ({ error: 'Progress temporarily unavailable' }) }
    if (request.action === 'studio-status' || request.action === 'studio-generate') return { ok: true, json: async () => ({ studio: {
      available: true, reason: null, scenes: request.action === 'studio-generate' ? [{ sceneIndex: request.sceneIndex, status: 'ready' }] : []
    } }) }
    if (request.action === 'studio-audio') return { ok: true, blob: async () => new Blob(['synthetic audio'], { type: 'audio/mpeg' }) }
    if (request.action === 'reply') {
      requestCount++
      return { ok: requestCount > 1, json: async () => requestCount > 1 ? { sent: true } : { error: 'Test reply failure' } }
    }
    if (request.action === 'manage') return { ok: true, json: async () => ({ ...owner, voice: { mime: 'audio/wav', size: 32044 }, replies: [{ message: 'A voluntary thanks', createdAt: '2026-10-15T00:00:00.000Z' }], media: null }) }
    if (request.action === 'progress') return { ok: true, json: async () => ({ progress: { opened: 2, inProgress: 1, solved: 1, skipped: 0, furthestScene: 0 } }) }
    if (request.action === 'voice-start') return { ok: true, json: async () => ({ uploadId: 'test-upload', upload: { method: 'PUT', url: '/api/upload', headers: {} } }) }
    if (request.action === 'voice-finish') return { ok: true, json: async () => ({ voice: { mime: 'audio/wav', size: 32044 } }) }
    return { ok: true, json: async () => ({ player, sessionToken: 'c'.repeat(64) }) }
  }
  const result = { exports: {} }
  class UploadRequest {
    constructor() { this.upload = {}; this.status = 200 }
    open() {}
    setRequestHeader() {}
    send() { this.onload() }
  }
  new Function('module', 'exports', 'require', 'window', 'navigator', 'fetch', 'process', 'XMLHttpRequest', source('src/pages/shared.tsx'))(
    result, result.exports, customRequire, browser, {}, fetchMock, { env: { NEXT_PUBLIC_MUSE_CREATOR_LOCKED: 'false' } }, UploadRequest
  )
  const render = () => { cursor = 0; tree = result.exports.default(); return tree }
  const flush = async () => {
    for (let i = 0; i < 4; i++) {
      render()
      const effects = pending.splice(0)
      for (const effect of effects) effect()
      await new Promise(resolve => setImmediate(resolve))
    }
    render()
  }
  const nodes = () => flatten(tree).filter(value => value && typeof value === 'object')
  const button = text => { const node = nodes().find(node => node.type === 'button' && label(node) === text); assert.ok(node, 'Missing button: ' + text); return node }
  const field = id => { const node = nodes().find(node => node.props.id === id); assert.ok(node, 'Missing field: ' + id); return node }
  const click = async text => { button(text).props.onClick(); await flush() }
  await flush()
  return { flush, render, nodes, button, field, click, values, timers, timerDelays, activeTimers, requests, browser,
    dispatch(name) { listeners.get(name)?.() },
    dictationLanguage: () => dictationLanguage, narrationStops: () => narrationStops,
    unmount: () => slots.forEach(slot => slot?.cleanup?.()) }
}
async function main() {
  const preferenceValues = new Map([['muse-preferences', JSON.stringify({ language: 'es-ES', duration: 15 })]])
  const preferenceCreator = await mount('#new', null, null, {}, preferenceValues)
  assert.equal(preferenceCreator.field('shared-language').props.value, 'es-ES')
  assert.equal(preferenceCreator.nodes().some(node => node.type === 'select' && node.props.value === 15), true)
  assert.equal(preferenceCreator.nodes().find(node => node.type === '../components/ExplicitConsent').props.checked, false)
  assert.equal(preferenceCreator.requests.some(request => request.action === 'create'), false, 'Loading preferences never prepares a story')
  const consent = () => preferenceCreator.nodes().find(node => node.type === '../components/ExplicitConsent')
  consent().props.onChange(true)
  preferenceCreator.field('shared-language').props.onChange({ target: { value: 'ar-SA' } })
  await preferenceCreator.flush()
  const duration = preferenceCreator.nodes().find(node => node.type === 'select' && node.props.value === 15)
  duration.props.onChange({ target: { value: '20' } })
  await preferenceCreator.flush()
  assert.deepEqual(JSON.parse(preferenceValues.get('muse-preferences')), { language: 'ar-SA', duration: 20 })
  assert.equal(consent().props.checked, false, 'Changing remembered language or duration never preserves AI consent')
  console.log('PASS gift creation remembers validated language and duration without remembering consent')

  const refreshValues = new Map([['muse-preferences', JSON.stringify({ language: 'es-ES', duration: 15 })]])
  const beforeRefresh = await mount('#new', null, null, {}, refreshValues)
  beforeRefresh.field('brief-creatorName').props.onChange({ target: { value: 'Synthetic sender' } })
  let immediateDraft = gifts.loadGiftDraft(beforeRefresh.browser.localStorage)
  assert.equal(immediateDraft.brief.creatorName, 'Synthetic sender', 'Name edits persist synchronously, before render/effect/debounce')
  await beforeRefresh.flush()
  beforeRefresh.field('brief-recipientName').props.onChange({ target: { value: 'Synthetic recipient' } })
  immediateDraft = gifts.loadGiftDraft(beforeRefresh.browser.localStorage)
  assert.equal(immediateDraft.brief.creatorName, 'Synthetic sender')
  assert.equal(immediateDraft.brief.recipientName, 'Synthetic recipient', 'The latest name is in storage immediately')
  await beforeRefresh.flush()
  assert.equal(beforeRefresh.timers.some((_, index) => beforeRefresh.timerDelays[index] === 600), true, 'The longer coalescing save may still be pending')
  assert.equal(immediateDraft.brief.language, 'es-ES')
  assert.equal(immediateDraft.brief.durationMinutes, 15)
  const afterRefresh = await mount('#new', null, null, {}, refreshValues)
  await afterRefresh.click('Restore draft')
  assert.equal(afterRefresh.field('brief-creatorName').props.value, 'Synthetic sender')
  assert.equal(afterRefresh.field('brief-recipientName').props.value, 'Synthetic recipient')
  assert.equal(afterRefresh.field('shared-language').props.value, 'es-ES')
  assert.equal(afterRefresh.requests.some(request => request.action === 'create'), false, 'Reloading a draft never prepares a story')
  console.log('PASS immediate refresh of #new restores names saved synchronously before the debounce')

  const restoredValues = new Map([['muse-preferences', JSON.stringify({ language: 'zh-CN', duration: 15 })]])
  gifts.saveGiftDraft({
    version: 1,
    brief: {
      creatorName: 'Draft sender', recipientName: '', narration: 'Warm', setting: '', recipientHints: '',
      goal: '', solution: '', message: '', durationMinutes: 5, language: 'hi-IN',
      gift: { occasion: 'birthday', dedication: '', allowReply: false }
    },
    assistanceHintsText: '', alternativeAnswersText: '', savedAt: '2026-10-18T00:00:00.000Z'
  }, {
    getItem: key => restoredValues.get(key) ?? null,
    setItem: (key, value) => restoredValues.set(key, value),
    removeItem: key => restoredValues.delete(key)
  })
  const restoredCreator = await mount('#new', null, null, {}, restoredValues)
  restoredCreator.nodes().find(node => node.type === '../components/ExplicitConsent').props.onChange(true)
  await restoredCreator.click('Restore draft')
  assert.equal(restoredCreator.field('shared-language').props.value, 'hi-IN', 'Restored gift draft keeps its own language')
  assert.equal(restoredCreator.nodes().some(node => node.type === 'select' && node.props.value === 5), true, 'Restored gift draft keeps its own duration')
  assert.equal(restoredCreator.nodes().find(node => node.type === '../components/ExplicitConsent').props.checked, false,
    'Restoring gift writing always requires fresh consent')
  assert.deepEqual(JSON.parse(restoredValues.get('muse-preferences')), { language: 'zh-CN', duration: 15 },
    'Restoring an older draft does not overwrite the main preferences')
  assert.equal(restoredCreator.requests.some(request => request.action === 'create'), false, 'Restoring writing never prepares a story')
  console.log('PASS restoring gift writing does not restore consent or overwrite main preferences')

  const creator = await mount('#new')
  await creator.click('Birthday')
  creator.field('brief-creatorName').props.onChange({ target: { value: 'Sender' } })
  await creator.flush()
  const giftDraftRaw = () => creator.values.get(gifts.GIFT_DRAFT_KEY)
  creator.field('brief-recipientName').props.onChange({ target: { value: 'Recipient' } })
  await creator.flush()
  creator.timers.at(-1)()
  const saved = gifts.loadGiftDraft(creator.browser.localStorage)
  assert.equal(saved.brief.gift.occasion, 'birthday')
  assert.equal(saved.brief.language, 'en-US')
  for (const excluded of ['creatorCode', 'ownerToken', 'playToken', 'aiConsent', 'mediaUrl', 'voiceUrl']) {
    assert.equal(giftDraftRaw().includes(excluded), false, `Gift drafts do not store ${excluded}`)
  }
  creator.field('shared-language').props.onChange({ target: { value: 'ar-SA' } })
  await creator.flush()
  creator.timers.at(-1)()
  assert.equal(gifts.loadGiftDraft(creator.browser.localStorage).brief.language, 'ar-SA')
  creator.nodes().find(node => node.type === '../components/RomanceOptions').props.onChange('spicy')
  await creator.flush()
  creator.timers.at(-1)()
  assert.equal(gifts.loadGiftDraft(creator.browser.localStorage).brief.romance, 'spicy')
  assert.equal(gifts.loadGiftDraft(creator.browser.localStorage).brief.romanceConfirmed, undefined)
  assert.equal(saved.brief.creatorName, 'Sender')
  await creator.click('Continue')
  assert.ok(creator.nodes().some(node => label(node) === 'Step 2 of 3: Shape the story'))
  await creator.click('Continue')
  assert.equal(creator.nodes().filter(node => node.type === 'fieldset' && !node.props.hidden && !node.props['aria-label']).length, 1)
  const active = creator.nodes().find(node => node.type === 'fieldset' && !node.props.hidden && !node.props['aria-label'])
  const confirmationLabel = flatten(active).find(node => node?.type === 'label' && label(node).includes(romance.romanceCopy().creatorConfirmation))
  assert.ok(confirmationLabel, 'Creator acknowledgment is visible on the final step')
  flatten(confirmationLabel).find(node => node?.type === 'input').props.onChange({ target: { checked: true } })
  await creator.flush()
  creator.field('brief-creatorName').props.onChange({ target: { value: 'Edited sender' } })
  await creator.flush()
  const resetLabel = creator.nodes().find(node => node.type === 'label' && label(node).includes(romance.romanceCopy().creatorConfirmation))
  assert.equal(flatten(resetLabel).find(node => node?.type === 'input').props.checked, false, 'Story edits revoke creator acknowledgment')
  console.log('PASS three-step creator retains occasion and autosaves partial writing')
  const player = {
    title: 'A gift', description: 'A mystery', creatorName: 'Sender', recipientName: 'Recipient', durationMinutes: 5,
    scene: { title: 'One', body: 'A scene', clue: 'A clue' }, sceneIndex: 0, sceneCount: 1, discoveries: [],
    solved: true, skipped: false, canSkip: false, revealedHints: [], hintsRemaining: 0, message: 'A final message',
    gift: { occasion: 'birthday', dedication: 'A note', allowReply: true }
  }
  const recipient = await mount('#play=fixture', player)
  assert.equal(recipient.nodes().find(node => node.type === '../components/SiteNavigation').props.recipient, true, 'Recipient menu stays minimal')
  assert.ok(recipient.button(language.recipientCopy().openStory))
  assert.equal(recipient.nodes().some(node => node.props.id === 'gift-reply'), false)
  await recipient.click(language.recipientCopy().openStory)
  recipient.field('gift-reply').props.onChange({ target: { value: 'A private thanks' } })
  await recipient.flush()
  const submit = () => recipient.nodes().find(node => node.type === 'form').props.onSubmit({ preventDefault() {} })
  submit(); await recipient.flush()
  assert.equal(recipient.field('gift-reply').props.value, 'A private thanks')
  assert.ok(recipient.nodes().some(node => label(node) === 'Test reply failure'))
  submit(); await recipient.flush()
  assert.equal(recipient.requests.filter(request => request.action === 'reply').length, 2)
  assert.ok(recipient.button(language.recipientCopy().updateReply))
  assert.ok(!recipient.nodes().some(node => node.type === 'a' && node.props.href === '/shared?create=1#new'))
  const arabic = await mount('#play=arabic-fixture', { ...player, language: 'ar-SA' })
  assert.ok(arabic.nodes().some(node => node.type === 'section' && node.props.lang === 'ar-SA' && node.props.dir === 'rtl'))
  assert.ok(arabic.button(language.recipientCopy('ar-SA').openStory))
  assert.equal(arabic.dictationLanguage(), 'ar-SA', 'Recipient dictation follows the story language')
  console.log('PASS gift cover gates the player and private reply failures preserve text for retry')
  const romanticPlayer = { ...player, romance: 'spicy', language: 'ar-SA', title: 'PRIVATE_ROMANCE_TITLE', gift: { ...player.gift, dedication: 'PRIVATE_ROMANCE_DEDICATION' } }
  const gated = await mount('#play=romance-fixture', romanticPlayer)
  const romanceText = romance.romanceCopy('ar-SA')
  assert.equal(JSON.stringify(gated.nodes()).includes('PRIVATE_ROMANCE'), false)
  assert.equal(gated.requests.length, 1)
  assert.equal(gated.values.has('muse-shared-player:romance-fixture'), false, 'No session saved before consent')
  assert.equal(gated.button(romanceText.open).props.disabled, true)
  assert.equal(gated.nodes().some(node => node.type === '../components/NarrationControls'), false)
  assert.equal(gated.nodes().some(node => node.type === '../components/StudioNarration'), false)
  gated.nodes().find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: true } })
  await gated.flush()
  await gated.click(romanceText.open)
  assert.equal(gated.requests.at(-1).romanceConfirmed, true)
  assert.ok(gated.button(language.recipientCopy('ar-SA').openStory))
  const declined = await mount('#play=decline-fixture', romanticPlayer)
  await declined.click(romanceText.decline)
  assert.equal(declined.requests.length, 1)
  assert.equal(JSON.stringify(declined.nodes()).includes('PRIVATE_ROMANCE'), false)
  assert.ok(declined.nodes().some(node => node.props.role === 'status' && label(node) === romanceText.declined))
  const reopened = await mount('#play=romance-fixture', romanticPlayer)
  assert.equal(reopened.button(romanceText.open).props.disabled, true, 'Consent not restored on reopening')
  const expiredSession = 'd'.repeat(64)
  const savedPlayerSession = new Map([['muse-shared-player:resume-fixture', expiredSession]])
  const resumed = await mount('#play=resume-fixture', romanticPlayer, null, { invalidSavedSession: expiredSession }, savedPlayerSession)
  resumed.nodes().find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: true } })
  await resumed.flush()
  await resumed.click(romanceText.open)
  await resumed.flush()
  assert.deepEqual(resumed.requests.filter(request => request.action === 'open').map(request => request.sessionToken), [expiredSession, expiredSession, undefined])
  assert.equal(savedPlayerSession.get('muse-shared-player:resume-fixture'), 'c'.repeat(64), 'Recovered session is persisted for the next visit')
  assert.ok(resumed.nodes().some(node => node.props.role === 'status' && label(node).includes('earlier progress may not be available')))
  console.log('PASS romance gates even cover/narration, requires fresh explicit opt-in and declines without another request')
  const studioPlayer = await mount('#play=studio-fixture', { ...player, solved: false, romance: 'sweet' })
  studioPlayer.nodes().find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: true } })
  await studioPlayer.flush()
  await studioPlayer.click(romance.romanceCopy().open)
  await studioPlayer.click(language.recipientCopy().openStory)
  const recipientStudio = studioPlayer.nodes().find(node => node.type === '../components/StudioNarration')
  assert.ok(recipientStudio)
  assert.ok(!studioPlayer.nodes().some(node => node.props['aria-label'] === 'Story experience'), 'Story text stays visible without mode toggles')
  assert.ok(!studioPlayer.nodes().some(node => node.type === '../components/PageIllustration'), 'Recipient story has no decorative banner')
  const disclosure = studioPlayer.nodes().find(node => node.type === 'details' && label(node).startsWith('About this private story'))
  assert.ok(disclosure && !disclosure.props.open)
  const activeRecipient = await mount('#play=active-fixture', { ...player, solved: false, gift: undefined, language: 'en-US' })
  const guessInput = activeRecipient.nodes().find(node => node.type === 'input' && node.props.maxLength === 200)
  guessInput.props.onFocus()
  guessInput.props.onChange({ target: { value: 'An editable answer' } })
  await activeRecipient.flush()
  assert.ok(activeRecipient.nodes().some(node => node.type === 'input' && node.props.value === 'An editable answer'))
  const answerDrafts = [...activeRecipient.values].filter(([key]) => key.startsWith('muse-shared-recipient-draft:'))
  assert.equal(answerDrafts.length, 1)
  assert.match(answerDrafts[0][0], /:answer:0$/)
  assert.ok(!answerDrafts[0][0].includes('active-fixture'), 'Recipient capability is hashed rather than saved in the draft key')
  assert.deepEqual(JSON.parse(answerDrafts[0][1]), { revision: 0, text: 'An editable answer' })
  assert.ok(!answerDrafts[0][1].includes('c'.repeat(64)), 'Draft values contain no session token')
  const resumedRecipient = await mount('#play=active-fixture', { ...player, solved: false, gift: undefined }, null, {}, activeRecipient.values)
  assert.equal(resumedRecipient.nodes().find(node => node.type === 'input' && node.props.maxLength === 200).props.value, 'An editable answer',
    'Unsent recipient answers are restored for the same story and revision')
  const nextScene = await mount('#play=active-fixture', { ...player, solved: false, gift: undefined, sceneIndex: 1, sceneCount: 2 }, null, {}, activeRecipient.values)
  assert.equal(nextScene.nodes().find(node => node.type === 'input' && node.props.maxLength === 200).props.value, '',
    'Answers from earlier revisions are not restored into the next scene')
  assert.ok(!activeRecipient.nodes().some(node => node.type === '../components/MicrophoneCheck'), 'Recipient reading does not expose diagnostic tools')
  const hints = await mount('#play=hints-fixture', { ...player, solved: false, gift: undefined, hintsRemaining: 2 })
  assert.ok(hints.nodes().some(node => node.type === 'details' && !node.props.open &&
    flatten(node).some(child => child?.type === 'summary' && label(child) === language.recipientCopy().hintTitle)), 'Hints are optional and collapsed')
  const pendingPlayer = { ...player, gift: undefined, solved: false, adventure: {
    pending: true, actionsRemaining: 10, budgetRemaining: 20, budget: 30, revision: 0, choiceMode: 'free'
  } }
  const failures = {}
  const pendingAdventure = await mount('#play=pending-fixture', pendingPlayer, null, failures)
  assert.ok(!pendingAdventure.nodes().some(node => node.type === 'button' && label(node) === language.recipientCopy().refreshProgress))
  const paidBefore = pendingAdventure.requests.filter(request => request.action === 'adventure').length
  const stopsBefore = pendingAdventure.narrationStops()
  pendingAdventure.field('adventure-action').props.onChange({ target: { value: 'Keep my draft' } })
  await pendingAdventure.flush()
  const actionDraft = [...pendingAdventure.values].find(([key]) => key.startsWith('muse-shared-recipient-draft:') && key.endsWith(':action:0'))
  assert.ok(actionDraft, 'Freeform recipient actions use a separate story/revision draft key')
  assert.deepEqual(JSON.parse(actionDraft[1]), { revision: 0, text: 'Keep my draft' })
  assert.ok(!actionDraft[0].includes('pending-fixture'))
  assert.ok(!actionDraft[1].includes('c'.repeat(64)))
  const resumedAction = await mount('#play=pending-fixture', { ...pendingPlayer, adventure: { ...pendingPlayer.adventure } }, null, {}, pendingAdventure.values)
  assert.equal(resumedAction.field('adventure-action').props.value, 'Keep my draft',
    'Unsent freeform actions restore only for their story and revision')
  assert.equal(pendingAdventure.timerDelays.at(-1), 3000)
  failures.open = true
  pendingAdventure.timers.at(-1)()
  await pendingAdventure.flush()
  assert.equal(pendingAdventure.timerDelays.at(-1), 15000, 'Failed progress checks use a slower automatic retry')
  assert.ok(pendingAdventure.nodes().some(node => label(node) === 'Progress temporarily unavailable'))
  failures.open = false
  pendingPlayer.adventure.pending = false
  pendingAdventure.timers.at(-1)()
  await pendingAdventure.flush()
  assert.equal(pendingAdventure.requests.at(-1).action, 'open', 'Pending turns refresh automatically with a read-only request')
  assert.equal(pendingAdventure.requests.filter(request => request.action === 'adventure').length, paidBefore, 'Automatic checks never generate a paid turn')
  assert.equal(pendingAdventure.field('adventure-action').props.value, 'Keep my draft', 'Progress checks preserve typed drafts')
  assert.equal(pendingAdventure.narrationStops(), stopsBefore, 'Progress checks do not explicitly stop narration')
  assert.equal(pendingAdventure.activeTimers.size, 0, 'Settled turns stop polling')
  const unmountedAdventure = await mount('#play=unmount-fixture', { ...pendingPlayer, adventure: { ...pendingPlayer.adventure, pending: true } })
  assert.equal(unmountedAdventure.activeTimers.size, 1)
  unmountedAdventure.unmount()
  assert.equal(unmountedAdventure.activeTimers.size, 0, 'Leaving the story cancels pending progress checks')
  assert.equal(recipientStudio.props.generate, undefined)
  assert.equal(recipientStudio.props.check, undefined)
  const audio = await recipientStudio.props.load(0, new AbortController().signal)
  assert.equal(audio.type, 'audio/mpeg')
  assert.deepEqual(studioPlayer.requests.at(-1), { action: 'studio-audio', token: 'studio-fixture', sessionToken: 'c'.repeat(64), sceneIndex: 0, romanceConfirmed: true })
  console.log('PASS recipient Studio is gated behind fresh romance acceptance and cover, loads bytes with session, never exposes generation')
  const owner = await mount('#manage=fixture', null, {
    brief: { creatorName: 'Sender', recipientName: 'Recipient', message: 'The surprise', solution: 'A secret', gift: player.gift, durationMinutes: 5 },
    content: { title: 'A gift', description: 'A mystery', scenes: [player.scene] }, expiresAt: null
  })
  assert.ok(owner.nodes().some(node => node.props['aria-label'] === 'Private management link'), 'Management access is independent of pre-send checks')
  const tools = owner.nodes().find(node => node.props['aria-label'] === 'Sender tools')
  assert.ok(tools && !tools.props.open, 'Sharing and management stay in a collapsed sender panel')
  assert.ok(flatten(tools).some(node => node?.type === '../components/PreSendCheck'), 'Sharing safeguards stay available')
  assert.ok(!owner.nodes().some(node => node.type === 'button' && ['Create new story', 'Reuse this brief'].includes(label(node))))
  const sceneArticle = owner.nodes().find(node => node.props['aria-label'] === 'Story scene 1')
  assert.ok(sceneArticle && !flatten(tools).includes(sceneArticle), 'The story is visible outside sender tools')
  const ownerStudio = owner.nodes().find(node => node.type === '../components/StudioNarration')
  assert.ok(ownerStudio)
  assert.deepEqual(await ownerStudio.props.check(0, new AbortController().signal), { enabled: true, ready: false, blocked: false })
  assert.equal((await ownerStudio.props.generate(0, new AbortController().signal)).ready, true)
  assert.deepEqual(owner.requests.at(-1), { action: 'studio-generate', token: 'fixture', sceneIndex: 0, consentVersion: 'test' })
  await ownerStudio.props.load(0, new AbortController().signal)
  assert.deepEqual(owner.requests.at(-1), { action: 'studio-audio', token: 'fixture', preview: true, sceneIndex: 0 })
  const rotateLabel = 'Replace recipient link (invalidates the previous one)'
  assert.equal(owner.nodes().some(node => node.type === 'button' && label(node) === rotateLabel), false)
  const check = owner.nodes().find(node => node.type === '../components/PreSendCheck')
  check.props.onReady(true); await owner.flush()
  assert.ok(owner.button(rotateLabel))
  const voiceComponent = owner.nodes().find(node => node.type === '../components/GiftVoiceRecorder')
  assert.ok(voiceComponent)
  voiceComponent.props.onChange(new File([new Uint8Array(32044)], 'test.wav', { type: 'audio/wav' }))
  await owner.flush()
  assert.equal(owner.nodes().some(node => node.type === 'button' && label(node) === rotateLabel), false, 'Pending replacement immediately closes recipient sharing')
  await owner.click('Upload replacement recording')
  assert.deepEqual(owner.requests.filter(request => request.action.startsWith('voice-')).map(request => request.action), ['voice-start', 'voice-finish'])
  const initialRequests = owner.requests.length
  await owner.flush()
  assert.equal(owner.requests.length, initialRequests, 'No background reply polling')
  const progressPanel = owner.nodes().find(node => node.type === '../components/GiftProgress')
  assert.ok(progressPanel)
  const progress = await progressPanel.props.load()
  assert.deepEqual(progress, { opened: 2, inProgress: 1, solved: 1, skipped: 0, furthestScene: 0 })
  assert.deepEqual(owner.requests.at(-1), { action: 'progress', token: 'fixture' })
  await owner.click('Refresh replies')
  assert.ok(owner.nodes().some(node => label(node) === 'A voluntary thanks'))
  console.log('PASS owner recording upload and manual-only private replies are wired')
  owner.nodes().find(node => node.type === '../components/SiteNavigation').props.onCreateGift()
  await owner.flush()
  assert.equal(owner.browser.location.hash, '#new')
  assert.equal(owner.nodes().some(node => node.type === '../components/StudioNarration'), false, 'Create a gift leaves management and starts a draft')
  assert.equal(owner.field('brief-creatorName').props.value, '', 'New gift does not copy private sender fields')
  console.log('PASS Create a gift menu starts a blank gift from management')
}
main().catch(error => { console.error(error); process.exitCode = 1 })

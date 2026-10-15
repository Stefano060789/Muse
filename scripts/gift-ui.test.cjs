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
async function mount(hash, player = null, owner = null) {
  let cursor = 0, tree, requestCount = 0
  const slots = [], pending = [], requests = [], values = new Map(), timers = []
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
      if (!previous || !deps || deps.some((value, i) => value !== previous[i])) pending.push(effect)
      slots[index] = deps
    }
  }
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
  const browser = {
    location: { origin: 'https://muse.example', search: '', hash }, localStorage: storage,
    history: { replaceState(_a, _b, url) { browser.location.hash = url.includes('#') ? '#' + url.split('#')[1] : '' } },
    setTimeout(callback) { timers.push(callback); return timers.length }, clearTimeout() {}, scrollTo() {}, confirm() { return true }
  }
  const narrator = { stop() {}, error: '', preferences: {} }
  const customRequire = id => {
    if (id === 'react') return react
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' }
    if (id === 'next/head' || id === 'next/link' || id.startsWith('../components/')) return { __esModule: true, default: id }
    if (id.endsWith('/storyGift')) return {
      ...gifts, loadGiftDraft: () => gifts.loadGiftDraft(storage),
      saveGiftDraft: draft => gifts.saveGiftDraft(draft, storage), removeGiftDraft: () => gifts.removeGiftDraft(storage)
    }
    if (id.endsWith('/sharedStory')) return { SHARED_STORY_DURATIONS: [5, 10, 15, 20] }
    if (id.endsWith('/storyLanguage')) return plainModule('src/lib/storyLanguage.ts')
    if (id.endsWith('/storyRomance')) return romance
    if (id.endsWith('/sharedStorySharing')) return { recipientShareDetails: () => null, sharedStoryPreviewText: () => 'Public scenes only' }
    if (id.endsWith('/storyLibrary')) return { loadStoryLibrary: () => ({ library: { entries: [] }, error: null }), latestCreatorStory: () => null, saveLibraryCreatorStory() {} }
    if (id.endsWith('/useStoryInteraction')) return { useStoryInteraction: () => ({ stopRecording() {}, recordingTarget: null, error: '' }) }
    if (id.endsWith('/useNarration')) return { useNarration: () => narrator }
    if (id.endsWith('/legalContact')) return { hasExplicitConsent: value => value === true, MUSE_AI_CONSENT_VERSION: 'test' }
    if (id.endsWith('/sharedStoryMedia')) return { formatMediaSize: () => '5 MB', SHARED_MEDIA_ATTEMPTS_PER_STORY: 6, validateVoiceBytes: () => ({ durationSeconds: 1 }) }
    if (id.endsWith('/sharedStoryGift')) return { validateVoiceBytes: () => ({ durationSeconds: 1 }) }
    throw new Error('Unexpected UI dependency ' + id)
  }
  const fetchMock = async (_url, options) => {
    const request = JSON.parse(options.body)
    requests.push(request)
    if (request.action === 'reply') {
      requestCount++
      return { ok: requestCount > 1, json: async () => requestCount > 1 ? { sent: true } : { error: 'Test reply failure' } }
    }
    if (request.action === 'manage') return { ok: true, json: async () => ({ ...owner, voice: { mime: 'audio/wav', size: 32044 }, replies: [{ message: 'A voluntary thanks', createdAt: '2026-10-15T00:00:00.000Z' }], media: null }) }
    if (request.action === 'voice-start') return { ok: true, json: async () => ({ uploadId: 'test-upload', upload: { method: 'PUT', url: '/api/upload', headers: {} } }) }
    if (request.action === 'voice-finish') return { ok: true, json: async () => ({ voice: { mime: 'audio/wav', size: 32044 } }) }
    if (request.action === 'open' && player?.romance && request.romanceConfirmed !== true) {
      return { ok: true, json: async () => ({ romanceNotice: { romance: player.romance, language: player.language } }) }
    }
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
  return { flush, render, nodes, button, field, click, values, timers, requests, browser }
}
async function main() {
  const creator = await mount('#new')
  await creator.click('Birthday')
  creator.field('brief-creatorName').props.onChange({ target: { value: 'Sender' } })
  await creator.flush()
  creator.field('brief-recipientName').props.onChange({ target: { value: 'Recipient' } })
  await creator.flush()
  creator.timers.at(-1)()
  const saved = gifts.loadGiftDraft(creator.browser.localStorage)
  assert.equal(saved.brief.gift.occasion, 'birthday')
  assert.equal(saved.brief.language, 'en-US')
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
  assert.equal(creator.nodes().filter(node => node.type === 'fieldset' && !node.props.hidden).length, 1)
  const active = creator.nodes().find(node => node.type === 'fieldset' && !node.props.hidden)
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
  assert.ok(recipient.nodes().some(node => node.type === 'a' && node.props.href === '/shared?create=1#new'))
  const arabic = await mount('#play=arabic-fixture', { ...player, language: 'ar-SA' })
  assert.ok(arabic.nodes().some(node => node.type === 'section' && node.props.lang === 'ar-SA' && node.props.dir === 'rtl'))
  assert.ok(arabic.button(language.recipientCopy('ar-SA').openStory))
  console.log('PASS gift cover gates the player and private reply failures preserve text for retry')
  const romanticPlayer = { ...player, romance: 'spicy', language: 'ar-SA', title: 'PRIVATE_ROMANCE_TITLE', gift: { ...player.gift, dedication: 'PRIVATE_ROMANCE_DEDICATION' } }
  const gated = await mount('#play=romance-fixture', romanticPlayer)
  const romanceText = romance.romanceCopy('ar-SA')
  assert.equal(JSON.stringify(gated.nodes()).includes('PRIVATE_ROMANCE'), false)
  assert.equal(gated.requests.length, 1)
  assert.equal(gated.values.has('muse-shared-player:romance-fixture'), false, 'No session saved before consent')
  assert.equal(gated.button(romanceText.open).props.disabled, true)
  assert.equal(gated.nodes().some(node => node.type === '../components/NarrationControls'), false)
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
  console.log('PASS romance gates even cover/narration, requires fresh explicit opt-in and declines without another request')
  const owner = await mount('#manage=fixture', null, {
    brief: { creatorName: 'Sender', recipientName: 'Recipient', message: 'The surprise', solution: 'A secret', gift: player.gift, durationMinutes: 5 },
    content: { title: 'A gift', description: 'A mystery', scenes: [player.scene] }, expiresAt: '2099-11-15T00:00:00.000Z'
  })
  assert.ok(owner.nodes().some(node => node.props['aria-label'] === 'Private management link'), 'Management access is independent of pre-send checks')
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
  await owner.click('Refresh replies')
  assert.ok(owner.nodes().some(node => label(node) === 'A voluntary thanks'))
  console.log('PASS owner recording upload and manual-only private replies are wired')
}
main().catch(error => { console.error(error); process.exitCode = 1 })

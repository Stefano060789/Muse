const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const consentVersion = plain('src/lib/legalContact.ts').MUSE_AI_CONSENT_VERSION
function compile(file) {
  return ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  }).outputText
}
function plain(file, browser) {
  const module = { exports: {} }
  new Function('module', 'exports', 'require', 'window', compile(file))(module, module.exports, id => id.startsWith('.') ? plain(path.join(path.dirname(file), id + '.ts'), browser) : require(id), browser)
  return module.exports
}
function flatten(node) {
  if (node == null || typeof node === 'boolean') return []
  if (Array.isArray(node)) return node.flatMap(flatten)
  return typeof node === 'object' ? [node, ...flatten(node.props?.children)] : [node]
}
const label = node => flatten(node.props?.children).filter(value => ['string', 'number'].includes(typeof value)).join('')
async function main() {
  let cursor = 0, tree
  const slots = [], effects = [], requests = [], storage = new Map()
  const timers = new Map()
  let nextTimer = 0
  let loadedStory = null
  let interactionRecordingTarget = ''
  let stopRecordingCalls = 0, dictateCalls = 0
  let profile = null
  let selectedDictationLanguage
  let transcriptReceiver
  let respondSuccessfully = false
  let confirmDeletion = true, deletionSuccess = false, removalFails = false
  const removals = []
  let responseGate
  let accountRequest
  let chapterResponse
  let failureStatus = 503, failureSnapshot
  const browserEvents = new Map()
  let interfaceLocale = 'en-US'
  let cloudProvider = 'browser', cloudConsent = false
  let narrationStops = 0
  const narrationCalls = []
  const react = {
    useState(initial) {
      const i = cursor++
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value }]
    },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } },
    useMemo(fn) { cursor++; return fn() },
    useEffect(fn, deps) {
      const i = cursor++, previous = slots[i]
      if (!previous || deps.some((value, index) => value !== previous.deps[index])) {
        effects.push(() => {
          previous?.cleanup?.()
          const next = { deps, cleanup: fn() }
          slots[i] = next
        })
      }
      if (!previous) slots[i] = { deps }
    }
  }
  const jsx = (type, props) => ({ type, props: props || {} })
  const module = { exports: {} }
  const mockRequire = id => {
    if (id === 'react') return react
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' }
    if (id === 'next/head' || id === 'next/link' || id.startsWith('../components/')) return { __esModule: true, default: id }
    if (id.endsWith('/accountClient')) return { accountFetch: (...args) => accountRequest(...args) }
    if (id.endsWith('/story')) return { loadPersonalStory: () => loadedStory, savePersonalStory() {} }
    if (id.endsWith('/profile')) return {
      loadMuseProfile: () => profile,
      saveMuseProfile: about => { profile = { about, keypoints: [about] }; return profile }
    }
    if (id.endsWith('/storyLibrary')) return { removeLibraryEntry(kind, id) {
      if (removalFails) throw new Error('Browser storage unavailable')
      removals.push({ kind, id })
    } }
    if (id.endsWith('/storyLanguage')) return plain('src/lib/storyLanguage.ts')
    if (id.endsWith('/interfacePages')) return plain('src/lib/interfacePages.ts')
    if (id.endsWith('/interfaceFlow')) return plain('src/lib/interfaceFlow.ts')
    if (id.endsWith('/journeyLimits')) return plain('src/lib/journeyLimits.ts')
    if (id.endsWith('/chapterRecoveryCopy')) return plain('src/lib/chapterRecoveryCopy.ts')
    if (id.endsWith('/interfaceLanguage')) return { useInterfaceLanguage: () => interfaceLocale, interfaceText: () => 'Settings' }
    if (id.endsWith('/browserDrafts')) return plain('src/lib/browserDrafts.ts', browser)
    if (id.endsWith('/storyPreferences')) return plain('src/lib/storyPreferences.ts', browser)
    if (id.endsWith('/personalDraft')) return plain('src/lib/personalDraft.ts', browser)
    if (id.endsWith('/storyRomance')) return plain('src/lib/storyRomance.ts')
    if (id.endsWith('/legalContact')) return { hasExplicitConsent: value => value === true, MUSE_AI_CONSENT_VERSION: consentVersion }
    if (id.endsWith('/useNarration')) return { useNarration: () => ({
      stop() { narrationStops++ }, speak(...args) { narrationCalls.push(args); return Promise.resolve() },
      provider: cloudProvider, cloudConsent, setCloudConsent(value) { cloudConsent = value }
    }), NarrationButton: 'narration' }
    if (id.endsWith('/useStoryInteraction')) return { useStoryInteraction: (_before, language) => { selectedDictationLanguage = language; return ({
      recordingTarget: interactionRecordingTarget, ready: true, error: '',
      stopRecording() { stopRecordingCalls++ }, cancelRecording() { interactionRecordingTarget = '' },
      dictate(_target, receive) { dictateCalls++; transcriptReceiver = receive }
    }) } }
    throw new Error('Unexpected dependency: ' + id)
  }
  const browser = {
    confirm() { return confirmDeletion },
    addEventListener(name, handler) { browserEvents.set(name, handler) },
    removeEventListener(name, handler) { if (browserEvents.get(name) === handler) browserEvents.delete(name) },
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, delay }); return id },
    clearTimeout(id) { timers.delete(id) },
    localStorage: {
    getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)
  } }
  new Function('module', 'exports', 'require', 'window', 'fetch', 'requestAnimationFrame', compile('src/pages/story.tsx'))(
    module, module.exports, mockRequire, browser, accountRequest = async (_url, options) => {
      const body = JSON.parse(options.body)
      requests.push(body)
      if (body.action === 'continue' && chapterResponse) {
        if (chapterResponse.story) loadedStory = chapterResponse.story
        return { ok: true, json: async () => chapterResponse }
      }
      if (body.action === 'delete') return { ok: deletionSuccess, json: async () => deletionSuccess ? { deleted: true } : { error: 'Deletion denied' } }
      if (body.action === 'respond' && responseGate) await responseGate
      if (body.action === 'conclude') {
        loadedStory = { ...loadedStory, journey: { ...loadedStory.journey, revision: loadedStory.journey.revision + 1, status: 'concluded' },
          currentStep: 1, scenes: [...loadedStory.scenes.slice(0, 1), { title: 'The conclusion', body: 'The door closes and the garden is safe.', question: '', choices: [] }] }
      }
      if (respondSuccessfully) return { ok: true, json: async () => ({
        story: body.action === 'respond' ? { ...loadedStory, journey: { ...loadedStory.journey, revision: 1 } } : loadedStory
      }) }
      return { ok: false, status: failureStatus, json: async () => ({ error: 'Synthetic generation failure; no paid call.', ...(failureSnapshot ? { snapshot: failureSnapshot, story: null } : {}) }) }
    }, callback => callback()
  )
  const flush = async () => {
    for (let i = 0; i < 4; i++) {
      cursor = 0; tree = module.exports.default()
      for (const effect of effects.splice(0)) effect()
      await new Promise(resolve => setImmediate(resolve))
    }
  }
  const nodes = () => flatten(tree).filter(node => node && typeof node === 'object')
  const find = (type, name) => {
    const result = nodes().find(node => node.type === type && label(node) === name)
    assert.ok(result, `Missing ${type}: ${name}`)
    return result
  }
  const click = async name => { find('button', name).props.onClick(); await flush() }
  const visible = () => nodes().filter(node => node.type === 'fieldset' && !node.props.hidden)
  await flush()
  assert.equal(nodes().find(node => node.type === 'main').props.lang, 'en-US')
  interfaceLocale = 'it-IT'
  await flush()
  assert.equal(nodes().find(node => node.type === 'main').props.lang, 'it-IT')
  assert.equal(nodes().find(node => node.type === 'ol').props['aria-label'], 'Fasi della storia')
  assert.equal(nodes().find(node => node.props['aria-label'] === 'Lingua della storia').props.value, 'en-US',
    'Story language accessibility label follows the interface locale without changing story language')
  assert.ok(nodes().some(node => node.type === 'button' && label(node) === 'Continua'),
    'Mounted story controls follow the current interface language')
  interfaceLocale = 'en-US'
  await flush()
  assert.equal(visible().length, 1)
  assert.equal(visible()[0].props.disabled, false)
  assert.equal(requests.length, 0)
  await click('Continue')
  assert.equal(visible().length, 1)
  assert.ok(!nodes().some(node => node.props.href === '/myself'), 'Personal touches stay inside creation')
  assert.ok(nodes().some(node => node.type === 'fieldset' && flatten(node).some(child => child?.type === '../components/RomanceOptions')),
    'Romance is in the mood step')
  const language = nodes().find(node => node.props['aria-label'] === 'Story language')
  language.props.onChange({ target: { value: 'ar-SA' } })
  nodes().find(node => node.type === 'textarea').props.onChange({ target: { value: 'A fictional evening in a garden.' } })
  nodes().find(node => node.props['aria-label'] === 'What should Muse remember?').props.onChange({ target: { value: 'I love gardens' } })
  await flush()
  const profileDictation = nodes().find(node => node.type === '../components/DictationButton')
  profileDictation.props.onStart()
  transcriptReceiver('I love gardens')
  profileDictation.props.onStop()
  await flush()
  assert.equal(nodes().find(node => node.props['aria-label'] === 'What should Muse remember?').props.value, 'I love gardens',
    'Inline personal touches retain dictated text')
  await click('Save')
  assert.equal(profile.about, 'I love gardens')
  assert.equal(nodes().find(node => node.type === 'input' && node.props.type === 'checkbox').props.checked, true,
    'Saved memories are included by default')
  assert.equal(nodes().find(node => node.type === 'textarea').props.value, 'A fictional evening in a garden.')
  await flush()
  await click('Continue')
  assert.equal(visible().length, 1)
  assert.ok(flatten(visible()[0]).some(node => node === 'A fictional evening in a garden.'))
  cloudProvider = 'google'
  await flush()
  const narrationConsent = nodes().find(node => node.type === '../components/ExplicitConsent' && label(node).startsWith('Enable optional narration'))
  assert.ok(narrationConsent, 'Optional Google permission is offered before creating the story')
  assert.equal(narrationConsent.props.checked, false)
  narrationConsent.props.onChange(true)
  cloudProvider = 'browser'
  await click('Back')
  assert.equal(nodes().find(node => node.type === 'textarea').props.value, 'A fictional evening in a garden.')
  assert.equal(nodes().find(node => node.props['aria-label'] === 'Story language').props.value, 'ar-SA')
  await click('Continue')
  await click('Create story')
  const consentCopy = flatten(tree).filter(value => typeof value === 'string').join(' ')
  assert.ok(consentCopy.includes('Muse’s AI') && consentCopy.includes('until I delete it'))
  assert.ok(!consentCopy.includes('30 days'))
  assert.equal(requests.length, 0, 'AI consent still required')
  nodes().find(node => node.type === '../components/RomanceOptions').props.onChange('spicy')
  await flush()
  nodes().find(node => node.type === '../components/ExplicitConsent').props.onChange(true)
  await flush()
  await click('Create story')
  assert.equal(requests.length, 0, 'Romance confirmation still required')
  nodes().find(node => node.type === '../components/RomanceOptions').props.onConfirm(true)
  await flush()
  await click('Back')
  nodes().find(node => node.type === 'textarea').props.onChange({ target: { value: 'A changed fictional evening.' } })
  await flush()
  await click('Continue')
  assert.equal(nodes().find(node => node.type === '../components/RomanceOptions').props.confirmed, true,
    'Romance acknowledgment survives unrelated wizard details')
  nodes().find(node => node.type === '../components/RomanceOptions').props.onConfirm(true)
  nodes().find(node => node.type === '../components/ExplicitConsent').props.onChange(true)
  await flush()
  await click('Create story')
  assert.equal(requests.length, 1)
  assert.equal(requests[0].language, 'ar-SA')
  assert.equal(requests[0].romance, 'spicy')
  assert.equal(requests[0].romanceConfirmed, true)
  assert.equal(requests[0].need, 'A changed fictional evening.')
  assert.deepEqual(requests[0].profileKeypoints, ['I love gardens'])
  assert.ok(nodes().some(node => node.props.role === 'alert' && label(node).includes('Synthetic generation failure')))
  assert.equal(visible()[0].props.disabled, true, 'Saved pending preparation prevents accidental duplicate generation')
  assert.ok(!nodes().some(node => node.type === 'button' && label(node).includes('Sync saved progress')))
  await click('Discard draft')
  const savedCreation = JSON.parse(storage.get('muse-personal-creation-draft'))
  assert.equal(savedCreation.language, 'ar-SA')
  assert.equal(savedCreation.need, 'A changed fictional evening.')
  assert.equal('aiConsent' in savedCreation, false, 'Drafts never persist AI authorization')
  assert.equal('creatorCode' in savedCreation, false, 'Drafts never persist creator credentials')
  const beforeRestore = requests.length
  slots.length = 0; effects.length = 0
  await flush()
  assert.equal(requests.length, beforeRestore, 'Restoring a creation draft never calls AI')
  assert.equal(nodes().find(node => node.props['aria-label'] === 'Story language').props.value, 'ar-SA')
  assert.equal(nodes().find(node => node.type === '../components/ExplicitConsent').props.checked, false, 'Restored drafts require fresh consent')
  assert.equal(nodes().find(node => node.type === '../components/RomanceOptions').props.confirmed, false, 'Restored romance requires fresh acknowledgment')
  nodes().find(node => node.type === '../components/RomanceOptions').props.onConfirm(true)
  assert.equal(visible()[0].props.disabled, false, 'Abandoning pending preparation restores editing')
  await click('Back')
  nodes().find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: false } })
  await flush()
  await click('Continue')
  nodes().find(node => node.type === '../components/ExplicitConsent').props.onChange(true)
  await flush()
  await click('Create story')
  assert.deepEqual(requests.at(-1).profileKeypoints, [], 'Users can exclude default memories before consenting to creation')
  await click('Discard draft')
  failureStatus = 429
  failureSnapshot = { status: 'failed', pending: false }
  await click('Create story')
  assert.equal(visible()[0].props.disabled, false, 'A confirmed failed opening unlocks creation without manual abandonment')
  assert.equal(storage.has('muse-personal-journey-preparation'), false, 'Failed opening removes only its preparation marker')
  assert.equal(JSON.parse(storage.get('muse-personal-creation-draft')).need, 'A changed fictional evening.',
    'Failed opening preserves the creation draft')
  assert.ok(!nodes().some(node => node.type === 'button' && label(node) === 'Discard draft'))
  const failedOpeningRequests = requests.length
  await flush()
  assert.equal(requests.length, failedOpeningRequests, 'A failed opening is never automatically recreated')
  storage.set('muse-personal-journey-preparation', JSON.stringify({ id: requests[0].id, capability: requests[0].capability }))
  slots.length = 0; effects.length = 0; timers.clear()
  await flush()
  assert.equal(storage.has('muse-personal-journey-preparation'), false,
    'Restoring an old failed opening also releases the preparation lock')
  assert.equal(visible()[0].props.disabled, false)
  failureSnapshot = undefined
  for (const status of [401, 404]) {
    failureStatus = status
    storage.set('muse-personal-journey-preparation', JSON.stringify({ id: requests[0].id, capability: requests[0].capability }))
    slots.length = 0; effects.length = 0; timers.clear()
    await flush()
    const unavailableRequests = requests.length
    await flush()
    assert.equal(requests.length, unavailableRequests, 'Unavailable preparation does not generate a new story')
    assert.equal(timers.size, 0, `HTTP ${status} stops automatic retry loops`)
    assert.ok(flatten(tree).some(node => typeof node === 'string' && node.includes('Could not restore this session')))
    assert.equal(storage.has('muse-personal-journey-preparation'), true, 'Account errors retain the recovery capability')
    await click('Discard draft')
    assert.equal(visible()[0].props.disabled, false)
  }
  failureStatus = 503
  loadedStory = {
    id: 'saved-story', title: 'A quiet door', description: 'A small beginning.', mood: 'curious',
    language: 'en-US', generation: 'ai', currentStep: 0, responses: [],
    scenes: [{ title: 'The Door', body: 'A light glows.', question: 'Will you step inside?', choices: ['Enter'] },
      { title: 'The Garden', body: 'A path opens.', question: 'Where next?', choices: ['Follow'] }]
  }
  interactionRecordingTarget = 'response'
  slots.length = 0
  effects.length = 0
  await flush()
  const activeConsent = nodes().filter(node => node.type === '../components/ExplicitConsent')
  assert.equal(activeConsent.length, 1, 'An active story presents one AI consent prompt before responses')
  activeConsent[0].props.onChange(true)
  await flush()
  nodes().find(node => node.type === 'textarea' && node.props['aria-label'] === 'Your response')
    .props.onChange({ target: { value: 'I step inside.' } })
  await flush()
  assert.equal(nodes().find(node => node.type === '../components/ExplicitConsent').props.checked, true,
    'Editing response text does not make the story-wide consent prompt recur')
  assert.deepEqual(JSON.parse(storage.get('muse-personal-answer:saved-story')), { revision: 0, text: 'I step inside.' })
  slots.length = 0; effects.length = 0
  await flush()
  assert.equal(nodes().find(node => node.props['aria-label'] === 'Your response').props.value, 'I step inside.',
    'Unsent answers survive remount without being erased during hydration')
  const dictationButton = nodes().find(node => node.type === '../components/DictationButton')
  assert.ok(dictationButton)
  const stopsBefore = stopRecordingCalls
  const dictatesBefore = dictateCalls
  dictationButton.props.onStop()
  assert.equal(stopRecordingCalls, stopsBefore + 1, 'Stopping dictation explicitly ends the active recording')
  assert.equal(dictateCalls, dictatesBefore, 'Stop listening does not restart dictation')
  loadedStory = { ...loadedStory, language: 'ar-SA', journey: {
    capability: 'test-capability', revision: 0, maxTurns: 3, duration: 5, status: 'active', choiceMode: 'free'
  } }
  respondSuccessfully = true
  slots.length = 0
  effects.length = 0
  const beforeResume = requests.length
  await flush()
  assert.equal(requests[beforeResume].action, 'resume', 'Restored journeys automatically reconcile without a paid call')
  interfaceLocale = 'it-IT'
  await flush()
  const progressCopy = flatten(tree).filter(value => typeof value === 'string').join(' ')
  assert.ok(progressCopy.includes('tentativi usati') && progressCopy.includes('In corso'),
    'Progress counters and journey status follow the interface language')
  assert.ok(nodes().some(node => node.props['aria-label'] === 'La tua risposta'),
    'Response controls follow the interface language after story progress')
  assert.ok(nodes().find(node => node.type === '../components/StoryModeControl').props.copy.listenDescription.includes('suoni ambientali'),
    'Listen mode explains that default ambience starts with playback')
  interfaceLocale = 'en-US'
  await flush()
  const activeMode = () => nodes().find(node => node.type === '../components/StoryModeControl')
  assert.equal(activeMode().props.mode, null)
  assert.ok(!nodes().some(node => node.type === '../components/ReadAlongText'), 'Active personal scenes do not mount the full narrative before a choice')
  activeMode().props.onChange('read')
  await flush()
  assert.ok(nodes().some(node => node.type === '../components/ReadAlongText' && node.props.text === 'A light glows.' && node.props.active === false))
  const beforeActiveListen = narrationCalls.length
  activeMode().props.onChange('listen')
  await flush()
  assert.equal(narrationCalls.length, beforeActiveListen + 1, 'Listen immediately starts the active personal scene')
  assert.deepEqual(narrationCalls.at(-1)[2], { autoPlay: true })
  assert.ok(nodes().some(node => node.type === '../components/ReadAlongText' && node.props.text === 'A light glows.' && node.props.active && node.props.position === -1), 'Loading narration never prints the full scene')
  assert.equal(selectedDictationLanguage, 'ar-SA', 'Dictation follows the saved story language')
  const responseField = () => nodes().find(node => node.props['aria-label'] === 'Your response')
  assert.equal(responseField().props.disabled, false)
  for (const name of ['Create a different story', 'Delete saved journey from server', 'Sync saved progress (no AI call)']) {
    assert.ok(!nodes().some(node => node.type === 'button' && label(node) === name), `${name} is absent from the reading view`)
  }
  assert.ok(!nodes().some(node => node.props.href === '/myself'), 'Reading view has no personal touches navigation')
  responseField().props.onFocus()
  responseField().props.onChange({ target: { value: 'I follow the path.' } })
  nodes().find(node => node.type === '../components/ExplicitConsent').props.onChange(true)
  await flush()
  assert.equal(find('button', 'Send response').props.disabled, false)
  await click('Send response')
  assert.equal(requests.at(-1).action, 'respond')
  assert.equal(requests.at(-1).text, 'I follow the path.')
  assert.equal(responseField().props.value, '', 'Successful continuation clears the submitted response')
  responseField().props.onChange({ target: { value: 'An answer while syncing.' } })
  await flush()
  const beforeFocus = requests.length
  const stopsBeforeFocus = narrationStops
  browserEvents.get('focus')()
  await flush()
  assert.equal(requests.length, beforeFocus + 1, 'Returning to the tab syncs once without an automatic generation')
  assert.equal(requests.at(-1).action, 'resume')
  assert.equal(narrationStops, stopsBeforeFocus, 'Automatic progress checks do not stop narration')
  assert.equal(find('button', 'Send response').props.disabled, false, 'Returning to the tab does not strand the send button')
  let releaseResponse
  responseGate = new Promise(resolve => { releaseResponse = resolve })
  find('button', 'Send response').props.onClick()
  await flush()
  assert.equal(responseField().props.disabled, false, 'The draft remains editable during a request')
  responseField().props.onChange({ target: { value: 'A newer draft typed while waiting.' } })
  await flush()
  releaseResponse()
  await flush()
  responseGate = undefined
  assert.equal(responseField().props.value, 'A newer draft typed while waiting.', 'A completed response must not erase newer typing')
  respondSuccessfully = false
  browserEvents.get('storage')()
  await flush()
  assert.equal(requests.at(-1).action, 'resume', 'Cross-tab changes trigger a safe progress check')
  assert.equal(responseField().props.disabled, false, 'A failed sync must not lock the editor')
  assert.equal(responseField().props.value, 'A newer draft typed while waiting.')
  assert.ok(nodes().some(node => node.props.role === 'alert' && label(node).includes('Synthetic generation failure')))
  assert.ok([...timers.values()].some(timer => timer.delay === 15000), 'Failed progress checks schedule automatic recovery')
  respondSuccessfully = true
  const beforeRecovery = requests.length
  const retry = [...timers.values()].find(timer => timer.delay === 15000)
  retry.callback()
  await flush()
  assert.equal(requests.length, beforeRecovery + 1)
  assert.equal(requests.at(-1).action, 'resume', 'Automatic recovery never retries paid story generation')
  assert.equal(responseField().props.value, 'A newer draft typed while waiting.')
  assert.equal(find('button', 'Send response').props.disabled, false)
  assert.equal(timers.size, 0, 'Successful synchronization stops background retries')
  const beforeClosingStory = structuredClone(loadedStory)
  loadedStory = { ...loadedStory, journey: { ...loadedStory.journey, revision: 2 } }
  slots.length = 0; effects.length = 0
  await flush()
  assert.ok(nodes().some(node => node.props['aria-label'] === 'Chapter closing scene'))
  assert.ok(!responseField(), 'The last allowance offers a closing scene, not another writing box')
  const closingRequests = requests.length
  await click('Write ending')
  assert.equal(requests.length, closingRequests, 'Closing still requires the story AI consent')
  nodes().find(node => node.type === '../components/ExplicitConsent').props.onChange(true)
  await flush()
  const writeEnding = find('button', 'Write ending')
  writeEnding.props.onClick()
  writeEnding.props.onClick()
  await flush()
  const closingRequest = requests.findLast(body => body.action === 'conclude')
  assert.equal(closingRequest.revision, 2)
  assert.equal(closingRequest.text, undefined, 'No user writing is required to generate the ending')
  assert.equal(requests.filter(body => body.action === 'conclude').length, 1, 'Double-click cannot reserve two endings')
  assert.ok(nodes().some(node => node.type === 'h2' && label(node) === 'Chapter 1 · Complete'))
  assert.ok(!responseField(), 'The generated ending never asks for another response')
  assert.ok(!nodes().some(node => node.type === 'button' && label(node) === 'Write ending'))
  loadedStory = beforeClosingStory
  slots.length = 0; effects.length = 0
  await flush()
  const beforeDelete = requests.length
  confirmDeletion = false
  await click('Delete story')
  assert.equal(requests.length, beforeDelete, 'Cancelled deletion never calls the server')
  assert.equal(removals.length, 0)
  confirmDeletion = true
  await click('Delete story')
  assert.equal(requests.at(-1).action, 'delete')
  assert.equal(requests.at(-1).capability, 'test-capability')
  assert.equal(requests.at(-1).mode, 'journey')
  assert.equal(removals.length, 0, 'Server deletion failure retains the local story')
  assert.ok(nodes().some(node => node.props.role === 'alert' && label(node).includes('Deletion denied')))
  deletionSuccess = true
  removalFails = true
  await click('Delete story')
  assert.ok(nodes().some(node => node.props.role === 'alert' && label(node).includes('server story was deleted')))
  const afterServerDelete = requests.length
  removalFails = false
  await click('Delete story')
  assert.equal(requests.length, afterServerDelete, 'Local cleanup retry does not delete the server story again')
  assert.deepEqual(removals, [{ kind: 'personal', id: 'saved-story' }])
  assert.ok(nodes().some(node => node.props.role === 'status' && label(node) === 'Story deleted.'))
  assert.ok(!nodes().some(node => node.type === 'button' && label(node) === 'Delete story'))
  loadedStory = { ...loadedStory, journey: undefined }
  slots.length = 0; effects.length = 0
  await flush()
  const beforeLegacyDelete = requests.length
  await click('Delete story')
  assert.equal(requests.length, beforeLegacyDelete, 'Browser-only legacy stories delete without a server request')
  assert.equal(removals.length, 2)
  assert.equal(storage.has('muse-personal-answer:saved-story'), false, 'Deleting a story removes its unsent answer')
  loadedStory = { ...loadedStory, responses: ['Enter'], currentStep: 1 }
  slots.length = 0; effects.length = 0
  await flush()
  assert.ok(nodes().some(node => node.type === 'h2' && label(node) === 'Story completed'))
  assert.ok(!responseField(), 'A legacy AI final scene is complete without a meaningless extra answer')
  assert.ok(!nodes().some(node => node.type === 'button' && label(node) === 'Send response'))
  await click('Read again')
  assert.ok(nodes().some(node => node.type === '../components/StoryPassage' && node.props.text === 'The Door'))
  const keepsake = nodes().find(node => node.type === '../components/StoryKeepsake')
  assert.deepEqual(Object.keys(keepsake.props.story).sort(), ['creatorName', 'recipientName', 'scenes', 'title'],
    'Keepsakes receive text only, not answers or capabilities')
  assert.ok(!JSON.stringify(keepsake.props.story).includes('test-capability'))
  loadedStory = { ...loadedStory, journey: {
    capability: 'parent-capability', revision: 3, maxTurns: 3, duration: 5, status: 'concluded', choiceMode: 'free'
  } }
  slots.length = 0; effects.length = 0
  await flush()
  assert.ok(nodes().some(node => node.type === 'h2' && label(node) === 'Chapter 1 · Complete'))
  const parentStory = structuredClone(loadedStory)
  const beforeChapterForm = requests.length
  await click('Continue · Chapter 2')
  assert.equal(requests.length, beforeChapterForm, 'Opening the new-chapter form never spends an allowance')
  assert.equal(find('button', 'Start chapter').props.disabled, true)
  await click('Start chapter')
  assert.equal(requests.length, beforeChapterForm, 'Even an invoked disabled handler refuses generation without consent')
  const chapterConsent = () => nodes().find(node => node.type === '../components/ExplicitConsent' && label(node).includes('new chapter'))
  assert.ok(chapterConsent())
  chapterConsent().props.onChange(true)
  await flush()
  assert.equal(find('button', 'Start chapter').props.disabled, false)
  respondSuccessfully = false
  failureSnapshot = { status: 'failed', pending: false }
  await click('Start chapter')
  const failedChapterRequest = requests.findLast(body => body.action === 'continue')
  assert.ok(failedChapterRequest)
  assert.notEqual(failedChapterRequest.id, parentStory.id)
  assert.equal(failedChapterRequest.sourceId, parentStory.id)
  assert.equal(failedChapterRequest.sourceCapability, parentStory.journey.capability)
  assert.equal(failedChapterRequest.duration, 5)
  assert.equal(failedChapterRequest.consentVersion, consentVersion)
  assert.equal(storage.has('muse-personal-journey-preparation'), false, 'Durable failure releases the pending child, not the parent')
  assert.deepEqual(loadedStory, parentStory, 'Failed child creation preserves the completed parent')
  assert.ok(nodes().some(node => node.type === 'h1' && label(node) === parentStory.title))
  const afterChapterFailure = requests.length
  await flush()
  assert.equal(requests.length, afterChapterFailure, 'Failed chapter is not automatically regenerated')
  chapterResponse = { status: 'done', snapshot: { status: 'active', pending: false }, story: {
    ...parentStory, id: 'next-chapter', title: 'Beyond the garden', responses: [], currentStep: 0,
    chapter: { number: 2, rootId: parentStory.id, parentId: parentStory.id, parentTitle: parentStory.title },
    journey: { ...parentStory.journey, capability: 'child-capability', revision: 0, status: 'active' }
  } }
  respondSuccessfully = true
  failureSnapshot = undefined
  const confirmChapter = find('button', 'Start chapter')
  confirmChapter.props.onClick()
  confirmChapter.props.onClick()
  await flush()
  assert.equal(requests.filter(body => body.action === 'continue').length, 2, 'Double-click confirmation reserves only one new attempt')
  assert.ok(nodes().some(node => node.type === 'h1' && label(node) === 'Beyond the garden'))
  assert.ok(nodes().some(node => node.type === 'button' && label(node) === 'Previous chapter'))
  assert.equal(storage.has('muse-personal-journey-preparation'), false, 'Successful child creation clears preparation')
  assert.equal(nodes().find(node => node.type === '../components/ExplicitConsent').props.checked, true, 'Confirmation covers the new chapter responses')
  loadedStory = parentStory
  chapterResponse = undefined
  loadedStory = { ...parentStory, journey: { ...parentStory.journey, revision: 3, status: 'exhausted' } }
  browser.location = { search: '' }
  slots.length = 0; effects.length = 0
  await flush()
  const recoveryPermission = () => nodes().find(node => node.type === '../components/ExplicitConsent' && label(node).includes('write its ending'))
  assert.ok(recoveryPermission(), 'Exhausted chapters offer ending-specific processing consent')
  assert.equal(find('button', 'Recover the ending').props.disabled, true)
  const beforeEndingRecovery = requests.length
  await click('Recover the ending')
  assert.equal(requests.length, beforeEndingRecovery, 'No ending recovery without explicit consent')
  interfaceLocale = 'it-IT'
  await flush()
  assert.ok(find('button', 'Recupera il finale'))
  assert.ok(nodes().some(node => node.type === '../components/ExplicitConsent' && label(node).includes('scrivere il finale')))
  interfaceLocale = 'en-US'
  await flush()
  recoveryPermission().props.onChange(true)
  await flush()
  await click('Recover the ending')
  assert.equal(requests.at(-1).action, 'conclude')
  assert.equal(requests.at(-1).revision, 3)
  assert.equal(loadedStory.journey.revision, 4)
  assert.ok(find('button', 'Continue · Chapter 2'), 'Saved recovered endings expose the usual next-chapter action')
  loadedStory = { ...parentStory, journey: { ...parentStory.journey, revision: 5, status: 'exhausted' } }
  slots.length = 0; effects.length = 0
  await flush()
  assert.ok(!nodes().some(node => node.type === 'button' && label(node) === 'Recover the ending'))
  assert.ok(nodes().some(node => node.type === 'p' && label(node).includes('Ending recovery attempts used')))
  loadedStory = parentStory
  loadedStory = { ...loadedStory, responses: [], currentStep: 0 }
  browser.location = { search: '?read=1' }
  slots.length = 0; effects.length = 0
  const beforeArchiveReading = requests.length
  await flush()
  assert.equal(requests.length, beforeArchiveReading + 1, 'An archived account chapter performs only a safe progress restore')
  assert.equal(requests.at(-1).action, 'resume')
  assert.ok(nodes().some(node => node.props['aria-label'] === 'Archived story'))
  assert.ok(nodes().some(node => node.type === '../components/StoryPassage' && node.props.text === 'The Garden'), 'Archive includes every saved scene')
  const modeControl = nodes().find(node => node.type === '../components/StoryModeControl')
  assert.equal(modeControl.props.mode, null, 'Scenes wait for Read or Listen instead of revealing the story by default')
  assert.ok(nodes().filter(node => node.type === '../components/StoryPassage').every(node => node.props.mode === null))
  assert.ok(!nodes().some(node => node.type === '../components/NarrationControls'), 'Read mode has no audio settings')
  const beforeArchiveListen = narrationCalls.length
  modeControl.props.onChange('listen')
  await flush()
  assert.equal(narrationCalls.length, beforeArchiveListen + 1, 'Listen starts narration directly with no second scene button')
  assert.equal(narrationCalls.at(-1)[0], 'The Door. A light glows.')
  assert.deepEqual(narrationCalls.at(-1)[2], { autoPlay: true })
  assert.ok(nodes().some(node => node.type === '../components/NarrationControls'), 'Listen mode exposes audio settings')
  assert.equal(requests.length, beforeArchiveReading + 1, 'Changing experience never generates story text or audio')
  nodes().find(node => node.type === '../components/StoryModeControl').props.onChange('read')
  await flush()
  assert.ok(nodes().filter(node => node.type === '../components/StoryPassage').every(node => node.props.mode === 'read'), 'Read explicitly reveals saved scenes')
  assert.ok(!nodes().some(node => node.props['aria-label'] === 'Your response'), 'Archive hides unfinished-story response controls')
  assert.ok(!nodes().some(node => node.type === '../components/ExplicitConsent'), 'Archive never offers story-generation consent')
  assert.ok(!nodes().some(node => node.type === 'button' && label(node) === 'Continue with a new chapter'), 'Even a completed chapter is read-only inside Archive')
  assert.ok(nodes().some(node => node.props.href === '/my-stories'), 'Archive reading points continuation back to My stories')
  cloudProvider = 'google'
  cloudConsent = false
  await flush()
  const beforeCloudListen = narrationCalls.length
  nodes().find(node => node.type === '../components/StoryModeControl').props.onChange('listen')
  await flush()
  assert.equal(narrationCalls.length, beforeCloudListen, 'Selecting Listen cannot silently consent to paid narration')
  const cloudPermission = nodes().find(node => node.type === '../components/ExplicitConsent')
  assert.ok(cloudPermission && cloudPermission.props.checked === false)
  cloudPermission.props.onChange(true)
  await flush()
  assert.equal(narrationCalls.length, beforeCloudListen + 1, 'Giving the required cloud permission completes the pending Listen action without another Play click')
  assert.deepEqual(narrationCalls.at(-1)[2], { autoPlay: true })
  nodes().find(node => node.type === '../components/StoryModeControl').props.onChange('read')
  await flush()
  browser.location = { search: '?new=1' }
  slots.length = 0; effects.length = 0
  const beforeNewStory = requests.length
  await flush()
  assert.equal(requests.length, beforeNewStory, 'Explicit new-story navigation never generates or deletes an existing story')
  assert.equal(visible().length, 1, 'Create a story opens creation even when another saved story exists')
  storage.set('muse-personal-creation-draft', '{broken')
  slots.length = 0; effects.length = 0
  await flush()
  assert.equal(storage.get('muse-personal-creation-draft'), '{broken', 'Unreadable drafts are retained, not silently overwritten')
  assert.ok(nodes().some(node => node.props.role === 'alert' && label(node).includes('saved draft could not be read')))
  const preferences = plain('src/lib/storyPreferences.ts', browser)
  assert.throws(() => preferences.saveStoryPreferences({ language: 'bad', duration: 10 }))
  assert.throws(() => preferences.saveStoryPreferences({ language: 'en-US', duration: '10' }))
  preferences.saveStoryPreferences({ language: 'zh-CN', duration: 20 })
  assert.deepEqual(preferences.loadStoryPreferences(), { language: 'zh-CN', duration: 20 })
  const drafts = plain('src/lib/browserDrafts.ts', browser)
  const originalWriter = browser.localStorage.setItem
  browser.localStorage.setItem = () => { throw new Error('Storage blocked') }
  assert.throws(() => drafts.writeDraft('synthetic', {}), /Storage blocked/, 'Storage failures propagate instead of reporting success')
  storage.delete('muse-personal-creation-draft')
  slots.length = 0; effects.length = 0
  await flush()
  assert.ok(nodes().some(node => node.props.role === 'alert' && label(node).includes('could not be saved')),
    'Blocked draft persistence is surfaced in the interface')
  assert.ok(!nodes().some(node => node.props.role === 'status' && label(node) === 'Draft saved in this browser.'))
  browser.localStorage.setItem = originalWriter
  console.log('PASS personal wizard preserves fields, presents one story-wide consent prompt, and explicitly stops dictation')
}
main().catch(error => { console.error(error); process.exitCode = 1 })

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
function plain(file) {
  const module = { exports: {} }
  new Function('module', 'exports', 'require', compile(file))(module, module.exports, id => id.startsWith('.') ? plain(path.join(path.dirname(file), id + '.ts')) : require(id))
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
  let responseGate
  const browserEvents = new Map()
  let cloudProvider = 'browser', cloudConsent = false
  let narrationStops = 0
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
    if (id.endsWith('/story')) return { loadPersonalStory: () => loadedStory, savePersonalStory() {} }
    if (id.endsWith('/profile')) return {
      loadMuseProfile: () => profile,
      saveMuseProfile: about => { profile = { about, keypoints: [about] }; return profile }
    }
    if (id.endsWith('/storyLibrary')) return {}
    if (id.endsWith('/storyLanguage')) return plain('src/lib/storyLanguage.ts')
    if (id.endsWith('/storyRomance')) return plain('src/lib/storyRomance.ts')
    if (id.endsWith('/legalContact')) return { hasExplicitConsent: value => value === true, MUSE_AI_CONSENT_VERSION: consentVersion }
    if (id.endsWith('/useNarration')) return { useNarration: () => ({
      stop() { narrationStops++ }, provider: cloudProvider, cloudConsent, setCloudConsent(value) { cloudConsent = value }
    }), NarrationButton: 'narration' }
    if (id.endsWith('/useStoryInteraction')) return { useStoryInteraction: (_before, language) => { selectedDictationLanguage = language; return ({
      recordingTarget: interactionRecordingTarget, ready: true, error: '',
      stopRecording() { stopRecordingCalls++ }, cancelRecording() { interactionRecordingTarget = '' },
      dictate(_target, receive) { dictateCalls++; transcriptReceiver = receive }
    }) } }
    throw new Error('Unexpected dependency: ' + id)
  }
  const browser = {
    addEventListener(name, handler) { browserEvents.set(name, handler) },
    removeEventListener(name, handler) { if (browserEvents.get(name) === handler) browserEvents.delete(name) },
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, delay }); return id },
    clearTimeout(id) { timers.delete(id) },
    localStorage: {
    getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)
  } }
  new Function('module', 'exports', 'require', 'window', 'fetch', 'requestAnimationFrame', compile('src/pages/story.tsx'))(
    module, module.exports, mockRequire, browser, async (_url, options) => {
      const body = JSON.parse(options.body)
      requests.push(body)
      if (body.action === 'respond' && responseGate) await responseGate
      if (respondSuccessfully) return { ok: true, json: async () => ({
        story: body.action === 'respond' ? { ...loadedStory, journey: { ...loadedStory.journey, revision: 1 } } : loadedStory
      }) }
      return { ok: false, json: async () => ({ error: 'Synthetic generation failure; no paid call.' }) }
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
  assert.equal(visible().length, 1)
  assert.equal(visible()[0].props.disabled, false)
  assert.equal(requests.length, 0)
  await click('Continue')
  assert.equal(visible().length, 1)
  assert.ok(!nodes().some(node => node.props.href === '/myself'), 'Personal touches stay inside creation')
  assert.ok(flatten(nodes().find(node => node.type === 'fieldset' && node.props.hidden && label(node).includes('How would you like to feel?')))
    .some(node => node?.type === '../components/RomanceOptions'), 'Romance is in the mood step')
  const language = nodes().find(node => node.props['aria-label'] === 'Story language')
  language.props.onChange({ target: { value: 'ar-SA' } })
  nodes().find(node => node.type === 'textarea').props.onChange({ target: { value: 'A fictional evening in a garden.' } })
  nodes().find(node => node.props['aria-label'] === 'Personal touches').props.onChange({ target: { value: 'I love gardens' } })
  await flush()
  const profileHold = nodes().find(node => node.type === '../components/HoldToSpeakButton')
  profileHold.props.onStart()
  transcriptReceiver('I love gardens')
  profileHold.props.onStop()
  await flush()
  assert.equal(nodes().find(node => node.props['aria-label'] === 'Personal touches').props.value, 'I love gardens',
    'Inline personal touches retain hold-to-speak')
  await click('Save personal touches')
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
  await click('Create my story →')
  const consentCopy = flatten(tree).filter(value => typeof value === 'string').join(' ')
  assert.ok(consentCopy.includes('stored on Muse') && consentCopy.includes('until I delete it'))
  assert.ok(!consentCopy.includes('30 days'))
  assert.equal(requests.length, 0, 'AI consent still required')
  nodes().find(node => node.type === '../components/RomanceOptions').props.onChange('spicy')
  await flush()
  nodes().find(node => node.type === '../components/ExplicitConsent').props.onChange(true)
  await flush()
  await click('Create my story →')
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
  await click('Create my story →')
  assert.equal(requests.length, 1)
  assert.equal(requests[0].language, 'ar-SA')
  assert.equal(requests[0].romance, 'spicy')
  assert.equal(requests[0].romanceConfirmed, true)
  assert.equal(requests[0].need, 'A changed fictional evening.')
  assert.deepEqual(requests[0].profileKeypoints, ['I love gardens'])
  assert.ok(nodes().some(node => node.props.role === 'alert' && label(node).includes('Synthetic generation failure')))
  assert.equal(visible()[0].props.disabled, true, 'Saved pending preparation prevents accidental duplicate generation')
  assert.ok(!nodes().some(node => node.type === 'button' && label(node).includes('Sync saved progress')))
  await click('Abandon (no refund)')
  assert.equal(visible()[0].props.disabled, false, 'Abandoning pending preparation restores editing')
  await click('Back')
  nodes().find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: false } })
  await flush()
  await click('Continue')
  nodes().find(node => node.type === '../components/ExplicitConsent').props.onChange(true)
  await flush()
  await click('Create my story →')
  assert.deepEqual(requests.at(-1).profileKeypoints, [], 'Users can exclude default memories before consenting to creation')
  await click('Abandon (no refund)')
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
  nodes().find(node => node.type === 'textarea' && node.props['aria-label'] === 'Editable response')
    .props.onChange({ target: { value: 'I step inside.' } })
  await flush()
  assert.equal(nodes().find(node => node.type === '../components/ExplicitConsent').props.checked, true,
    'Editing response text does not make the story-wide consent prompt recur')
  const holdToSpeak = nodes().find(node => node.type === '../components/HoldToSpeakButton')
  assert.ok(holdToSpeak)
  const stopsBefore = stopRecordingCalls
  const dictatesBefore = dictateCalls
  holdToSpeak.props.onStop()
  assert.equal(stopRecordingCalls, stopsBefore + 1, 'Releasing hold-to-speak explicitly ends the active recording')
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
  assert.equal(selectedDictationLanguage, 'ar-SA', 'Dictation follows the saved story language')
  const responseField = () => nodes().find(node => node.props['aria-label'] === 'Editable response')
  assert.equal(responseField().props.disabled, false)
  for (const name of ['Create a different story', 'Delete saved journey from server', 'Sync saved progress (no AI call)']) {
    assert.ok(!nodes().some(node => node.type === 'button' && label(node) === name), `${name} is absent from the reading view`)
  }
  assert.ok(!nodes().some(node => node.props.href === '/myself'), 'Reading view has no personal touches navigation')
  responseField().props.onFocus()
  responseField().props.onChange({ target: { value: 'I follow the path.' } })
  nodes().find(node => node.type === '../components/ExplicitConsent').props.onChange(true)
  await flush()
  assert.equal(find('button', 'Continue with my answer →').props.disabled, false)
  await click('Continue with my answer →')
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
  assert.equal(find('button', 'Continue with my answer →').props.disabled, false, 'Returning to the tab does not strand the send button')
  let releaseResponse
  responseGate = new Promise(resolve => { releaseResponse = resolve })
  find('button', 'Continue with my answer →').props.onClick()
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
  assert.equal(find('button', 'Continue with my answer →').props.disabled, false)
  assert.equal(timers.size, 0, 'Successful synchronization stops background retries')
  console.log('PASS personal wizard preserves fields, presents one story-wide consent prompt, and explicitly stops dictation')
}
main().catch(error => { console.error(error); process.exitCode = 1 })

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { execFileSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const output = fs.mkdtempSync(path.join(__dirname, '.narration-tests-'))
const saved = { fetch: global.fetch, window: global.window, utterance: global.SpeechSynthesisUtterance, audio: global.Audio, setTimeout: global.setTimeout, clearTimeout: global.clearTimeout, now: Date.now, createObjectURL: URL.createObjectURL, revokeObjectURL: URL.revokeObjectURL, env: { ...process.env } }
let passed = 0
async function check(name, run) { await run(); passed++; console.log(`PASS ${name}`) }

async function main() {
  process.env.MUSE_OPERATIONS_SQLITE_PATH = path.join(output, 'operations.sqlite')
  execFileSync(process.execPath, [
    path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
    'src/lib/narration.ts', 'src/lib/useNarration.ts', 'src/lib/sharedStory.ts', 'src/lib/sharedStorySharing.ts',
    'src/lib/personalStoryGenerator.ts', 'src/pages/api/tts.ts', 'src/components/NarrationControls.tsx', 'src/components/SharedStoryReveal.tsx',
    '--outDir', output, '--rootDir', 'src', '--module', 'commonjs', '--target', 'es2020', '--jsx', 'react-jsx',
    '--esModuleInterop', '--skipLibCheck', '--noEmit', 'false'
  ], { cwd: root, stdio: 'inherit' })
  const narration = require(path.join(output, 'lib', 'narration.js'))
  const { NARRATION_STYLES, NARRATION_PRESETS, parseNarrationMetadata, selectNarrationVoice, voiceKey, narrationChunks } = narration
  const { sharedStoryPlayerView, parseGeneratedStory } = require(path.join(output, 'lib', 'sharedStory.js'))
  const { sharedStoryPreviewText, recipientShareDetails } = require(path.join(output, 'lib', 'sharedStorySharing.js'))
  await check('creator full preview contains ordered scenes/clues, never private fields', () => {
    const preview = sharedStoryPreviewText({
      title: 'Test story', description: 'A quiet mystery', solution: 'PRIVATE ANSWER', message: 'PRIVATE REVEAL',
      scenes: [{ title: 'First', body: 'Open the door.', clue: 'Look left.' }, { title: 'Second', body: 'Read the note.', clue: 'Look right.' }]
    })
    assert.ok(preview.includes('Scene 1. First. Open the door. Clue: Look left.'))
    assert.ok(preview.includes('Scene 2. Second. Read the note. Clue: Look right.'))
    assert.ok(preview.indexOf('Scene 1') < preview.indexOf('Scene 2'))
    assert.ok(!preview.includes('PRIVATE'))
  })
  await check('WhatsApp payload preserves recipient capability and guards loopback links', () => {
    const details = recipientShareDetails('https://muse.example', 'id.secret&token')
    assert.equal(details.localOnly, false)
    assert.equal(details.url, 'https://muse.example/shared#play=id.secret%26token')
    const payload = new URL(details.whatsappUrl).searchParams.get('text')
    assert.equal(payload, `${details.text}\n${details.url}`)
    assert.ok(!payload.includes('#manage='))
    for (const origin of ['http://localhost:3102', 'http://127.0.0.1:3102', 'http://127.1.2.3', 'http://[::1]:3102', 'http://test.localhost']) {
      assert.equal(recipientShareDetails(origin, 'recipient').localOnly, true)
    }
  })
  const { parsePersonalStoryRequest, generatePersonalStory } = require(path.join(output, 'lib', 'personalStoryGenerator.js'))
  const voice = (name, lang) => ({ name, lang, voiceURI: name, localService: true })
  const voices = [voice('Microsoft David', 'en-US'), voice('Microsoft Mark', 'en-US'), voice('Microsoft Zira', 'en-US'), voice('Microsoft Hedda', 'de-DE'), voice('Microsoft Katja', 'de-DE'), voice('Microsoft Stefan', 'de-DE'), voice('Microsoft Michael', 'de-AT'), voice('Microsoft Cosimo', 'it-IT'), voice('Microsoft Elsa', 'it-IT')]
  await check('six explicit presets have bounded rates and pitches', () => {
    assert.deepEqual(NARRATION_STYLES, ['calm', 'warm', 'curious', 'adventurous', 'playful', 'suspenseful'])
    for (const preset of Object.values(NARRATION_PRESETS)) {
      assert.ok(preset.rate >= 0.8 && preset.rate <= 1.2)
      assert.ok(preset.pitch >= 0.8 && preset.pitch <= 1.2)
    }
  })
  await check('AI metadata rejects missing/invalid enums and unsafe language text', () => {
    assert.deepEqual(parseNarrationMetadata({}), {})
    assert.throws(() => parseNarrationMetadata({}, true))
    for (const narrationStyle of ['', 'evil', null, { style: 'warm' }]) assert.throws(() => parseNarrationMetadata({ narrationStyle, narrationLanguage: 'en-US' }, true))
    for (const narrationLanguage of ['English', 'en-US secret answer', '<script>', 'en-123456', 'x'.repeat(100), null]) {
      assert.throws(() => parseNarrationMetadata({ narrationStyle: 'warm', narrationLanguage }, true))
    }
    assert.deepEqual(parseNarrationMetadata({ narrationStyle: 'warm', narrationLanguage: 'EN-us', narrationReason: 'private secret' }, true), { narrationStyle: 'warm', narrationLanguage: 'en-US' })
    assert.equal(parseNarrationMetadata({ narrationStyle: 'warm', narrationLanguage: 'zh-Hant-TW' }, true).narrationLanguage, 'zh-Hant-TW')
  })
  await check('style voice preferences remain language/locale-aware', () => {
    assert.equal(selectNarrationVoice(voices, 'en-US', 'suspenseful').name, 'Microsoft Zira')
    assert.equal(selectNarrationVoice(voices, 'en-US', 'warm').name, 'Microsoft Zira')
    assert.equal(selectNarrationVoice(voices, 'de-DE', 'curious').name, 'Microsoft Hedda')
    assert.equal(selectNarrationVoice(voices, 'de-AT', 'warm').name, 'Microsoft Michael')
    assert.equal(selectNarrationVoice(voices, 'it-IT', 'warm').name, 'Microsoft Elsa')
    assert.equal(selectNarrationVoice(voices, 'fr-FR', 'warm'), undefined)
    assert.equal(selectNarrationVoice(voices, 'en-US', 'warm', voiceKey(voices[0])), voices[0])
    assert.equal(selectNarrationVoice(voices, 'de-DE', 'warm', voiceKey(voices[0])).lang, 'de-DE')
    const unknown = voice('Unknown Voice', 'de-DE')
    assert.equal(selectNarrationVoice([voices[0], unknown], 'de-DE', 'warm'), unknown)
  })
  await check('automatic speaker stays stable across moods, prefers natural voices, and preserves manual choices', () => {
    const natural = { ...voice('Microsoft Jenny Natural', 'en-US'), localService: false }
    for (const style of NARRATION_STYLES) {
      assert.equal(selectNarrationVoice(voices, 'en-US', style), voices[2])
      assert.equal(selectNarrationVoice([...voices, natural], 'en-US', style), natural)
      assert.equal(selectNarrationVoice([...voices, natural], 'en-US', style, voiceKey(voices[0])), voices[0])
      assert.equal(NARRATION_PRESETS[style].pitch, 1)
    }
    const systemDefault = { ...voice('Device default', 'en-US'), default: true }
    assert.equal(selectNarrationVoice([...voices, systemDefault], 'en-US', 'suspenseful'), systemDefault)
    assert.equal(selectNarrationVoice([...voices, { ...natural, lang: 'en-GB' }], 'en-US', 'warm'), voices[2])
  })
  await check('long narration chunks preserve sentences/text with bounded lengths', () => {
    const text = 'The door opens. ' + 'A long thought continues '.repeat(120) + 'A quiet ending!'
    const chunks = narrationChunks(text)
    assert.ok(chunks.length > 10)
    assert.ok(chunks.every(chunk => chunk.length <= 220))
    assert.equal(chunks.join(' ').replace(/\s+/g, ' '), text.trim().replace(/\s+/g, ' '))
    assert.deepEqual(narrationChunks('   '), [])
    assert.ok(narrationChunks('字'.repeat(1200)).every(chunk => chunk.length <= 220))
  })
  const brief = { creatorName: 'A', recipientName: 'B', narration: 'Warm', setting: 'Room', recipientHints: 'private hint', goal: 'Find', solution: 'secret answer', message: 'private message', durationMinutes: 5 }
  const content = { title: 'Room', description: 'A mystery', narrationStyle: 'suspenseful', narrationLanguage: 'en-US', narrationReason: brief.solution, scenes: Array.from({ length: 3 }, () => ({ title: 'One', body: 'wonder '.repeat(110).trim(), clue: 'Look closely' })) }
  await check('shared persistence projection copies only safe style/language, including legacy stories', () => {
    const parsed = parseGeneratedStory(content, brief)
    assert.equal(parsed.narrationReason, undefined)
    const projected = sharedStoryPlayerView(brief, content, { current_scene: 0, solved: false })
    assert.equal(projected.narrationStyle, 'suspenseful')
    assert.equal(projected.narrationLanguage, 'en-US')
    assert.equal(projected.narrationReason, undefined)
    assert.ok(!JSON.stringify(projected).includes(brief.solution))
    const legacy = { title: content.title, description: content.description, scenes: content.scenes }
    assert.equal(sharedStoryPlayerView(brief, legacy, { current_scene: 0, solved: false }).narrationStyle, undefined)
    assert.throws(() => parseGeneratedStory({ ...content, narrationStyle: 'wrong' }, brief), /narrationStyle/)
  })
  await check('shared exploratory choices survive projection and reject private-answer leakage', () => {
    const scenes = content.scenes.map(scene => ({ ...scene, choices: ['Follow the clue', 'Continue investigating', 'Explore the room'] }))
    const generated = parseGeneratedStory({ ...content, scenes }, brief)
    assert.deepEqual(sharedStoryPlayerView(brief, generated, { current_scene: 0, solved: false }).scene.choices, scenes[0].choices)
    assert.throws(() => parseGeneratedStory({ ...content, scenes: scenes.map(scene => ({ ...scene, choices: ['One', 'One', 'Two'] })) }, brief), /distinct/)
    assert.throws(() => parseGeneratedStory({ ...content, scenes: scenes.map(scene => ({ ...scene, choices: [brief.solution, 'Follow', 'Continue'] })) }, brief), /exposed/)
    assert.throws(() => parseGeneratedStory({ ...content, scenes: scenes.map(scene => ({ ...scene, choices: ['Only one'] })) }, brief), /3 to 5/)
  })
  await check('personal generation and continuation validate/rechoose metadata in the existing AI call', async () => {
    process.env.LLM_PROVIDER = 'GROQ'
    process.env.LLM_API_KEY = 'fake-test-key'
    const scene = { title: 'Start', body: 'Something begins.', question: 'Where next?', choices: ['A', 'B', 'C'] }
    let calls = 0
    let generated = { title: 'Personal', description: 'A path', scenes: [scene, scene, scene], narrationStyle: 'curious', narrationLanguage: 'de-DE' }
    global.fetch = async () => { calls++; return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(generated) } }] })) }
    const story = await generatePersonalStory(parsePersonalStoryRequest({ action: 'create', mood: 'curious', need: '', profileKeypoints: [] }))
    assert.equal(calls, 1)
    assert.equal(story.narrationLanguage, 'de-DE')
    generated = { scene, narrationStyle: 'warm', narrationLanguage: 'de-DE' }
    const continued = await generatePersonalStory(parsePersonalStoryRequest({ action: 'continue', story, answer: 'A' }))
    assert.equal(calls, 2)
    assert.equal(continued.narrationStyle, 'warm')
    assert.equal(continued.narrationLanguage, 'de-DE')
    assert.throws(() => parsePersonalStoryRequest({ action: 'continue', story: { ...story, narrationStyle: 'unsafe' }, answer: 'A' }), /narrationStyle/)
    generated = { scene, narrationStyle: 'unsafe', narrationLanguage: 'de-DE' }
    await assert.rejects(() => generatePersonalStory(parsePersonalStoryRequest({ action: 'continue', story, answer: 'A' })), error => error.status === 502)
  })

  // A tiny hook runner exercises our state transitions without adding a test dependency.
  function mount(metadata = {}, availableVoices = voices, supported = true, options = {}) {
    const slots = []
    let cursor = 0, pending = [], current
    const equal = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]))
    const react = {
      useState(initial) {
        const index = cursor++
        if (!slots[index]) slots[index] = { value: initial }
        return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value }]
      },
      useRef(initial) { const index = cursor++; return slots[index] || (slots[index] = { current: initial }) },
      useCallback(fn, deps) {
        const index = cursor++
        if (!slots[index] || !equal(slots[index].deps, deps)) slots[index] = { deps, fn }
        return slots[index].fn
      },
      useEffect(fn, deps) {
        const index = cursor++
        if (!slots[index] || !equal(slots[index].deps, deps)) {
          const old = slots[index]
          slots[index] = { deps, cleanup: old?.cleanup }
          pending.push(() => { old?.cleanup?.(); slots[index].cleanup = fn() })
        }
      }
    }
    const listeners = new Map(), spoken = []
    let voiceList = availableVoices, cancels = 0
    const calls = [], ambientCalls = []
    class FakeAmbience {
      async start(kind, volume) { ambientCalls.push(['start', kind, volume]); if (options.ambientFailure) throw new Error('No audio device'); if (options.ambientStart) await options.ambientStart() }
      async pause() { ambientCalls.push(['pause']) }
      async resume() { ambientCalls.push(['resume']) }
      stop() { ambientCalls.push(['stop']) }
    }
    const synth = {
      paused: false,
      getVoices: () => voiceList,
      addEventListener: (event, callback) => listeners.set(event, callback),
      removeEventListener: event => listeners.delete(event),
      speak: utterance => { calls.push('speak'); spoken.push(utterance); utterance.onstart?.() },
      cancel: () => { calls.push('cancel'); cancels++ },
      pause: () => { calls.push('pause'); synth.paused = true },
      resume: () => { calls.push('resume'); synth.paused = false }
    }
    global.window = { speechSynthesis: supported ? synth : undefined }
    if (options.storage !== undefined) global.window.localStorage = options.storage
    global.SpeechSynthesisUtterance = class { constructor(text) { this.text = text } }
    const modulePath = path.join(output, 'lib', 'useNarration.js')
    delete require.cache[require.resolve(modulePath)]
    const originalLoad = Module._load
    let useNarration
    try { Module._load = function (id, ...args) { return id === 'react' ? react : id === './storyAmbience' ? { StoryAmbience: FakeAmbience } : originalLoad.call(this, id, ...args) }; useNarration = require(modulePath).useNarration } finally { Module._load = originalLoad }
    let context = options.context || {}
    const render = () => { cursor = 0; current = useNarration(metadata, options.mood, context, { browserOnly: options.browserOnly }); const effects = pending; pending = []; effects.forEach(effect => effect()); return current }
    render(); render()
    return { render, spoken, listeners, synth, calls, ambientCalls, get cancels() { return cancels }, setContext(value) { context = value; render(); return render() }, setMetadata(value) { metadata = value; render(); return render() }, updateVoices(value) { voiceList = value; listeners.get('voiceschanged')?.() }, dispose() { slots.forEach(slot => { slot?.cleanup?.(); if (slot) slot.cleanup = undefined }) } }
  }
  await check('free sample overrides the paid ElevenLabs provider with browser speech', async () => {
    process.env.NEXT_PUBLIC_NARRATION_PROVIDER = 'elevenlabs'
    let fetches = 0
    global.fetch = async () => { fetches++; throw new Error('Paid TTS forbidden') }
    const hook = mount({ narrationStyle: 'warm', narrationLanguage: 'en-US' }, voices, true, { browserOnly: true })
    try {
      await hook.render().speak('A free fictional sample.')
      assert.equal(fetches, 0)
      assert.equal(hook.spoken.length, 1)
      hook.spoken[0].onend()
      assert.equal(hook.render().busy, false)
    } finally { hook.dispose() }
  })
  await check('browser mode makes zero TTS requests and completes sentence chunks without stuck state', async () => {
    process.env.NEXT_PUBLIC_NARRATION_PROVIDER = 'browser'
    let fetches = 0
    global.fetch = async () => { fetches++; throw new Error('Forbidden') }
    const hook = mount({ narrationStyle: 'warm', narrationLanguage: 'de-DE' })
    try {
      await hook.render().speak('Die Tür öffnet sich. Eine neue Geschichte beginnt.')
      assert.equal(fetches, 0)
      assert.equal(hook.spoken[0].voice.lang, 'de-DE')
      assert.equal(hook.spoken[0].rate, NARRATION_PRESETS.warm.rate)
      assert.equal(hook.render().speaking, true)
      hook.spoken[0].onend()
      hook.spoken[1].onend()
      assert.equal(hook.render().speaking, false)
      assert.equal(hook.render().loading, false)
    } finally { hook.dispose() }
  })
  await check('Safari tap starts full-preview speech synchronously even while ambient startup is pending', async () => {
    process.env.NEXT_PUBLIC_NARRATION_PROVIDER = 'browser'
    let resolveAmbient
    const ambient = new Promise(resolve => { resolveAmbient = resolve })
    const hook = mount({ narrationStyle: 'warm', narrationLanguage: 'en-US' }, voices, true, {
      storage: memoryStorage(), ambientStart: () => ambient
    })
    const preview = sharedStoryPreviewText({ title: 'Rain at the window', description: 'A quiet mystery.',
      scenes: [{ title: 'First', body: 'Rain falls. A letter waits.', clue: 'Look left.' },
        { title: 'Second', body: 'You find a small key.', clue: 'Try the drawer.' }] })
    try {
      const speaking = hook.render().speak(preview)
      assert.equal(hook.spoken.length, 1, 'speech is dispatched before the tap call stack returns')
      await speaking
      let index = 0
      while (hook.render().busy) {
        assert.ok(index < 100, 'preview must finish')
        hook.spoken[index++].onend()
      }
      assert.equal(hook.spoken.map(item => item.text).join(' '), narrationChunks(preview).join(' '))
      resolveAmbient()
      await new Promise(resolve => setImmediate(resolve))
      assert.equal(hook.render().ambientKind, 'none', 'late ambient startup cannot revive completed playback')
      assert.equal(hook.render().busy, false)
    } finally { resolveAmbient(); hook.dispose() }
  })
  await check('stop, preview replacement, language changes, errors and unmount cancel safely', async () => {
    const hook = mount({ narrationStyle: 'curious', narrationLanguage: 'en-US' })
    try {
      await hook.render().speak('First scene. Second sentence.')
      const stale = hook.spoken[0].onend
      hook.render().stop()
      stale()
      assert.equal(hook.spoken.length, 1)
      assert.equal(hook.render().speaking, false)
      await hook.render().speak('Preview.')
      hook.render().setLanguage('it-IT')
      assert.equal(hook.render().speaking, false)
      await hook.render().speak('Una storia.')
      assert.equal(hook.spoken.at(-1).voice.lang, 'it-IT')
      hook.spoken.at(-1).onerror()
      assert.equal(hook.render().speaking, false)
      assert.match(hook.render().error, /failed/)
      await hook.render().speak('Preview again.')
      hook.dispose()
      assert.equal(hook.spoken.at(-1).onend, null)
      assert.ok(hook.cancels > 0)
    } finally { hook.dispose() }
  })
  await check('voiceschanged updates actual voices; empty, unsupported and missing-language paths are explicit', async () => {
    const hook = mount({}, [])
    try {
      assert.match(hook.render().source, /Legacy/)
      await hook.render().speak('Preview.')
      assert.match(hook.render().error, /No browser voices/)
      assert.equal(hook.render().speaking, false)
      hook.updateVoices(voices)
      assert.equal(hook.render().voices.length, voices.length)
      await hook.render().speak('Preview.')
      hook.render().stop()
      hook.render().setLanguage('fr-FR')
      await hook.render().speak('Bonjour.')
      assert.match(hook.render().error, /No browser voice.*fr-FR/)
    } finally { hook.dispose() }
    const noSpeech = mount({}, [], false)
    try {
      assert.equal(noSpeech.render().supported, false)
      await noSpeech.render().speak('Hello.')
      assert.match(noSpeech.render().error, /not supported/)
      assert.equal(noSpeech.render().speaking, false)
    } finally { noSpeech.dispose() }
  })
  await check('explicit ElevenLabs failure warns before browser fallback; cancellation never starts fallback', async () => {
    process.env.NEXT_PUBLIC_NARRATION_PROVIDER = 'elevenlabs'
    let calls = 0
    global.fetch = async () => { calls++; return new Response('private provider error', { status: 401 }) }
    const hook = mount({ narrationStyle: 'playful', narrationLanguage: 'en-US' })
    try {
      hook.render().setCloudConsent(true)
      await hook.render().speak('Preview.')
      assert.equal(calls, 1)
      assert.match(hook.render().notice, /falling back/)
      assert.ok(!hook.render().notice.includes('private'))
      hook.render().stop()
      global.fetch = (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('Abort'))))
      const pending = hook.render().speak('Cancelled.')
      hook.render().stop()
      await pending
      assert.equal(hook.spoken.length, 1)
      assert.equal(hook.render().loading, false)
    } finally { hook.dispose() }
  })
  await check('cloud narration consent starts unchecked and never sends text until explicitly accepted', async () => {
    process.env.NEXT_PUBLIC_NARRATION_PROVIDER = 'elevenlabs'
    let calls = 0
    global.fetch = async () => { calls++; return new Response('unavailable', { status: 503 }) }
    const hook = mount({ narrationStyle: 'warm', narrationLanguage: 'en-US' })
    try {
      assert.equal(hook.render().cloudConsent, false)
      await hook.render().speak('Local voice only.')
      assert.equal(calls, 0)
      assert.match(hook.render().notice, /needs your consent/)
      hook.render().setCloudConsent(true)
      await hook.render().speak('Consented narration.')
      assert.equal(calls, 1)
      hook.render().setCloudConsent(false)
      assert.equal(hook.render().busy, false)
    } finally { hook.dispose() }
  })
  const { NARRATION_PREFERENCES_KEY, parseNarrationPreferences, serializeNarrationPreferences } = narration
  function memoryStorage(initial = {}, { failRead = false, failWrite = false } = {}) {
    const data = new Map(Object.entries(initial)), writes = []
    return {
      data, writes,
      getItem(key) { if (failRead) throw new Error('SecurityError'); return data.has(key) ? data.get(key) : null },
      setItem(key, value) { if (failWrite) throw new Error('QuotaExceededError'); writes.push([key, value]); data.set(key, value) }
    }
  }
  function fakeClock() {
    let now = 1000, id = 0
    const tasks = new Map()
    global.setTimeout = (fn, ms) => { const key = ++id; tasks.set(key, { fn, at: now + ms }); return key }
    global.clearTimeout = key => { tasks.delete(key) }
    Date.now = () => now
    return {
      get pending() { return [...tasks.values()].map(task => task.at - now) },
      advance(ms) {
        now += ms
        for (const [key, task] of [...tasks].sort((a, b) => a[1].at - b[1].at)) if (task.at <= now && tasks.has(key)) { tasks.delete(key); task.fn() }
      },
      restore() { global.setTimeout = saved.setTimeout; global.clearTimeout = saved.clearTimeout; Date.now = saved.now }
    }
  }
  const stored = value => ({ [NARRATION_PREFERENCES_KEY]: typeof value === 'string' ? value : JSON.stringify(value) })

  const immersiveLib = require(path.join(output, 'lib', 'immersiveNarration.js'))
  await check('immersive settings validate bounds and preserve valid fields without overwriting old voice preferences', () => {
    const { parseImmersivePreferences, DEFAULT_IMMERSIVE_PREFERENCES } = immersiveLib
    assert.deepEqual(parseImmersivePreferences(null), { preferences: DEFAULT_IMMERSIVE_PREFERENCES, invalid: false })
    for (const raw of ['bad', 'null', '[]', '{"version":2}', '{"version":1,"voiceVolume":2}', '{"version":1,"ambientVolume":-1}', '{"version":1,"soundscape":"explosion"}']) {
      assert.equal(parseImmersivePreferences(raw).invalid, true)
    }
    const result = parseImmersivePreferences('{"version":1,"expressive":false,"voiceVolume":0,"ambientVolume":0.3,"soundscape":"rain"}')
    assert.equal(result.invalid, false)
    assert.equal(result.preferences.voiceVolume, 0)
    assert.equal(result.preferences.expressive, false)
    const old = mount({ narrationStyle: 'suspenseful' }, voices, true, { storage: memoryStorage(stored({ version: 1, style: 'warm' })) })
    try { assert.equal(old.render().style, 'warm') } finally { old.dispose() }
  })
  await check('local scene cues and expressive delivery are bounded, contextual and independently switchable', () => {
    const { storySoundscape, narrativeDelivery, DEFAULT_IMMERSIVE_PREFERENCES: prefs } = immersiveLib
    assert.equal(storySoundscape('Rain taps the window.', 'auto'), 'rain')
    assert.equal(storySoundscape('La pioggia cade.', 'auto'), 'rain')
    assert.equal(storySoundscape('Der Wind weht.', 'auto'), 'wind')
    assert.equal(storySoundscape('Waves cross the sea.', 'auto'), 'water')
    assert.equal(storySoundscape('A bustling marketplace.', 'auto'), 'crowd')
    assert.equal(storySoundscape('A private indoor mystery.', 'auto'), 'none')
    assert.equal(storySoundscape('Rain taps the window.', 'none'), 'none')
    assert.equal(storySoundscape('A quiet room.', 'water'), 'water')
    const opening = narrativeDelivery('A path opens.', 'adventurous', { progress: 0 }, prefs)
    const late = narrativeDelivery('A path opens.', 'adventurous', { progress: 0.8 }, prefs)
    const quiet = narrativeDelivery('She whispers softly.', 'adventurous', {}, prefs)
    const ending = narrativeDelivery('A path opens.', 'adventurous', { progress: 0.8, ending: true }, prefs)
    assert.ok(late.rate > opening.rate)
    assert.ok(ending.rate < late.rate)
    assert.ok(quiet.volume < opening.volume)
    assert.ok(narrativeDelivery('What lies ahead?', 'curious', {}, prefs).pitch > 1)
    assert.deepEqual(narrativeDelivery('She whispers?', 'warm', { ending: true }, { ...prefs, expressive: false }), { rate: NARRATION_PRESETS.warm.rate, pitch: 1, volume: prefs.voiceVolume })
    for (const style of NARRATION_STYLES) for (const progress of [-10, 0, 0.5, 1, 20, NaN, Infinity]) {
      const d = narrativeDelivery('Run! She whispers quietly. Why?', style, { progress, ending: true }, prefs)
      assert.ok(d.rate >= 0.86 && d.rate <= 1.12)
      assert.ok(d.pitch >= 0.96 && d.pitch <= 1.06)
      assert.ok(d.volume >= 0 && d.volume <= 1)
    }
  })
  await check('free soundscapes start only on Play, duck beneath speech and follow pause/resume/scene changes', async () => {
    process.env.NEXT_PUBLIC_NARRATION_PROVIDER = 'browser'
    let fetches = 0
    global.fetch = async () => { fetches++; throw new Error('No paid calls') }
    const storage = memoryStorage()
    const hook = mount({ narrationStyle: 'curious' }, voices, true, { storage, context: { sceneKey: 'one', progress: 0 } })
    try {
      assert.equal(hook.ambientCalls.length, 0)
      await hook.render().speak('Rain taps the window. What is outside?')
      assert.deepEqual(hook.ambientCalls[0], ['start', 'rain', 0.08 * 0.55])
      assert.equal(hook.spoken[0].volume, 0.9)
      hook.render().pause()
      assert.equal(hook.ambientCalls.at(-1)[0], 'pause')
      hook.render().resume()
      assert.equal(hook.ambientCalls.at(-1)[0], 'resume')
      hook.spoken[0].onend()
      assert.ok(hook.spoken[1].pitch > 1)
      hook.setContext({ sceneKey: 'two', progress: 0.5 })
      assert.equal(hook.render().busy, false)
      assert.equal(hook.ambientCalls.at(-1)[0], 'stop')
      hook.render().setImmersivePreference('soundscape', 'none')
      hook.render().setImmersivePreference('voiceVolume', 0.5)
      await hook.render().speak('Rain falls.')
      assert.equal(hook.spoken.at(-1).volume, 0.5)
      assert.equal(hook.ambientCalls.filter(x => x[0] === 'start').length, 1)
      assert.equal(JSON.parse(storage.data.get(immersiveLib.IMMERSIVE_PREFERENCES_KEY)).voiceVolume, 0.5)
      hook.render().setImmersivePreference('soundscape', 'rain')
      hook.render().setImmersivePreference('voiceVolume', 0.05)
      hook.render().setImmersivePreference('ambientVolume', 0.3)
      await hook.render().speak('A soft scene.')
      assert.ok(hook.ambientCalls.filter(x => x[0] === 'start').at(-1)[2] < 0.01, 'quiet voice also lowers the background')
      hook.render().setImmersivePreference('voiceVolume', 0)
      const starts = hook.ambientCalls.filter(x => x[0] === 'start').length
      await hook.render().speak('Muted rain.')
      assert.equal(hook.ambientCalls.filter(x => x[0] === 'start').length, starts, 'muted narration cannot leave background running')
      assert.equal(hook.spoken.at(-1).volume, 0)
      assert.equal(fetches, 0)
    } finally { hook.dispose() }
  })
  await check('ambient failures visibly fall back to speech and cancellation cannot start stale narration', async () => {
    const hook = mount({}, voices, true, { storage: memoryStorage(), ambientFailure: true })
    try {
      await hook.render().speak('A breeze passes.')
      assert.match(hook.render().ambientNotice, /could not start/)
      assert.equal(hook.spoken.length, 1)
      hook.render().stop()
      const pending = hook.render().speak('The rain falls.')
      assert.equal(hook.spoken.length, 2, 'new speech starts synchronously')
      const stale = hook.spoken.at(-1).onend
      hook.render().stop()
      await pending
      stale()
      assert.equal(hook.spoken.length, 2, 'cancelled playback never advances')
      assert.equal(hook.render().busy, false)
    } finally { hook.dispose() }
  })
  await check('preference parsing is versioned, validated per field, and absent data is a valid default', () => {
    assert.equal(NARRATION_PREFERENCES_KEY, 'muse.narration.preferences.v1')
    assert.deepEqual(parseNarrationPreferences(null), { preferences: { style: 'auto', language: '', voice: '' }, invalid: false })
    assert.deepEqual(parseNarrationPreferences('{"version":1}'), { preferences: { style: 'auto', language: '', voice: '' }, invalid: false })
    const key = voiceKey(voices[0])
    const round = parseNarrationPreferences(serializeNarrationPreferences({ style: 'playful', language: 'de-DE', voice: key }))
    assert.deepEqual(round, { preferences: { style: 'playful', language: 'de-DE', voice: key }, invalid: false })
    assert.equal(parseNarrationPreferences('{"version":1,"language":"en_us"}').preferences.language, 'en-US')
    for (const raw of ['not json', '[]', 'null', '{"version":2,"style":"warm"}', '{"style":"warm"}']) {
      assert.deepEqual(parseNarrationPreferences(raw), { preferences: { style: 'auto', language: '', voice: '' }, invalid: true })
    }
    const partial = parseNarrationPreferences(JSON.stringify({ version: 1, style: 'evil', language: 'de-DE', voice: 'x\u0000|y|z' }))
    assert.deepEqual(partial, { preferences: { style: 'auto', language: 'de-DE', voice: '' }, invalid: true })
    assert.equal(parseNarrationPreferences(JSON.stringify({ version: 1, language: '<script>' })).invalid, true)
    assert.equal(parseNarrationPreferences(JSON.stringify({ version: 1, voice: 'v'.repeat(600) + '|a|b' })).invalid, true)
  })

  await check('saved overrides load on mount and only explicit overrides persist; Auto stays adaptive to new AI metadata', async () => {
    process.env.NEXT_PUBLIC_NARRATION_PROVIDER = 'browser'
    const storage = memoryStorage()
    const hook = mount({ narrationStyle: 'warm', narrationLanguage: 'en-US' }, voices, true, { storage })
    try {
      assert.equal(hook.render().style, 'warm')
      assert.equal(hook.render().preferenceNotice, '')
      assert.equal(storage.writes.length, 0, 'mount must not write preferences')
      assert.equal(hook.setMetadata({ narrationStyle: 'suspenseful', narrationLanguage: 'en-US' }).style, 'suspenseful')
      hook.render().setStyle('playful')
      assert.deepEqual(JSON.parse(storage.data.get(NARRATION_PREFERENCES_KEY)), { version: 1, style: 'playful', language: '', voice: '' })
      hook.render().setStyle('auto')
      assert.equal(JSON.parse(storage.data.get(NARRATION_PREFERENCES_KEY)).style, 'auto', 'inferred AI style is never stored')
      hook.render().setLanguage('de-DE')
      hook.render().setVoice(voiceKey(voices[3]))
      hook.render().setStyle('bogus')
      assert.deepEqual(JSON.parse(storage.data.get(NARRATION_PREFERENCES_KEY)), { version: 1, style: 'auto', language: 'de-DE', voice: voiceKey(voices[3]) })
    } finally { hook.dispose() }
    const next = mount({ narrationStyle: 'calm', narrationLanguage: 'en-US' }, voices, true, { storage })
    try {
      const state = next.render()
      assert.equal(state.styleOverride, 'auto')
      assert.equal(state.style, 'calm', 'a new story still uses its own AI style')
      assert.equal(state.language, 'de-DE')
      assert.equal(state.voice.name, 'Microsoft Hedda')
      assert.equal(state.voiceNotice, '')
      assert.equal(next.setMetadata({ narrationStyle: 'adventurous', narrationLanguage: 'en-US' }).style, 'adventurous')
    } finally { next.dispose() }
    const manual = mount({ narrationStyle: 'calm' }, voices, true, { storage: memoryStorage(stored({ version: 1, style: 'suspenseful' })) })
    try { assert.equal(manual.render().style, 'suspenseful'); assert.equal(manual.render().source, 'Manual style') } finally { manual.dispose() }
  })

  await check('denied, invalid and unwritable storage are visible notices without crashes or overwrites', async () => {
    const denied = memoryStorage({}, { failRead: true, failWrite: true })
    const hook = mount({ narrationStyle: 'warm', narrationLanguage: 'en-US' }, voices, true, { storage: denied })
    try {
      assert.match(hook.render().preferenceNotice, /could not be read/)
      assert.equal(hook.render().styleOverride, 'auto')
      hook.render().setStyle('calm')
      assert.equal(hook.render().style, 'calm', 'the choice still applies for this page')
      assert.match(hook.render().preferenceNotice, /could not be remembered/)
      await hook.render().speak('Still works.')
      assert.equal(hook.spoken.length, 1)
    } finally { hook.dispose() }
    const missing = mount({}, voices, true)
    try { assert.match(missing.render().preferenceNotice, /could not be read/) } finally { missing.dispose() }
    const raw = JSON.stringify({ version: 1, style: 'loud', language: 'it-IT' })
    const invalid = memoryStorage(stored(raw))
    const second = mount({ narrationStyle: 'warm' }, voices, true, { storage: invalid })
    try {
      assert.match(second.render().preferenceNotice, /invalid and were ignored/)
      assert.equal(second.render().styleOverride, 'auto')
      assert.equal(second.render().language, 'it-IT', 'valid fields survive')
      assert.equal(invalid.data.get(NARRATION_PREFERENCES_KEY), raw, 'invalid data is not overwritten on load')
      assert.equal(invalid.writes.length, 0)
      second.render().setStyle('warm')
      assert.equal(second.render().preferenceNotice, '')
      assert.equal(JSON.parse(invalid.data.get(NARRATION_PREFERENCES_KEY)).style, 'warm')
    } finally { second.dispose() }
    const writeFails = memoryStorage({}, { failWrite: true })
    const third = mount({}, voices, true, { storage: writeFails })
    try {
      assert.equal(third.render().preferenceNotice, '')
      third.render().setLanguage('it-IT')
      assert.equal(third.render().language, 'it-IT')
      assert.match(third.render().preferenceNotice, /could not be remembered/)
    } finally { third.dispose() }
  })

  await check('unavailable remembered voice is explained and falls back deterministically within the language', async () => {
    const gone = 'gone-uri|de-DE|Microsoft Vanished'
    const storage = () => memoryStorage(stored({ version: 1, language: 'de-DE', voice: gone }))
    const shuffled = [...voices].reverse()
    const first = mount({ narrationStyle: 'warm' }, voices, true, { storage: storage() })
    const second = mount({ narrationStyle: 'warm' }, shuffled, true, { storage: storage() })
    try {
      const a = first.render(), b = second.render()
      assert.equal(a.selectedVoice, gone, 'the remembered choice is kept, not overwritten')
      assert.equal(a.voice.lang, 'de-DE')
      assert.equal(a.voice.name, b.voice.name)
      assert.match(a.voiceNotice, /Microsoft Vanished.*not available.*Microsoft Hedda \(de-DE\)/)
      await second.render().speak('Hallo.')
      assert.equal(second.spoken[0].voice.name, a.voice.name)
      const ties = [voice('Beta', 'fr-FR'), voice('Alpha', 'fr-FR')]
      assert.equal(selectNarrationVoice(ties, 'fr-FR', 'warm').name, 'Alpha')
      assert.equal(selectNarrationVoice([...ties].reverse(), 'fr-FR', 'warm').name, 'Alpha')
    } finally { first.dispose(); second.dispose() }
    const waiting = mount({}, [], true, { storage: storage() })
    try { assert.equal(waiting.render().voiceNotice, '', 'no false alarm before voices load') } finally { waiting.dispose() }
    const mismatch = mount({}, voices, true, { storage: memoryStorage(stored({ version: 1, language: 'it-IT', voice: voiceKey(voices[0]) })) })
    try { assert.match(mismatch.render().voiceNotice, /Microsoft David.*does not match it-IT/) } finally { mismatch.dispose() }
  })

  await check('browser pause suspends the chunk timeout, never skips or restarts chunks, and resume restores the clock', async () => {
    process.env.NEXT_PUBLIC_NARRATION_PROVIDER = 'browser'
    const clock = fakeClock()
    const hook = mount({ narrationStyle: 'warm', narrationLanguage: 'en-US' }, voices, true, { storage: memoryStorage() })
    try {
      await hook.render().speak('First sentence. Second sentence. Third sentence.')
      assert.equal(hook.render().canPause, true)
      assert.equal(hook.render().activeText, 'First sentence. Second sentence. Third sentence.')
      assert.deepEqual(clock.pending, [45000])
      clock.advance(10000)
      hook.render().pause()
      assert.equal(hook.render().paused, true)
      assert.equal(hook.render().speaking, false)
      assert.equal(hook.render().busy, true)
      assert.equal(hook.synth.paused, true)
      assert.deepEqual(clock.pending, [], 'timeout is suspended while paused')
      clock.advance(120000)
      assert.equal(hook.render().error, '')
      assert.equal(hook.render().paused, true)
      hook.render().pause()
      assert.equal(hook.calls.filter(call => call === 'pause').length, 1)
      hook.spoken[0].onstart()
      assert.equal(hook.render().paused, true, 'a late onstart does not unpause')
      hook.render().resume()
      assert.equal(hook.synth.paused, false)
      assert.equal(hook.render().speaking, true)
      assert.deepEqual(clock.pending, [35000], 'remaining chunk time is restored')
      assert.equal(hook.spoken.length, 1, 'resume does not restart the chunk')
      hook.spoken[0].onend()
      assert.equal(hook.spoken.length, 2)
      assert.equal(hook.spoken[1].text, 'Second sentence.')
      hook.render().pause()
      hook.spoken[1].onend()
      assert.equal(hook.spoken.length, 2, 'an end event while paused does not advance')
      assert.deepEqual(clock.pending, [])
      hook.render().resume()
      assert.equal(hook.spoken.length, 3)
      assert.equal(hook.spoken[2].text, 'Third sentence.', 'no chunk skipped')
      hook.render().resume()
      assert.equal(hook.spoken.length, 3, 'resume when not paused is a no-op')
      hook.render().pause()
      hook.render().resume()
      clock.advance(45000)
      assert.match(hook.render().error, /did not finish/)
      assert.equal(hook.render().busy, false)
    } finally { hook.dispose(); clock.restore() }
  })

  await check('stop, preference changes, new speech and unmount clear pause state without leaking a paused synth', async () => {
    const clock = fakeClock()
    const hook = mount({ narrationStyle: 'warm', narrationLanguage: 'en-US' }, voices, true, { storage: memoryStorage() })
    try {
      await hook.render().speak('One. Two.')
      hook.render().pause()
      const pausedUtterance = hook.spoken[0]
      hook.render().stop()
      assert.equal(hook.render().status, 'idle')
      assert.equal(hook.render().activeText, '')
      assert.equal(hook.synth.paused, false, 'the global synth is never left paused')
      assert.deepEqual(hook.calls.slice(-2), ['cancel', 'resume'])
      assert.equal(pausedUtterance.onend, null)
      assert.deepEqual(clock.pending, [])
      hook.render().resume()
      assert.equal(hook.render().status, 'idle', 'stale resume is ignored')
      await hook.render().speak('One. Two.')
      assert.equal(hook.spoken.at(-1).text, 'One.', 'Stop then Listen restarts from the beginning')
      hook.render().pause()
      hook.render().setStyle('calm')
      assert.equal(hook.render().paused, false)
      assert.equal(hook.synth.paused, false)
      await hook.render().speak('Again.')
      hook.render().pause()
      await hook.render().speak('Replacement.')
      assert.equal(hook.render().speaking, true)
      assert.equal(hook.synth.paused, false)
      hook.render().pause()
      hook.setMetadata({ narrationStyle: 'playful', narrationLanguage: 'en-US' })
      assert.equal(hook.render().status, 'idle', 'story metadata changes stop paused playback')
      await hook.render().speak('Last.')
      hook.render().pause()
      hook.dispose()
      assert.equal(hook.synth.paused, false)
      assert.deepEqual(clock.pending, [])
    } finally { hook.dispose(); clock.restore() }
    const noPause = mount({}, voices, true, { storage: memoryStorage() })
    try {
      delete noPause.synth.pause
      await noPause.render().speak('Hello.')
      assert.equal(noPause.render().canPause, false)
      noPause.render().pause()
      assert.equal(noPause.render().speaking, true)
    } finally { noPause.dispose() }
  })

  await check('configured provider audio pauses/resumes the element and suspends its playback timeout', async () => {
    process.env.NEXT_PUBLIC_NARRATION_PROVIDER = 'elevenlabs'
    const players = []
    global.Audio = class { constructor(src) { this.src = src; this.plays = 0; this.pauses = 0; players.push(this) } play() { this.plays++; return Promise.resolve() } pause() { this.pauses++ } }
    URL.createObjectURL = () => 'blob:test'
    let revoked = 0
    URL.revokeObjectURL = () => { revoked++ }
    global.fetch = async () => new Response('audio-bytes', { status: 200 })
    const clock = fakeClock()
    const hook = mount({ narrationStyle: 'warm', narrationLanguage: 'en-US' }, voices, true, { storage: memoryStorage() })
    try {
      hook.render().setCloudConsent(true)
      await hook.render().speak('Provider text.')
      assert.equal(hook.render().speaking, true)
      assert.equal(hook.render().canPause, true)
      assert.deepEqual(clock.pending, [60000])
      clock.advance(20000)
      hook.render().pause()
      assert.equal(players[0].pauses, 1)
      assert.equal(hook.render().paused, true)
      assert.deepEqual(clock.pending, [])
      clock.advance(600000)
      assert.equal(hook.render().error, '')
      hook.render().resume()
      await Promise.resolve()
      assert.equal(players[0].plays, 2)
      assert.equal(hook.render().speaking, true)
      assert.deepEqual(clock.pending, [40000])
      assert.equal(hook.spoken.length, 0, 'no browser fallback while provider audio is fine')
      hook.render().pause()
      hook.render().stop()
      assert.equal(hook.render().status, 'idle')
      assert.ok(revoked >= 1)
      await hook.render().speak('Provider text.')
      players.at(-1).play = () => Promise.reject(new Error('NotAllowed'))
      hook.render().pause()
      hook.render().resume()
      await new Promise(resolve => setImmediate(resolve))
      assert.match(hook.render().error, /could not resume/)
      assert.equal(hook.render().busy, false)
    } finally { hook.dispose(); clock.restore(); process.env.NEXT_PUBLIC_NARRATION_PROVIDER = 'browser' }
  })

  await check('shared buttons scope playback controls to their own context and controls stay phone-bounded', () => {
    const { renderToStaticMarkup } = require('react-dom/server')
    const { createElement } = require('react')
    const controls = require(path.join(output, 'components', 'NarrationControls.js'))
    const base = {
      voices, supported: true, styleOverride: 'auto', languageOverride: '', selectedVoice: '', style: 'warm', language: 'en-US', voice: voices[2],
      status: 'idle', speaking: false, loading: false, paused: false, busy: false, activeText: '', canPause: false,
      error: '', notice: '', preferenceNotice: '', voiceNotice: '', provider: 'browser', source: 'AI-selected style',
      immersive: { expressive: true, soundscape: 'auto', voiceVolume: 0.9, ambientVolume: 0.08 }, ambientKind: 'none', ambientNotice: '', setImmersivePreference() {},
      speak: async () => {}, stop() {}, pause() {}, resume() {}, setStyle() {}, setLanguage() {}, setVoice() {}, resetVoice() {}
    }
    const button = (narrator, text = 'Scene two text.', label = 'Listen to scene two') => renderToStaticMarkup(createElement(controls.NarrationButton, { narrator, text, label }))
    assert.match(button(base), />Listen to scene two</)
    assert.ok(!button(base).includes('disabled'))
    const speaking = { ...base, status: 'speaking', speaking: true, busy: true, activeText: 'Scene two text.', canPause: true }
    const own = button(speaking)
    assert.match(own, /aria-label="Pause narration: Listen to scene two"/)
    assert.match(own, /aria-label="Stop narration: Listen to scene two"/)
    assert.ok(!own.includes('>Listen to scene two<'))
    const other = button(speaking, 'Scene one text.', 'Listen to scene one')
    assert.match(other, /disabled=""/)
    assert.match(other, />Listen to scene one</, 'other contexts keep their own identity')
    assert.ok(!other.includes('Narrating'))
    const paused = button({ ...speaking, status: 'paused', speaking: false, paused: true, canPause: false })
    assert.match(paused, /Narration paused/)
    assert.match(paused, /aria-label="Resume narration: Listen to scene two"/)
    assert.match(paused, /Stop narration/)
    assert.ok(!paused.includes('Pause narration'))
    const longVoice = { ...voice('Microsoft Extremely Long Natural Online Voice Name With Many Words (English United States)', 'en-US'), localService: false }
    const html = renderToStaticMarkup(createElement(controls.default, { narrator: { ...speaking, voices: [...voices, longVoice], voiceNotice: 'Remembered voice gone.', preferenceNotice: 'Storage blocked.' } }))
    const selects = html.match(/<select[^>]*>/g)
    assert.equal(selects.length, 4)
    for (const select of selects) {
      assert.match(select, /width:100%/)
      assert.match(select, /max-width:100%/)
      assert.match(select, /min-width:0/)
    }
    assert.equal((html.match(/<label style="[^"]*min-width:0[^"]*max-width:100%/g) || []).length, 6)
    assert.match(html, /<aside[^>]*box-sizing:border-box[^>]*max-width:100%[^>]*min-width:0/)
    assert.match(html, /minmax\(min\(100%, 11rem\), 1fr\)/)
    assert.match(html, /Remembered voice gone\./)
    assert.match(html, /Storage blocked\./)
    assert.match(html, /aria-label="Pause narration: current story narration"/)
    assert.match(html, /Preview selected style<\/button>/)
    assert.match(html, /<option value="auto" selected="">Follow this story \(recommended\)<\/option>/)
    assert.match(html, /Follow story with recommended voice/)
    for (const style of NARRATION_STYLES) assert.ok(html.includes(`<option value="${style}">${style}</option>`))
  })
  await check('story-following reset stops playback without changing language or saved manual preferences on load', async () => {
    const storage = memoryStorage(stored({ version: 1, style: 'suspenseful', language: 'de-DE', voice: voiceKey(voices[5]) }))
    const hook = mount({ narrationStyle: 'suspenseful', narrationLanguage: 'en-US' }, voices, true, { storage })
    try {
      await hook.render().speak('Eine Geschichte beginnt.')
      hook.render().resetVoice()
      const state = hook.render()
      assert.equal(state.busy, false)
      assert.equal(state.style, 'suspenseful')
      assert.equal(state.language, 'de-DE')
      assert.equal(state.selectedVoice, '')
      assert.equal(state.voice.name, 'Microsoft Hedda')
      assert.deepEqual(JSON.parse(storage.data.get(NARRATION_PREFERENCES_KEY)), { version: 1, style: 'auto', language: 'de-DE', voice: '' })
    } finally { hook.dispose() }
  })
  await check('shared reveal renders the message as escaped text and media only from the authorized media prop', () => {
    const { renderToStaticMarkup } = require('react-dom/server')
    const { createElement } = require('react')
    const Reveal = require(path.join(output, 'components', 'SharedStoryReveal.js')).default
    const narrator = { busy: false, activeText: '', speak() {}, stop() {} }
    const message = '<img src="file:///private-gallery/photo.jpg" onerror="alert(1)">\n![photo](https://example.invalid/photo.jpg)\nYou are wonderful.'
    const html = renderToStaticMarkup(createElement(Reveal, { message, narrator, beforeSpeak() {} }))
    assert.match(html, /<h2>Your surprise<\/h2>/)
    assert.match(html, /&lt;img/)
    assert.match(html, /You are wonderful\./)
    assert.ok(!/<(?:img|picture|video|iframe|object|embed|script)\b/i.test(html))
    assert.ok(!/style="[^"]*url\(/i.test(html))
    assert.match(html, /Play the final message/)
    const photo = renderToStaticMarkup(createElement(Reveal, { message, media: { kind: 'photo', state: 'ready', url: 'blob:https://muse.example/1234' }, narrator, beforeSpeak() {} }))
    assert.equal((photo.match(/<img\b/gi) || []).length, 1, 'Exactly one image comes from the authorized media prop')
    assert.match(photo, /<img[^>]+src="blob:https:\/\/muse\.example\/1234"/)
    assert.ok(!/src="(?!blob:https:\/\/muse\.example\/1234")/.test(photo), 'Message text never becomes a media source')
    assert.match(photo, /&lt;img/)
    const video = renderToStaticMarkup(createElement(Reveal, { media: { kind: 'video', state: 'ready', url: 'https://project.supabase.co/storage/v1/object/sign/x?token=t' }, narrator, beforeSpeak() {} }))
    assert.match(video, /<video[^>]+controls/)
    assert.match(video, /preload="metadata"/)
    assert.ok(!/autoplay/i.test(video), 'Video must never autoplay')
    assert.ok(!/Play the final message/.test(video), 'A media-only reveal has no empty narration button')
    assert.match(video, /surprise video/)
    const pending = renderToStaticMarkup(createElement(Reveal, { message: 'Hi', media: { kind: 'photo', state: 'loading' }, narrator, beforeSpeak() {} }))
    assert.ok(!/<(?:img|video)\b/i.test(pending), 'No media markup before an authorized URL exists')
  })

  await check('TTS endpoint requires explicit provider mode and never returns upstream auth details', async () => {
    const handler = require(path.join(output, 'pages', 'api', 'tts.js')).default
    const run = async body => {
      let status = 200, result
      const res = { setHeader() {}, status(value) { status = value; return this }, json(value) { result = value; return this }, send(value) { result = value; return this } }
      await handler({ method: 'POST', headers: { host: 'localhost:3000' }, socket: { remoteAddress: 'tts-fixture' }, body: { consentVersion: '2026-10-14', ...body } }, res)
      return { status, result }
    }
    process.env.NEXT_PUBLIC_NARRATION_PROVIDER = 'browser'
    global.fetch = async () => { throw new Error('Browser mode must not fetch') }
    assert.equal((await run({ text: 'Hello' })).status, 503)
    process.env.NEXT_PUBLIC_NARRATION_PROVIDER = 'elevenlabs'
    process.env.ELEVEN_API_KEY = 'fake-key'
    process.env.ELEVEN_VOICE_ID = 'fake-voice'
    assert.equal((await run({ text: 'Hello', consentVersion: undefined })).status, 400)
    let payload
    global.fetch = async (_url, options) => { payload = JSON.parse(options.body); return new Response('private token detail', { status: 401 }) }
    const response = await run({ text: 'Hello', narrationStyle: 'playful', narrationLanguage: 'it-IT' })
    assert.equal(response.status, 503)
    assert.ok(!JSON.stringify(response).includes('private'))
    assert.equal(payload.voice_settings.style, 0.35)
    assert.equal((await run({ text: 'Hello', narrationStyle: 'invalid' })).status, 400)
  })
  console.log(`\n${passed} Narration checks passed.`)
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => {
  global.fetch = saved.fetch
  global.window = saved.window
  global.SpeechSynthesisUtterance = saved.utterance
  global.Audio = saved.audio
  global.setTimeout = saved.setTimeout
  global.clearTimeout = saved.clearTimeout
  Date.now = saved.now
  URL.createObjectURL = saved.createObjectURL
  URL.revokeObjectURL = saved.revokeObjectURL
  for (const key of Object.keys(process.env)) if (!(key in saved.env)) delete process.env[key]
  Object.assign(process.env, saved.env)
  fs.rmSync(output, { recursive: true, force: true })
})

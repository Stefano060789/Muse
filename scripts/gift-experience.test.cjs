const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const vm = require('node:vm')
const root = path.resolve(__dirname, '..')
let passed = 0
function check(name, run) { run(); passed++; console.log(`PASS ${name}`) }
function moduleFrom(relative) {
  const file = path.join(root, relative)
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const result = { exports: {} }
  new Function('module', 'exports', 'require', code)(result, result.exports, id => id.startsWith('.') ? moduleFrom(path.join(path.dirname(relative), id + '.ts')) : require(id))
  return result.exports
}
const drafts = moduleFrom('src/lib/storyGift.ts')
const { keepsakeHtml } = moduleFrom('src/lib/storyKeepsake.ts')
const { wavRecording, VOICE_SAMPLE_RATE } = moduleFrom('src/lib/voiceRecording.ts')
const brief = {
  creatorName: 'Sender', recipientName: '', narration: 'Warm', setting: '', recipientHints: '',
  goal: '', solution: '', message: '', durationMinutes: 5,
  gift: { occasion: 'birthday', dedication: 'For your special day', allowReply: true }
}
const draft = () => ({ version: 1, brief: structuredClone(brief), assistanceHintsText: 'One gentle clue', alternativeAnswersText: '', savedAt: '2026-10-15T07:00:00.000Z' })
function memory() {
  const data = new Map()
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key), data }
}
check('occasion guides offer distinct editable starting ideas', () => {
  assert.equal(drafts.GIFT_OCCASIONS.length, 4)
  assert.equal(new Set(drafts.GIFT_OCCASIONS.map(item => item.idea)).size, 4)
  assert.equal(new Set(drafts.GIFT_OCCASIONS.map(item => item.question)).size, 4)
})
check('incomplete written drafts survive save and reload', () => {
  const store = memory(), value = draft()
  drafts.saveGiftDraft(value, store)
  assert.deepEqual(drafts.loadGiftDraft(store), value)
  drafts.removeGiftDraft(store)
  assert.equal(drafts.loadGiftDraft(store), null)
})
check('draft serialization excludes capabilities, codes, files and consent', () => {
  const store = memory(), value = draft()
  Object.assign(value, { ownerToken: 'PRIVATE_OWNER', creatorCode: 'PRIVATE_CODE', aiConsent: true, voiceFile: 'PRIVATE_AUDIO' })
  Object.assign(value.brief, { playToken: 'PRIVATE_PLAY', file: 'PRIVATE_FILE' })
  drafts.saveGiftDraft(value, store)
  const raw = store.getItem(drafts.GIFT_DRAFT_KEY)
  for (const secret of ['PRIVATE_OWNER', 'PRIVATE_CODE', 'PRIVATE_PLAY', 'PRIVATE_FILE', 'PRIVATE_AUDIO', 'aiConsent']) assert.equal(raw.includes(secret), false)
})
check('draft restore validates options without requiring a finished brief', () => {
  const value = draft()
  value.brief.adventure = { actionBudget: 12, choiceMode: 'suggested' }
  value.brief.unlockPolicy = 'allow-skip'
  assert.equal(drafts.parseGiftDraft(value).brief.adventure.choiceMode, 'suggested')
  value.brief.language = 'zh-CN'
  assert.equal(drafts.parseGiftDraft(value).brief.language, 'zh-CN')
  for (const patch of [{ language: 'xx-YY' }, { durationMinutes: 99 }, { gift: { ...brief.gift, occasion: 'forged' } }, { adventure: { actionBudget: -1, choiceMode: 'free' } }, { solution: 'a'.repeat(201) }]) {
    assert.throws(() => drafts.parseGiftDraft({ ...draft(), brief: { ...brief, ...patch } }))
  }
})
check('corrupt, oversized and blocked draft storage fails explicitly', () => {
  const store = memory()
  store.setItem(drafts.GIFT_DRAFT_KEY, '{')
  assert.throws(() => drafts.loadGiftDraft(store))
  store.setItem(drafts.GIFT_DRAFT_KEY, 'x'.repeat(20001))
  assert.throws(() => drafts.loadGiftDraft(store), /too large/)
  assert.throws(() => drafts.saveGiftDraft(draft(), { setItem() { throw new Error('Quota exceeded') } }), /Quota/)
})
const story = {
  title: '<script>unsafe()</script>', creatorName: 'A & B', recipientName: 'C', dedication: '<img src=x onerror=unsafe()>',
  scenes: [{ title: 'A scene', body: 'A harmless memory.' }], message: 'PRIVATE_FINAL_MESSAGE',
  solution: 'PRIVATE_ANSWER', ownerToken: 'PRIVATE_OWNER', playToken: 'PRIVATE_PLAY', replies: [{ message: 'PRIVATE_REPLY' }]
}
check('keepsake defaults exclude the final message and private management data', () => {
  const html = keepsakeHtml(story)
  for (const privateText of ['PRIVATE_FINAL_MESSAGE', 'PRIVATE_ANSWER', 'PRIVATE_OWNER', 'PRIVATE_PLAY', 'PRIVATE_REPLY']) assert.equal(html.includes(privateText), false)
  assert.equal(html.includes('A harmless memory.'), true)
  assert.equal(html.includes('<script>'), false)
  assert.equal(html.includes('<img '), false)
  assert.equal(html.includes('&lt;script&gt;'), true)
  assert.equal(html.includes('A &amp; B'), true)
})
check('keepsake includes only an explicitly selected final message', () => {
  const html = keepsakeHtml(story, true)
  assert.equal(html.includes('PRIVATE_FINAL_MESSAGE'), true)
  assert.equal(html.includes('PRIVATE_ANSWER'), false)
  assert.equal(html.includes('http-equiv="Content-Security-Policy"'), true)
})
check('recording produces real mono PCM WAV with exact duration and bounded size', () => {
  const buffer = wavRecording(new Float32Array(VOICE_SAMPLE_RATE * 60))
  const bytes = Buffer.from(buffer)
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF')
  assert.equal(bytes.toString('ascii', 8, 12), 'WAVE')
  assert.equal(bytes.readUInt16LE(22), 1)
  assert.equal(bytes.readUInt32LE(24), 16000)
  assert.equal(bytes.readUInt16LE(34), 16)
  assert.equal((buffer.byteLength - 44) / bytes.readUInt32LE(28), 60)
  assert.ok(buffer.byteLength < 5 * 1024 * 1024)
  assert.throws(() => wavRecording(new Float32Array(VOICE_SAMPLE_RATE * 60 + 1)), /60 seconds/)
  assert.throws(() => wavRecording(new Float32Array()), /Record/)
})
check('recording clamps PCM samples without wrapping or NaN output', () => {
  const bytes = Buffer.from(wavRecording(Float32Array.from([-2, -1, 0, 1, 2, NaN])))
  assert.deepEqual(Array.from({ length: 6 }, (_, i) => bytes.readInt16LE(44 + i * 2)), [-32768, -32768, 0, 32767, 32767, 0])
})
check('audio worklet batches real samples without sending microphone data elsewhere', () => {
  let Processor
  const chunks = []
  vm.runInNewContext(fs.readFileSync(path.join(root, 'public', 'gift-recorder-worklet.js'), 'utf8'), {
    AudioWorkletProcessor: class { constructor() { this.port = { postMessage: value => chunks.push(value) } } },
    registerProcessor(name, constructor) { assert.equal(name, 'muse-gift-recorder'); Processor = constructor },
    Float32Array
  })
  const processor = new Processor()
  for (let i = 0; i < 16; i++) assert.equal(processor.process([[new Float32Array(128).fill(0.25)]]), true)
  assert.equal(chunks.length, 1)
  assert.equal(chunks[0].length, 2048)
  assert.ok(chunks[0].every(value => value === 0.25))
  assert.equal(processor.process([[]]), true)
})
console.log(`${passed} gifting experience checks passed`)
